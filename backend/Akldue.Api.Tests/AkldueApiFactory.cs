using Akldue.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Akldue.Api.Tests;

public class AkldueApiFactory :
    WebApplicationFactory<Program>
{
    public const string AdminEmail = "admin-tests@example.com";

    private readonly string databaseName =
        $"akldue-tests-{Guid.NewGuid()}";

    protected override void ConfigureWebHost(
        IWebHostBuilder builder
    )
    {
        builder.UseEnvironment("Testing");

        builder.UseSetting(
            "ConnectionStrings:DefaultConnection",
            "Testing"
        );

        builder.UseSetting(
            "Clerk:Authority",
            "https://test-clerk.example.com"
        );

        builder.UseSetting(
            "Admin:Emails:0",
            AdminEmail
        );

        builder.ConfigureServices(services =>
        {
            services
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme =
                        TestAuthenticationHandler.SchemeName;
                    options.DefaultChallengeScheme =
                        TestAuthenticationHandler.SchemeName;
                })
                .AddScheme<AuthenticationSchemeOptions,
                    TestAuthenticationHandler>(
                    TestAuthenticationHandler.SchemeName,
                    _ => { }
                );

            var descriptor = services.SingleOrDefault(
                service =>
                    service.ServiceType ==
                    typeof(DbContextOptions<AppDbContext>)
            );

            if (descriptor is not null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseInMemoryDatabase(databaseName);
            });
        });
    }
}
