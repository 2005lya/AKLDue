using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Akldue.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExcludedDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<DateOnly>>(
                name: "ExcludedDates",
                table: "Dues",
                type: "date[]",
                nullable: false,
                defaultValueSql: "'{}'::date[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExcludedDates",
                table: "Dues");
        }
    }
}
