using Akldue.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Akldue.Api.Services;

public class CouncilCollectionRefreshWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<CouncilCollectionRefreshWorker> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(
        CancellationToken stoppingToken
    )
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RefreshExpiredSubscriptions(stoppingToken);
                await Task.Delay(
                    TimeSpan.FromHours(1),
                    stoppingToken
                );
            }
            catch (OperationCanceledException)
                when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Council subscription refresh failed."
                );

                await Task.Delay(
                    TimeSpan.FromMinutes(10),
                    stoppingToken
                );
            }
        }
    }

    private async Task RefreshExpiredSubscriptions(
        CancellationToken cancellationToken
    )
    {
        using var scope = scopeFactory.CreateScope();

        var database =
            scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var council =
            scope.ServiceProvider
                .GetRequiredService<CouncilAddressClient>();

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(
            "Pacific/Auckland"
        );

        var now = DateTimeOffset.UtcNow;

        var today = DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTime(now, timeZone).Date
        );

        var retryBefore = now.Subtract(TimeSpan.FromHours(6));

        var properties = await database.CouncilProperties
            .Include(property => property.Subscriptions)
            .Where(property =>
                property.Subscriptions.Any(subscription =>
                    subscription.NextDueDate < today &&
                    subscription.LastSyncedAtUtc < retryBefore
                )
            )
            .ToListAsync(cancellationToken);

        foreach (var property in properties)
        {
            try
            {
                var services =
                    await council.GetCollectionServicesAsync(
                        property.CouncilAddressId,
                        cancellationToken
                    );

                foreach (var subscription in property.Subscriptions)
                {
                    if (subscription.NextDueDate >= today)
                    {
                        continue;
                    }

                    var service = services.FirstOrDefault(item =>
                        item.Type.Equals(
                            subscription.ServiceType,
                            StringComparison.OrdinalIgnoreCase
                        )
                    );

                    if (
                        service is not null &&
                        service.DueDate >
                            subscription.NextDueDate
                    )
                    {
                        subscription.NextDueDate =
                            service.DueDate;
                    }

                    subscription.LastSyncedAtUtc = now;
                }

                await database.SaveChangesAsync(
                    cancellationToken
                );
            }
            catch (HttpRequestException exception)
            {
                logger.LogWarning(
                    exception,
                    "Could not refresh Council property {PropertyId}.",
                    property.Id
                );
            }
        }
    }
}