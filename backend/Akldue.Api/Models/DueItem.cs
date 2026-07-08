namespace Akldue.Api.Models;

public class DueItem
{
    public Guid Id { get; set; }

    public Guid? UserId { get; set; }

    public required string Title { get; set; }

    public required string Source { get; set; }

    public DateOnly DueDate { get; set; }

    public required string RepeatUnit { get; set; }

    public List<DateOnly> ExcludedDates { get; set; } = [];

    public DateTimeOffset CreatedAtUtc { get; set; }

}