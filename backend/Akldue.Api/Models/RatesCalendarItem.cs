namespace Akldue.Api.Models;

public class RatesCalendarItem
{
    public Guid Id { get; set; }

    public required string RatingYear { get; set; }

    public int InstalmentNumber { get; set; }

    public DateOnly DueDate { get; set; }

    public bool IsPublished { get; set; }

    public DateTimeOffset UpdatedAtUtc { get; set; }
        = DateTimeOffset.UtcNow;
}
