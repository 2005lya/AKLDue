using Akldue.Api.Data;
using Akldue.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using Akldue.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "DefaultConnection is not configured."
    );

var adminEmails = builder.Configuration
    .GetSection("Admin:Emails")
    .Get<string[]>() ?? [];

var clerkAuthority = builder.Configuration[
    "Clerk:Authority"
]?.TrimEnd('/')
    ?? throw new InvalidOperationException(
        "Clerk:Authority is not configured."
    );

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseNpgsql(connectionString);
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy =>
    {
        policy.RequireAssertion(context =>
        {
            var email =
    context.User.FindFirstValue("email")
    ?? context.User.FindFirstValue(ClaimTypes.Email)
    ?? context.User.Identity?.Name;

            return email is not null && adminEmails.Contains(
                email,
                StringComparer.OrdinalIgnoreCase
            );
        });
    });
});

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<AppDbContext>();


builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme
    )
    .AddJwtBearer(options =>
    {
        options.Authority = clerkAuthority;
        options.MapInboundClaims = false;

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = clerkAuthority,
                ValidateAudience = false,
                ValidateLifetime = true,
                NameClaimType = "sub"
            };
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("Development", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddMemoryCache();
builder.Services.AddHttpClient<CouncilAddressClient>();

builder.Services
    .AddHostedService<CouncilCollectionRefreshWorker>();

var app = builder.Build();

app.UseCors("Development");

app.UseAuthentication();
app.UseMiddleware<ClerkUserMiddleware>();
app.UseAuthorization();

var validRepeatUnits = new HashSet<string>(
    [
        "none",
        "week",
        "fortnight",
        "month",
        "quarter",
        "year"
    ],
    StringComparer.OrdinalIgnoreCase
);

var councilSaveLock = new SemaphoreSlim(1, 1);


app.MapGet("/api/health", () =>
{
    return Results.Ok(new
    {
        status = "ok",
        serverTime = DateTimeOffset.UtcNow
    });
});

app.MapGet(
    "/api/council/properties/{id}/services",
    async Task<IResult> (
        string id,
        CouncilAddressClient council,
        CancellationToken cancellationToken
    ) =>
    {
        try
        {
            var services =
                await council.GetCollectionServicesAsync(
                    id,
                    cancellationToken
                );

            return Results.Ok(services);
        }
        catch (ArgumentException)
        {
            return Results.BadRequest();
        }
        catch (HttpRequestException)
        {
            return Results.Problem(
                title: "Council service unavailable",
                statusCode: 503
            );
        }
    }
).RequireAuthorization();

app.MapGet(
    "/api/council/addresses",
    async Task<IResult> (
        string query,
        CouncilAddressClient council,
        CancellationToken cancellationToken
    ) =>
    {
        if (query.Trim().Length < 3)
        {
            return Results.Ok(
                Array.Empty<CouncilAddress>()
            );
        }

        try
        {
            var addresses = await council.SearchAsync(
                query,
                cancellationToken
            );

            return Results.Ok(addresses);
        }
        catch (HttpRequestException)
        {
            return Results.Problem(
                title: "Council service unavailable",
                statusCode: StatusCodes
                    .Status503ServiceUnavailable
            );
        }
    }
).RequireAuthorization();

var adminRatesEndpoints = app
    .MapGroup("/api/admin/rates-calendar")
    .RequireAuthorization("Admin");

adminRatesEndpoints.MapGet(
    "",
    async (
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var calendar = await database.RatesCalendar
            .AsNoTracking()
            .OrderBy(item => item.DueDate)
            .Select(item => new RatesCalendarResponse(
                item.RatingYear,
                item.InstalmentNumber,
                item.DueDate,
                item.IsPublished
            ))
            .ToListAsync(cancellationToken);

        return Results.Ok(calendar);
    }
);

adminRatesEndpoints.MapPut(
    "",
    async Task<IResult> (
        SaveRatesCalendarRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var ratingYear = request.RatingYear?.Trim();

        if (!TryParseRatingYear(
            ratingYear,
            out var startYear,
            out var endYear
        ))
        {
            return Results.BadRequest(new
            {
                message = "Rating year must look like 2026/2027."
            });
        }

        var instalments = request.Instalments?
            .OrderBy(item => item.InstalmentNumber)
            .ToList() ?? [];

        if (
            instalments.Count != 4 ||
            !instalments
                .Select(item => item.InstalmentNumber)
                .SequenceEqual(new[] { 1, 2, 3, 4 })
        )
        {
            return Results.BadRequest(new
            {
                message = "Exactly four unique instalments are required."
            });
        }

        var firstAllowedDate = new DateOnly(startYear, 7, 1);
        var lastAllowedDate = new DateOnly(endYear, 6, 30);
        var dates = instalments.Select(item => item.DueDate).ToList();

        if (
            dates.Any(date =>
                date < firstAllowedDate || date > lastAllowedDate
            ) ||
            !dates.SequenceEqual(dates.OrderBy(date => date)) ||
            dates.Distinct().Count() != 4
        )
        {
            return Results.BadRequest(new
            {
                message = "Instalment dates must be unique, ordered, " +
                    "and inside the rating year."
            });
        }

        var existingItems = await database.RatesCalendar
            .Where(item => item.RatingYear == ratingYear)
            .ToListAsync(cancellationToken);

        foreach (var instalment in instalments)
        {
            var item = existingItems.FirstOrDefault(existing =>
                existing.InstalmentNumber ==
                    instalment.InstalmentNumber
            );

            if (item is null)
            {
                database.RatesCalendar.Add(
                    new RatesCalendarItem
                    {
                        Id = Guid.NewGuid(),
                        RatingYear = ratingYear!,
                        InstalmentNumber =
                            instalment.InstalmentNumber,
                        DueDate = instalment.DueDate,
                        IsPublished = request.IsPublished,
                        UpdatedAtUtc = DateTimeOffset.UtcNow
                    }
                );
            }
            else
            {
                item.DueDate = instalment.DueDate;
                item.IsPublished = request.IsPublished;
                item.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
);

app.MapGet(
    "/api/profile/council-property",
    async Task<IResult> (
        ClaimsPrincipal user,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var property = await database.CouncilProperties
            .AsNoTracking()
            .Include(item => item.Subscriptions)
            .FirstOrDefaultAsync(
                item => item.UserId == userId,
                cancellationToken
            );

        if (property is null)
        {
            return Results.Ok(
                (CouncilPropertyResponse?)null
            );
        }

        var services = property.Subscriptions
            .OrderBy(item => item.NextDueDate)
            .Select(item =>
                new CouncilSubscriptionResponse(
                    item.ServiceType,
                    item.ServiceType switch
                    {
                        "rubbish" => "Rubbish",
                        "foodScraps" => "Food scraps",
                        "recycling" => "Recycling",
                        _ => item.ServiceType
                    },
                    item.NextDueDate
                )
            )
            .ToList();

        return Results.Ok(
            new CouncilPropertyResponse(
                property.CouncilAddressId,
                property.Address,
                property.PropertyId,
                property.RatesSubscribed,
                services
            )
        );
    }
).RequireAuthorization();

app.MapPut(
    "/api/profile/council-property/rates-subscription",
    async Task<IResult> (
        ClaimsPrincipal user,
        SaveRatesSubscriptionRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var addressId = request.CouncilAddressId?.Trim();
        var address = request.Address?.Trim();
        var propertyId = request.PropertyId?.Trim();

        if (
            string.IsNullOrWhiteSpace(addressId) ||
            string.IsNullOrWhiteSpace(address) ||
            string.IsNullOrWhiteSpace(propertyId)
        )
        {
            return Results.BadRequest(new
            {
                message = "Address details are required."
            });
        }

        var property = await database.CouncilProperties
            .FirstOrDefaultAsync(
                item => item.UserId == userId,
                cancellationToken
            );

        if (property is null)
        {
            property = new UserCouncilProperty
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                CouncilAddressId = addressId,
                Address = address,
                PropertyId = propertyId,
                RatesSubscribed = request.Subscribed
            };

            database.CouncilProperties.Add(property);
        }
        else
        {
            property.CouncilAddressId = addressId;
            property.Address = address;
            property.PropertyId = propertyId;
            property.RatesSubscribed = request.Subscribed;
        }

        await database.SaveChangesAsync(cancellationToken);

        return Results.Ok(new
        {
            ratesSubscribed = property.RatesSubscribed
        });
    }
).RequireAuthorization();

app.MapPut(
    "/api/profile/council-property",
    async Task<IResult> (
        ClaimsPrincipal user,
        SaveCouncilPropertyRequest request,
        AppDbContext database,
        CouncilAddressClient council,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var addressId = request.CouncilAddressId?.Trim();
        var address = request.Address?.Trim();
        var propertyId = request.PropertyId?.Trim();

        if (
            string.IsNullOrWhiteSpace(addressId) ||
            string.IsNullOrWhiteSpace(address) ||
            string.IsNullOrWhiteSpace(propertyId)
        )
        {
            return Results.BadRequest(new
            {
                message = "Address details are required."
            });
        }

        var allowedTypes = new HashSet<string>(
            ["rubbish", "foodScraps", "recycling"],
            StringComparer.OrdinalIgnoreCase
        );

        var requestedTypes = request.ServiceTypes?
            .Where(type => !string.IsNullOrWhiteSpace(type))
            .Select(type => type.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

        if (requestedTypes.Any(type => !allowedTypes.Contains(type)))
        {
            return Results.BadRequest(new
            {
                message = "A service type is invalid."
            });
        }

        IReadOnlyList<CollectionService> availableServices =
            request.Services?
                .Where(service =>
                    !string.IsNullOrWhiteSpace(service.Type) &&
                    !string.IsNullOrWhiteSpace(service.Title) &&
                    allowedTypes.Contains(service.Type)
                )
                .Select(service => new CollectionService(
                    service.Type.Trim(),
                    service.Title.Trim(),
                    service.DueDate
                ))
                .DistinctBy(service => service.Type)
                .ToList() ?? [];

        if (availableServices.Count == 0)
        {
            try
            {
                availableServices =
                    await council.GetCollectionServicesAsync(
                        addressId,
                        cancellationToken
                    );
            }
            catch (HttpRequestException)
            {
                return Results.Problem(
                    title: "Council service unavailable",
                    statusCode: 503
                );
            }
        }

        var selectedServices = availableServices
            .Where(service =>
                requestedTypes.Contains(
                    service.Type,
                    StringComparer.OrdinalIgnoreCase
                )
            )
            .DistinctBy(service => service.Type)
            .ToList();

        if (selectedServices.Count != requestedTypes.Count)
        {
            return Results.BadRequest(new
            {
                message = "A selected service is unavailable."
            });
        }
        await councilSaveLock.WaitAsync(cancellationToken);

        try
        {
            var property = await database.CouncilProperties
                .Include(item => item.Subscriptions)
                .FirstOrDefaultAsync(
                    item => item.UserId == userId,
                    cancellationToken
                );

            if (property is null)
            {
                property = new UserCouncilProperty
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    CouncilAddressId = addressId,
                    Address = address,
                    PropertyId = propertyId
                };

                database.CouncilProperties.Add(property);
            }
            else
            {
                property.CouncilAddressId = addressId;
                property.Address = address;
                property.PropertyId = propertyId;
            }

            var removedSubscriptions = property.Subscriptions
                .Where(subscription =>
                    !selectedServices.Any(service =>
                        service.Type.Equals(
                            subscription.ServiceType,
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                )
                .ToList();

            database.CouncilSubscriptions.RemoveRange(
                removedSubscriptions
            );

            foreach (var service in selectedServices)
            {
                var subscription = property.Subscriptions
                    .FirstOrDefault(item =>
                        item.ServiceType.Equals(
                            service.Type,
                            StringComparison.OrdinalIgnoreCase
                        )
                    );

                if (subscription is null)
                {
                    var newSubscription = new CouncilSubscription
                    {
                        Id = Guid.NewGuid(),
                        UserCouncilPropertyId = property.Id,
                        ServiceType = service.Type,
                        NextDueDate = service.DueDate,
                        LastSyncedAtUtc = DateTimeOffset.UtcNow
                    };

                    database.CouncilSubscriptions.Add(newSubscription);
                }
                else
                {
                    subscription.NextDueDate = service.DueDate;
                    subscription.LastSyncedAtUtc =
                        DateTimeOffset.UtcNow;
                }
            }

            await database.SaveChangesAsync(cancellationToken);

            return Results.Ok(new
            {
                councilAddressId = property.CouncilAddressId,
                address = property.Address,
                propertyId = property.PropertyId,
                services = selectedServices
            });
        }
        finally
        {
            councilSaveLock.Release();
        }
    }
).RequireAuthorization();

app.MapGet(
    "/api/profile/vehicles",
    async (
        ClaimsPrincipal user,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var vehicles = await database.Vehicles
            .AsNoTracking()
            .Where(vehicle => vehicle.UserId == userId)
            .OrderBy(vehicle => vehicle.Plate)
            .Select(vehicle => new VehicleResponse(
                vehicle.Id,
                vehicle.Plate,
                vehicle.RegoExpiryDate,
                vehicle.WofExpiryDate
            ))
            .ToListAsync(cancellationToken);

        return Results.Ok(vehicles);
    }
).RequireAuthorization();

app.MapPost(
    "/api/profile/vehicles",
    async Task<IResult> (
        ClaimsPrincipal user,
        SaveVehicleRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var plate = request.Plate?
            .Trim()
            .Replace(" ", "")
            .Replace("-", "")
            .ToUpperInvariant();

        if (
            string.IsNullOrWhiteSpace(plate) ||
            plate.Length > 10 ||
            plate.Any(character =>
                !char.IsLetterOrDigit(character)
            )
        )
        {
            return Results.BadRequest(new
            {
                message = "Plate is invalid."
            });
        }

        if (
            request.RegoExpiryDate is null &&
            request.WofExpiryDate is null
        )
        {
            return Results.BadRequest(new
            {
                message =
                    "At least one expiry date is required."
            });
        }

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(
            "Pacific/Auckland"
        );

        var today = DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(
                DateTimeOffset.UtcNow,
                timeZone
            ).Date
        );

        if (
            request.RegoExpiryDate < today ||
            request.WofExpiryDate < today
        )
        {
            return Results.BadRequest(new
            {
                message = "Expiry dates cannot be in the past."
            });
        }

        var alreadyExists = await database.Vehicles.AnyAsync(
            vehicle =>
                vehicle.UserId == userId &&
                vehicle.Plate == plate,
            cancellationToken
        );

        if (alreadyExists)
        {
            return Results.Conflict(new
            {
                message = "This vehicle already exists."
            });
        }

        var vehicle = new UserVehicle
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Plate = plate,
            RegoExpiryDate = request.RegoExpiryDate,
            WofExpiryDate = request.WofExpiryDate,
            CreatedAtUtc = DateTimeOffset.UtcNow,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };

        database.Vehicles.Add(vehicle);
        await database.SaveChangesAsync(cancellationToken);

        return Results.Created(
            $"/api/profile/vehicles/{vehicle.Id}",
            new VehicleResponse(
                vehicle.Id,
                vehicle.Plate,
                vehicle.RegoExpiryDate,
                vehicle.WofExpiryDate
            )
        );
    }
).RequireAuthorization();

app.MapPut(
    "/api/profile/vehicles/{id:guid}",
    async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        SaveVehicleRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var vehicle = await database.Vehicles
            .FirstOrDefaultAsync(
                item =>
                    item.Id == id &&
                    item.UserId == userId,
                cancellationToken
            );

        if (vehicle is null)
        {
            return Results.NotFound();
        }

        var plate = request.Plate?
            .Trim()
            .Replace(" ", "")
            .Replace("-", "")
            .ToUpperInvariant();

        if (
            string.IsNullOrWhiteSpace(plate) ||
            plate.Length > 10 ||
            plate.Any(character =>
                !char.IsLetterOrDigit(character)
            )
        )
        {
            return Results.BadRequest(new
            {
                message = "Plate is invalid."
            });
        }

        if (
            request.RegoExpiryDate is null &&
            request.WofExpiryDate is null
        )
        {
            return Results.BadRequest(new
            {
                message =
                    "At least one expiry date is required."
            });
        }

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(
    "Pacific/Auckland"
);

        var today = DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(
                DateTimeOffset.UtcNow,
                timeZone
            ).Date
        );

        if (
            request.RegoExpiryDate < today ||
            request.WofExpiryDate < today
        )
        {
            return Results.BadRequest(new
            {
                message = "Expiry dates cannot be in the past."
            });
        }

        var duplicateExists = await database.Vehicles.AnyAsync(
            item =>
                item.UserId == userId &&
                item.Plate == plate &&
                item.Id != id,
            cancellationToken
        );

        if (duplicateExists)
        {
            return Results.Conflict(new
            {
                message = "This vehicle already exists."
            });
        }

        vehicle.Plate = plate;
        vehicle.RegoExpiryDate = request.RegoExpiryDate;
        vehicle.WofExpiryDate = request.WofExpiryDate;
        vehicle.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await database.SaveChangesAsync(cancellationToken);

        return Results.Ok(
            new VehicleResponse(
                vehicle.Id,
                vehicle.Plate,
                vehicle.RegoExpiryDate,
                vehicle.WofExpiryDate
            )
        );
    }
).RequireAuthorization();

app.MapDelete(
    "/api/profile/vehicles/{id:guid}",
    async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var vehicle = await database.Vehicles
            .FirstOrDefaultAsync(
                item =>
                    item.Id == id &&
                    item.UserId == userId,
                cancellationToken
            );

        if (vehicle is null)
        {
            return Results.NotFound();
        }

        database.Vehicles.Remove(vehicle);
        await database.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
).RequireAuthorization();

app.MapPost(
    "/api/profile/subscriptions/unsubscribe",
    async Task<IResult> (
        ClaimsPrincipal user,
        UnsubscribeRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var subscriptionType =
            request.SubscriptionType?.Trim().ToLowerInvariant();

        switch (subscriptionType)
        {
            case "council":
            {
                if (request.SubscriptionId is null)
                {
                    return Results.BadRequest();
                }

                var subscription = await (
                    from item in database.CouncilSubscriptions
                    join property in database.CouncilProperties
                        on item.UserCouncilPropertyId
                        equals property.Id
                    where
                        item.Id == request.SubscriptionId &&
                        property.UserId == userId
                    select item
                ).FirstOrDefaultAsync(cancellationToken);

                if (subscription is null)
                {
                    return Results.NotFound();
                }

                database.CouncilSubscriptions.Remove(
                    subscription
                );

                break;
            }

            case "rates":
            {
                var property = await database.CouncilProperties
                    .FirstOrDefaultAsync(
                        item => item.UserId == userId,
                        cancellationToken
                    );

                if (property is null)
                {
                    return Results.NotFound();
                }

                property.RatesSubscribed = false;
                break;
            }

            case "vehicle":
            {
                if (
                    request.SubscriptionId is null ||
                    (
                        request.ServiceType != "rego" &&
                        request.ServiceType != "wof"
                    )
                )
                {
                    return Results.BadRequest();
                }

                var vehicle = await database.Vehicles
                    .FirstOrDefaultAsync(
                        item =>
                            item.Id == request.SubscriptionId &&
                            item.UserId == userId,
                        cancellationToken
                    );

                if (vehicle is null)
                {
                    return Results.NotFound();
                }

                if (request.ServiceType == "rego")
                {
                    vehicle.RegoExpiryDate = null;
                }
                else
                {
                    vehicle.WofExpiryDate = null;
                }

                if (
                    vehicle.RegoExpiryDate is null &&
                    vehicle.WofExpiryDate is null
                )
                {
                    database.Vehicles.Remove(vehicle);
                }
                else
                {
                    vehicle.UpdatedAtUtc = DateTimeOffset.UtcNow;
                }

                break;
            }

            default:
                return Results.BadRequest(new
                {
                    message = "Subscription type is invalid."
                });
        }

        await database.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
).RequireAuthorization();

var dueEndpoints = app
    .MapGroup("/api/dues")
    .RequireAuthorization();

dueEndpoints.MapGet(
    "",
    async (
        ClaimsPrincipal user,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);

        var personalDues = await database.Dues
            .AsNoTracking()
            .Where(due => due.UserId == userId)
            .Select(due => new DueResponse(
                due.Id,
                due.Title,
                due.Source,
                due.DueDate,
                due.RepeatUnit,
                due.ExcludedDates,
                null,
                null,
                null
            ))
            .ToListAsync(cancellationToken);

        var subscriptions = await (
            from subscription in database.CouncilSubscriptions
                .AsNoTracking()
            join property in database.CouncilProperties
                .AsNoTracking()
                on subscription.UserCouncilPropertyId
                equals property.Id
            where property.UserId == userId
            select subscription
        ).ToListAsync(cancellationToken);

        var councilDues = subscriptions.Select(subscription =>
            new DueResponse(
                subscription.Id,
                subscription.ServiceType switch
                {
                    "rubbish" => "Rubbish collection",
                    "foodScraps" => "Food scraps collection",
                    "recycling" => "Recycling collection",
                    _ => subscription.ServiceType
                },
                "Auckland Council",
                subscription.NextDueDate,
                "none",
                Array.Empty<DateOnly>(),
                "council",
                subscription.Id,
                subscription.ServiceType
            )
        );

        var vehicles = await database.Vehicles
    .AsNoTracking()
    .Where(vehicle => vehicle.UserId == userId)
    .ToListAsync(cancellationToken);

        var vehicleDues = new List<DueResponse>();

        foreach (var vehicle in vehicles)
        {
            if (vehicle.RegoExpiryDate is not null)
            {
                vehicleDues.Add(
                    new DueResponse(
                        CreateVehicleDueId(vehicle.Id, 1),
                        $"{vehicle.Plate} Rego",
                        "NZTA",
                        vehicle.RegoExpiryDate.Value,
                        "none",
                        Array.Empty<DateOnly>(),
                        "vehicle",
                        vehicle.Id,
                        "rego"
                    )
                );
            }

            if (vehicle.WofExpiryDate is not null)
            {
                vehicleDues.Add(
                    new DueResponse(
                        CreateVehicleDueId(vehicle.Id, 2),
                        $"{vehicle.Plate} WoF",
                        "NZTA",
                        vehicle.WofExpiryDate.Value,
                        "none",
                        Array.Empty<DateOnly>(),
                        "vehicle",
                        vehicle.Id,
                        "wof"
                    )
                );
            }
        }

        var ratesSubscribed = await database.CouncilProperties
            .AsNoTracking()
            .AnyAsync(
                property =>
                    property.UserId == userId &&
                    property.RatesSubscribed,
                cancellationToken
            );

        var ratesDues = new List<DueResponse>();

        if (ratesSubscribed)
        {
            var ratesCalendar = await database.RatesCalendar
                .AsNoTracking()
                .Where(item => item.IsPublished)
                .OrderBy(item => item.DueDate)
                .ToListAsync(cancellationToken);

            ratesDues = ratesCalendar.Select(item =>
                new DueResponse(
                    item.Id,
                    $"Property rates instalment " +
                        $"{item.InstalmentNumber}",
                    "Auckland Council",
                    item.DueDate,
                    "none",
                    Array.Empty<DateOnly>(),
                    "rates",
                    null,
                   "rates"
                )
            ).ToList();
        }

        var dues = personalDues
            .Concat(councilDues)
             .Concat(vehicleDues)
            .Concat(ratesDues)
            .OrderBy(due => due.DueDate)
            .ToList();

        return Results.Ok(dues);
    }
);

dueEndpoints.MapGet(
    "/{id:guid}",
    async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var due = await database.Dues
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.Id == id && item.UserId == userId,
                cancellationToken
            );

        return due is null
            ? Results.NotFound()
            : Results.Ok(ToResponse(due));
    }
);

