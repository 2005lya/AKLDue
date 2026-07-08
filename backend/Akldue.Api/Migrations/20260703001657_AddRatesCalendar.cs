using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Akldue.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRatesCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RatesSubscribed",
                table: "CouncilProperties",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "RatesCalendar",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RatingYear = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    InstalmentNumber = table.Column<int>(type: "integer", nullable: false),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatesCalendar", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "RatesCalendar",
                columns: new[] { "Id", "DueDate", "InstalmentNumber", "IsPublished", "RatingYear", "UpdatedAtUtc" },
                values: new object[,]
                {
                    { new Guid("64ca07d8-3436-4b86-a3aa-8eaf73cb1e01"), new DateOnly(2026, 8, 31), 1, true, "2026/2027", new DateTimeOffset(new DateTime(2026, 6, 29, 20, 53, 11, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("64ca07d8-3436-4b86-a3aa-8eaf73cb1e02"), new DateOnly(2026, 11, 30), 2, true, "2026/2027", new DateTimeOffset(new DateTime(2026, 6, 29, 20, 53, 11, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("64ca07d8-3436-4b86-a3aa-8eaf73cb1e03"), new DateOnly(2027, 2, 26), 3, true, "2026/2027", new DateTimeOffset(new DateTime(2026, 6, 29, 20, 53, 11, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
                    { new Guid("64ca07d8-3436-4b86-a3aa-8eaf73cb1e04"), new DateOnly(2027, 5, 31), 4, true, "2026/2027", new DateTimeOffset(new DateTime(2026, 6, 29, 20, 53, 11, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_RatesCalendar_RatingYear_InstalmentNumber",
                table: "RatesCalendar",
                columns: new[] { "RatingYear", "InstalmentNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RatesCalendar");

            migrationBuilder.DropColumn(
                name: "RatesSubscribed",
                table: "CouncilProperties");
        }
    }
}
