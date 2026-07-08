using System.Net;
using System.Net.Http.Json;

namespace Akldue.Api.Tests;

public class ApiIntegrationTests :
    IClassFixture<AkldueApiFactory>
{
    private readonly AkldueApiFactory factory;

    public ApiIntegrationTests(AkldueApiFactory factory)
    {
        this.factory = factory;
    }

    [Fact]
    public async Task Health_returns_ok()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content
            .ReadFromJsonAsync<HealthResponse>();

        Assert.NotNull(result);
        Assert.Equal("ok", result.Status);
    }

    [Fact]
    public async Task Dues_without_login_returns_unauthorized()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/dues");

        Assert.Equal(
            HttpStatusCode.Unauthorized,
            response.StatusCode
        );
    }

    [Fact]
    public async Task Logged_in_user_can_create_and_read_due()
    {
        using var client = await CreateAuthenticatedClient();
        var dueDate = DateOnly.FromDateTime(
            DateTime.Today.AddDays(7)
        );

        var createResponse = await client.PostAsJsonAsync(
            "/api/dues",
            new
            {
                title = "Test due",
                dueDate,
                repeatUnit = "none"
            }
        );

        Assert.Equal(
            HttpStatusCode.Created,
            createResponse.StatusCode
        );

        var dues = await client.GetFromJsonAsync<
            List<DueApiResponse>
        >("/api/dues");

        Assert.NotNull(dues);
        Assert.Contains(
            dues,
            due =>
                due.Title == "Test due" &&
                due.DueDate == dueDate &&
                due.Source == "Personal"
        );
    }

    [Fact]
    public async Task User_cannot_read_another_users_due()
    {
        using var firstUser = await CreateAuthenticatedClient();
        using var secondUser = await CreateAuthenticatedClient();

        var createResponse = await firstUser.PostAsJsonAsync(
            "/api/dues",
            new
            {
                title = "Private due",
                dueDate = DateOnly.FromDateTime(
                    DateTime.Today.AddDays(10)
                ),
                repeatUnit = "none"
            }
        );

        Assert.Equal(
            HttpStatusCode.Created,
            createResponse.StatusCode
        );

        var secondUserDues = await secondUser.GetFromJsonAsync<
            List<DueApiResponse>
        >("/api/dues");

        Assert.NotNull(secondUserDues);
        Assert.DoesNotContain(
            secondUserDues,
            due => due.Title == "Private due"
        );
    }

    [Fact]
    public async Task Vehicle_creates_rego_and_wof_dues()
    {
        using var client = await CreateAuthenticatedClient();
        var regoDate = DateOnly.FromDateTime(
            DateTime.Today.AddDays(30)
        );
        var wofDate = DateOnly.FromDateTime(
            DateTime.Today.AddDays(60)
        );

        var response = await client.PostAsJsonAsync(
            "/api/profile/vehicles",
            new
            {
                plate = "ABC123",
                regoExpiryDate = regoDate,
                wofExpiryDate = wofDate
            }
        );

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var dues = await client.GetFromJsonAsync<
            List<DueApiResponse>
        >("/api/dues");

        Assert.NotNull(dues);
        Assert.Contains(
            dues,
            due =>
                due.Title == "ABC123 Rego" &&
                due.Source == "NZTA" &&
                due.DueDate == regoDate
        );
        Assert.Contains(
            dues,
            due =>
                due.Title == "ABC123 WoF" &&
                due.Source == "NZTA" &&
                due.DueDate == wofDate
        );
    }

    [Fact]
    public async Task Published_rates_are_returned_to_subscribers()
    {
        using var admin = await CreateAuthenticatedClient(
            AkldueApiFactory.AdminEmail
        );

        var saveCalendarResponse = await admin.PutAsJsonAsync(
            "/api/admin/rates-calendar",
            new
            {
                ratingYear = "2030/2031",
                isPublished = true,
                instalments = new[]
                {
                    new { instalmentNumber = 1, dueDate = "2030-08-30" },
                    new { instalmentNumber = 2, dueDate = "2030-11-29" },
                    new { instalmentNumber = 3, dueDate = "2031-02-28" },
                    new { instalmentNumber = 4, dueDate = "2031-05-30" }
                }
            }
        );

        Assert.Equal(
            HttpStatusCode.NoContent,
            saveCalendarResponse.StatusCode
        );

        var subscribeResponse = await admin.PutAsJsonAsync(
            "/api/profile/council-property/rates-subscription",
            new
            {
                councilAddressId = "12340785995",
                address = "2/92 Weldene Avenue Glenfield 0629",
                propertyId = "11072110-0002",
                subscribed = true
            }
        );

        Assert.Equal(HttpStatusCode.OK, subscribeResponse.StatusCode);

        var dues = await admin.GetFromJsonAsync<
            List<DueApiResponse>
        >("/api/dues");

        Assert.NotNull(dues);
        Assert.Equal(
            4,
            dues.Count(due =>
                due.Title.StartsWith("Property rates instalment")
            )
        );
    }

    [Fact]
    public async Task Non_admin_cannot_update_rates_calendar()
    {
        using var client = await CreateAuthenticatedClient();

        var response = await client.PutAsJsonAsync(
            "/api/admin/rates-calendar",
            new
            {
                ratingYear = "2032/2033",
                isPublished = false,
                instalments = new[]
                {
                    new { instalmentNumber = 1, dueDate = "2032-08-30" },
                    new { instalmentNumber = 2, dueDate = "2032-11-30" },
                    new { instalmentNumber = 3, dueDate = "2033-02-28" },
                    new { instalmentNumber = 4, dueDate = "2033-05-30" }
                }
            }
        );

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private Task<HttpClient> CreateAuthenticatedClient(
        string? email = null
    )
    {
        var client = factory.CreateClient();
        email ??= $"test-{Guid.NewGuid():N}@example.com";

        client.DefaultRequestHeaders.Add(
            TestAuthenticationHandler.SubjectHeader,
            $"test-user-{Guid.NewGuid():N}"
        );
        client.DefaultRequestHeaders.Add(
            TestAuthenticationHandler.EmailHeader,
            email
        );

        return Task.FromResult(client);
    }

    private sealed record HealthResponse(
        string Status,
        DateTimeOffset ServerTime
    );

    private sealed record DueApiResponse(
        Guid Id,
        string Title,
        string Source,
        DateOnly DueDate,
        string RepeatUnit
    );
}