dueEndpoints.MapPost(
    "",
    async Task<IResult> (
        ClaimsPrincipal user,
        CreateDueRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var title = request.Title?.Trim();

        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["title"] = ["Title is required."]
                }
            );
        }

        var today = DateOnly.FromDateTime(DateTime.Now);

        if (request.DueDate < today)
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["dueDate"] = [
                        "Due date cannot be in the past."
                    ]
                }
            );
        }

        if (
            request.RepeatUnit is null ||
            !validRepeatUnits.Contains(request.RepeatUnit)
        )
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["repeatUnit"] = ["Repeat unit is invalid."]
                }
            );
        }

        var due = new DueItem
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = title,
            Source = "Personal",
            DueDate = request.DueDate,
            RepeatUnit = request.RepeatUnit.ToLowerInvariant(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            ExcludedDates = [],
        };

        database.Dues.Add(due);
        await database.SaveChangesAsync(cancellationToken);

        var response = ToResponse(due);

        return Results.Created(
            $"/api/dues/{due.Id}",
            response
        );
    }
);

dueEndpoints.MapPut(
    "/{id:guid}",
    async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        UpdateDueRequest request,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var due = await database.Dues.FirstOrDefaultAsync(
            item => item.Id == id && item.UserId == userId,
            cancellationToken
        );

        if (due is null)
        {
            return Results.NotFound();
        }

        if (due.Source != "Personal")
        {
            return Results.BadRequest(new
            {
                message = "Public service dues cannot be edited."
            });
        }

        var title = request.Title?.Trim();

        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["title"] = ["Title is required."]
                }
            );
        }

        if (
            request.RepeatUnit is null ||
            !validRepeatUnits.Contains(request.RepeatUnit)
        )
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["repeatUnit"] = ["Repeat unit is invalid."]
                }
            );
        }

        var today = DateOnly.FromDateTime(DateTime.Now);

        if (request.DueDate < today)
        {
            return Results.ValidationProblem(
                new Dictionary<string, string[]>
                {
                    ["dueDate"] = [
                        "Due date cannot be in the past."
                    ]
                }
            );
        }

        var normalizedRepeatUnit =
    request.RepeatUnit.ToLowerInvariant();

        var recurrenceChanged =
            due.DueDate != request.DueDate ||
            due.RepeatUnit != normalizedRepeatUnit;

        if (recurrenceChanged)
        {
            due.ExcludedDates.Clear();
        }

        due.Title = title;
        due.DueDate = request.DueDate;
        due.RepeatUnit = normalizedRepeatUnit;

        await database.SaveChangesAsync(cancellationToken);

        return Results.Ok(ToResponse(due));
    }
);

