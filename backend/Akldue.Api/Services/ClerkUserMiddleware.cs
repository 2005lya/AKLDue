using System.Security.Claims;
using Akldue.Api.Models;
using Microsoft.AspNetCore.Identity;

namespace Akldue.Api.Services;

public class ClerkUserMiddleware(
    RequestDelegate next,
    ILogger<ClerkUserMiddleware> logger
)
{
    public async Task InvokeAsync(
        HttpContext context,
        UserManager<ApplicationUser> userManager
    )
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await next(context);
            return;
        }

        var subject = context.User.FindFirstValue("sub");
        var email = context.User.FindFirstValue("email");

        if (
            string.IsNullOrWhiteSpace(subject) ||
            string.IsNullOrWhiteSpace(email)
        )
        {
            context.Response.StatusCode =
                StatusCodes.Status401Unauthorized;

            await context.Response.WriteAsJsonAsync(new
            {
                message =
                    "The Clerk session is missing required claims."
            });

            return;
        }

        var user = await userManager.FindByLoginAsync(
            "Clerk",
            subject
        );

        if (user is null)
        {
            user = await userManager.FindByEmailAsync(email);

            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    Email = email,
                    EmailConfirmed = true,
                    ExternalAuthId = subject
                };

                var createResult =
                    await userManager.CreateAsync(user);

                if (!createResult.Succeeded)
                {
                    logger.LogError(
                        "Could not create local user for Clerk {Subject}.",
                        subject
                    );

                    context.Response.StatusCode =
                        StatusCodes.Status500InternalServerError;

                    return;
                }
            }
            else if (
                user.ExternalAuthId is not null &&
                user.ExternalAuthId != subject
            )
            {
                context.Response.StatusCode =
                    StatusCodes.Status403Forbidden;

                return;
            }
            else
            {
                user.ExternalAuthId = subject;

                var updateResult =
                    await userManager.UpdateAsync(user);

                if (!updateResult.Succeeded)
                {
                    context.Response.StatusCode =
                        StatusCodes.Status500InternalServerError;

                    return;
                }
            }

            var loginResult = await userManager.AddLoginAsync(
                user,
                new UserLoginInfo(
                    "Clerk",
                    subject,
                    "Clerk"
                )
            );

            if (!loginResult.Succeeded)
            {
                context.Response.StatusCode =
                    StatusCodes.Status500InternalServerError;

                return;
            }
        }

        if (context.User.Identity is ClaimsIdentity identity)
        {
            identity.AddClaim(
                new Claim(
                    "local_user_id",
                    user.Id.ToString()
                )
            );
        }

        await next(context);
    }
}