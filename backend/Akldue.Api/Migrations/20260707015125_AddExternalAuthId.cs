using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Akldue.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalAuthId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalAuthId",
                table: "AspNetUsers",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_ExternalAuthId",
                table: "AspNetUsers",
                column: "ExternalAuthId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_AspNetUsers_ExternalAuthId",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "ExternalAuthId",
                table: "AspNetUsers");
        }
    }
}