dueEndpoints.MapDelete(
    "/{id:guid}/occurrences/{date}",
    async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        string date,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var due = await database.Dues.FirstOrDefaultAsync(
            item => item.Id == id && item.UserId == userId,
            cancellationToken
        );

        if (due is null)
        {
            return Results.NotFound();
        }

        if (due.Source != "Personal")
        {
            return Results.BadRequest(new
            {
                message = "Public service dues cannot be deleted."
            });
        }

        if (due.RepeatUnit == "none")
        {
            return Results.BadRequest(new
            {
                message = "This due does not repeat."
            });
        }

        var isValidDate = DateOnly.TryParseExact(
            date,
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out var excludedDate
        );

        if (!isValidDate || excludedDate < due.DueDate)
        {
            return Results.BadRequest(new
            {
                message = "Occurrence date is invalid."
            });
        }

        if (!due.ExcludedDates.Contains(excludedDate))
        {
            due.ExcludedDates.Add(excludedDate);
            await database.SaveChangesAsync(cancellationToken);
        }

        return Results.NoContent();
    }
);

dueEndpoints.MapDelete(
    "/{id:guid}",
    async Task<IResult> (
        Guid id,
        ClaimsPrincipal user,
        AppDbContext database,
        CancellationToken cancellationToken
    ) =>
    {
        var userId = GetCurrentUserId(user);
        var due = await database.Dues.FirstOrDefaultAsync(
            item => item.Id == id && item.UserId == userId,
            cancellationToken
        );

        if (due is null)
        {
            return Results.NotFound();
        }

        if (due.Source != "Personal")
        {
            return Results.BadRequest(new
            {
                message = "Public service dues cannot be deleted."
            });
        }

        database.Dues.Remove(due);
        await database.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }
);

