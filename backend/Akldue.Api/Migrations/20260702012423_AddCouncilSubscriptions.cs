using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Akldue.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCouncilSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CouncilProperties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CouncilAddressId = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Address = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    PropertyId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CouncilProperties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CouncilProperties_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CouncilSubscriptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserCouncilPropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    NextDueDate = table.Column<DateOnly>(type: "date", nullable: false),
                    LastSyncedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CouncilSubscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CouncilSubscriptions_CouncilProperties_UserCouncilPropertyId",
                        column: x => x.UserCouncilPropertyId,
                        principalTable: "CouncilProperties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CouncilProperties_UserId",
                table: "CouncilProperties",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CouncilSubscriptions_UserCouncilPropertyId_ServiceType",
                table: "CouncilSubscriptions",
                columns: new[] { "UserCouncilPropertyId", "ServiceType" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CouncilSubscriptions");

            migrationBuilder.DropTable(
                name: "CouncilProperties");
        }
    }
}
