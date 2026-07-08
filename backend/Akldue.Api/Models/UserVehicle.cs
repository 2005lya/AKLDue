namespace Akldue.Api.Models;

public class UserVehicle
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string Plate { get; set; }

    public DateOnly? RegoExpiryDate { get; set; }

    public DateOnly? WofExpiryDate { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;
}