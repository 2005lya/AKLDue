namespace Akldue.Api.Models;

public class UserCouncilProperty
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string CouncilAddressId { get; set; }

    public required string Address { get; set; }

    public required string PropertyId { get; set; }

    public bool RatesSubscribed { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;

    public List<CouncilSubscription> Subscriptions { get; set; }
        = [];
}