app.Run();

static Guid GetCurrentUserId(ClaimsPrincipal user)
{
    var userId = user.FindFirstValue("local_user_id")
        ?? throw new UnauthorizedAccessException(
            "Local user mapping is missing."
        );

    return Guid.Parse(userId);
}

static DueResponse ToResponse(DueItem due)
{
    return new DueResponse(
        due.Id,
        due.Title,
        due.Source,
        due.DueDate,
        due.RepeatUnit,
        due.ExcludedDates
    );
}

static bool TryParseRatingYear(
    string? value,
    out int startYear,
    out int endYear
)
{
    startYear = 0;
    endYear = 0;

    if (value is null)
    {
        return false;
    }

    var parts = value.Split('/');

    return parts.Length == 2 &&
        int.TryParse(parts[0], out startYear) &&
        int.TryParse(parts[1], out endYear) &&
        endYear == startYear + 1;
}

static Guid CreateVehicleDueId(
    Guid vehicleId,
    byte discriminator
)
{
    var bytes = vehicleId.ToByteArray();

    bytes[^1] ^= discriminator;

    return new Guid(bytes);
}

record CreateDueRequest(
    string? Title,
    DateOnly DueDate,
    string? RepeatUnit
);

record UpdateDueRequest(
    string? Title,
    DateOnly DueDate,
    string? RepeatUnit
);
record DueResponse(
    Guid Id,
    string Title,
    string Source,
    DateOnly DueDate,
    string RepeatUnit,
    IReadOnlyList<DateOnly> ExcludedDates,
    string? SubscriptionType = null,
    Guid? SubscriptionId = null,
    string? ServiceType = null
);

