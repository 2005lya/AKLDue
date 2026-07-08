using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Akldue.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDueOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Dues_DueDate",
                table: "Dues");

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "Dues",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Dues_UserId_DueDate",
                table: "Dues",
                columns: new[] { "UserId", "DueDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_Dues_AspNetUsers_UserId",
                table: "Dues",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Dues_AspNetUsers_UserId",
                table: "Dues");

            migrationBuilder.DropIndex(
                name: "IX_Dues_UserId_DueDate",
                table: "Dues");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Dues");

            migrationBuilder.CreateIndex(
                name: "IX_Dues_DueDate",
                table: "Dues",
                column: "DueDate");
        }
    }
}
