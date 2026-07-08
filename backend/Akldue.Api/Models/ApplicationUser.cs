using Microsoft.AspNetCore.Identity;

namespace Akldue.Api.Models;

public class ApplicationUser : IdentityUser<Guid>
{
    public string? ExternalAuthId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;
}