record SaveCouncilPropertyRequest(
    string? CouncilAddressId,
    string? Address,
    string? PropertyId,
    IReadOnlyList<string>? ServiceTypes,
    IReadOnlyList<CollectionService>? Services
);

record SaveRatesSubscriptionRequest(
    string? CouncilAddressId,
    string? Address,
    string? PropertyId,
    bool Subscribed
);

record SaveRatesCalendarRequest(
    string? RatingYear,
    bool IsPublished,
    IReadOnlyList<SaveRatesInstalmentRequest>? Instalments
);

record SaveRatesInstalmentRequest(
    int InstalmentNumber,
    DateOnly DueDate
);

record RatesCalendarResponse(
    string RatingYear,
    int InstalmentNumber,
    DateOnly DueDate,
    bool IsPublished
);

record CouncilPropertyResponse(
    string CouncilAddressId,
    string Address,
    string PropertyId,
    bool RatesSubscribed,
    IReadOnlyList<CouncilSubscriptionResponse> Services
);

record CouncilSubscriptionResponse(
    string Type,
    string Title,
    DateOnly DueDate
);
record VehicleResponse(
    Guid Id,
    string Plate,
    DateOnly? RegoExpiryDate,
    DateOnly? WofExpiryDate
);

record SaveVehicleRequest(
    string? Plate,
    DateOnly? RegoExpiryDate,
    DateOnly? WofExpiryDate
);

record UnsubscribeRequest(
    string? SubscriptionType,
    Guid? SubscriptionId,
    string? ServiceType
);

public partial class Program
{
}
