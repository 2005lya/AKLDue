namespace Akldue.Api.Models;

public class CouncilSubscription
{
    public Guid Id { get; set; }

    public Guid UserCouncilPropertyId { get; set; }

    public required string ServiceType { get; set; }

    public DateOnly NextDueDate { get; set; }

    public DateTimeOffset LastSyncedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;
}