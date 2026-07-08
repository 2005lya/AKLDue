using Akldue.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace Akldue.Api.Data;

public class AppDbContext(
    DbContextOptions<AppDbContext> options
) : IdentityDbContext<
    ApplicationUser,
    IdentityRole<Guid>,
    Guid
>(options)
{
    public DbSet<DueItem> Dues => Set<DueItem>();

    public DbSet<UserCouncilProperty> CouncilProperties =>
    Set<UserCouncilProperty>();

    public DbSet<CouncilSubscription> CouncilSubscriptions =>
    Set<CouncilSubscription>();

    public DbSet<RatesCalendarItem> RatesCalendar =>
        Set<RatesCalendarItem>();

    public DbSet<UserVehicle> Vehicles =>
    Set<UserVehicle>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DueItem>(entity =>
        {
            entity.HasKey(due => due.Id);

            entity.Property(due => due.Title)
                .HasMaxLength(160)
                .IsRequired();

            entity.Property(due => due.Source)
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(due => due.RepeatUnit)
                .HasMaxLength(20)
                .IsRequired();

            entity.HasIndex(due => new
            {
                due.UserId,
                due.DueDate
            });

            entity.HasOne<ApplicationUser>()
    .WithMany()
    .HasForeignKey(due => due.UserId)
    .OnDelete(DeleteBehavior.Cascade);

            entity.Property(due => due.ExcludedDates)
                 .HasColumnType("date[]")
                 .HasDefaultValueSql("'{}'::date[]")
                 .IsRequired();
        });

        modelBuilder.Entity<UserCouncilProperty>(entity =>
{
    entity.HasKey(property => property.Id);

    entity.Property(property => property.CouncilAddressId)
        .HasMaxLength(30)
        .IsRequired();

    entity.Property(property => property.Address)
        .HasMaxLength(300)
        .IsRequired();

    entity.Property(property => property.PropertyId)
        .HasMaxLength(50)
        .IsRequired();

    entity.HasIndex(property => property.UserId)
        .IsUnique();

    entity.HasOne<ApplicationUser>()
        .WithOne()
        .HasForeignKey<UserCouncilProperty>(
            property => property.UserId
        )
        .OnDelete(DeleteBehavior.Cascade);

    entity.HasMany(property => property.Subscriptions)
        .WithOne()
        .HasForeignKey(
            subscription =>
                subscription.UserCouncilPropertyId
        )
        .OnDelete(DeleteBehavior.Cascade);
});

        modelBuilder.Entity<CouncilSubscription>(entity =>
        {
            entity.HasKey(subscription => subscription.Id);

            entity.Property(subscription => subscription.ServiceType)
                .HasMaxLength(30)
                .IsRequired();

            entity.HasIndex(subscription => new
            {
                subscription.UserCouncilPropertyId,
                subscription.ServiceType
            }).IsUnique();
        });

        modelBuilder.Entity<RatesCalendarItem>(entity =>
        {
            entity.HasKey(item => item.Id);

            entity.Property(item => item.RatingYear)
                .HasMaxLength(20)
                .IsRequired();

            entity.HasIndex(item => new
            {
                item.RatingYear,
                item.InstalmentNumber
            }).IsUnique();

            entity.HasData(
                new RatesCalendarItem
                {
                    Id = Guid.Parse("64ca07d8-3436-4b86-a3aa-8eaf73cb1e01"),
                    RatingYear = "2026/2027",
                    InstalmentNumber = 1,
                    DueDate = new DateOnly(2026, 8, 31),
                    IsPublished = true,
                    UpdatedAtUtc = new DateTimeOffset(
                        2026, 6, 29, 20, 53, 11, TimeSpan.Zero
                    )
                },
                new RatesCalendarItem
                {
                    Id = Guid.Parse("64ca07d8-3436-4b86-a3aa-8eaf73cb1e02"),
                    RatingYear = "2026/2027",
                    InstalmentNumber = 2,
                    DueDate = new DateOnly(2026, 11, 30),
                    IsPublished = true,
                    UpdatedAtUtc = new DateTimeOffset(
                        2026, 6, 29, 20, 53, 11, TimeSpan.Zero
                    )
                },
                new RatesCalendarItem
                {
                    Id = Guid.Parse("64ca07d8-3436-4b86-a3aa-8eaf73cb1e03"),
                    RatingYear = "2026/2027",
                    InstalmentNumber = 3,
                    DueDate = new DateOnly(2027, 2, 26),
                    IsPublished = true,
                    UpdatedAtUtc = new DateTimeOffset(
                        2026, 6, 29, 20, 53, 11, TimeSpan.Zero
                    )
                },
                new RatesCalendarItem
                {
                    Id = Guid.Parse("64ca07d8-3436-4b86-a3aa-8eaf73cb1e04"),
                    RatingYear = "2026/2027",
                    InstalmentNumber = 4,
                    DueDate = new DateOnly(2027, 5, 31),
                    IsPublished = true,
                    UpdatedAtUtc = new DateTimeOffset(
                        2026, 6, 29, 20, 53, 11, TimeSpan.Zero
                    )
                }
            );
        });

        modelBuilder.Entity<UserVehicle>(entity =>
{
    entity.HasKey(vehicle => vehicle.Id);

    entity.Property(vehicle => vehicle.Plate)
        .HasMaxLength(10)
        .IsRequired();

    entity.HasIndex(vehicle => new
    {
        vehicle.UserId,
        vehicle.Plate
    }).IsUnique();

    entity.HasOne<ApplicationUser>()
        .WithMany()
        .HasForeignKey(vehicle => vehicle.UserId)
        .OnDelete(DeleteBehavior.Cascade);
});

modelBuilder.Entity<ApplicationUser>(entity =>
{
    entity.Property(user => user.ExternalAuthId)
        .HasMaxLength(128);

    entity.HasIndex(user => user.ExternalAuthId)
        .IsUnique();
});
    }
}
