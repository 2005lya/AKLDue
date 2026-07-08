using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;
using AngleSharp.Html.Parser;

namespace Akldue.Api.Services;

public class CouncilAddressClient(
    HttpClient httpClient,
    IMemoryCache cache
)
{
    private const string QueryUrl =
        "https://services1.arcgis.com/n4yPwebTjJCmXB6W/" +
        "arcgis/rest/services/AC_Property_Query/" +
        "FeatureServer/0/query";

    private const string CollectionUrl =
    "https://www.aucklandcouncil.govt.nz/en/" +
    "rubbish-recycling/rubbish-recycling-collections/" +
    "rubbish-recycling-collection-days";

    public async Task<IReadOnlyList<CouncilAddress>> SearchAsync(
        string query,
        CancellationToken cancellationToken
    )
    {
        var normalized = Regex.Replace(
            query.Trim(),
            @"[^\p{L}\p{N}/'\-\s]",
            " "
        );

        normalized = Regex.Replace(normalized, @"\s+", " ");

        if (normalized.Length < 3)
        {
            return [];
        }

        var cacheKey =
            $"council-address:{normalized.ToUpperInvariant()}";

        if (
            cache.TryGetValue(
                cacheKey,
                out IReadOnlyList<CouncilAddress>? cached
            ) &&
            cached is not null
        )
        {
            return cached;
        }

        var tokens = normalized
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(token =>
                token.Replace("'", "''").ToUpperInvariant()
            );

        var addressFilter = string.Join(
            " AND ",
            tokens.Select(token =>
                $"UPPER(FORMATTEDADDRESS) LIKE '%{token}%'"
            )
        );

        var where =
            $"{addressFilter} AND SITESTATUS = 'Current' " +
            "AND ACRATEACCOUNTKEY IS NOT NULL " +
            "AND ACRATEACCOUNTKEY <> 'Unknown'";

        var url =
            QueryUrl +
            $"?where={Uri.EscapeDataString(where)}" +
            "&outFields=FORMATTEDADDRESS,PROPERTYID,ACRATEACCOUNTKEY" +
            "&returnGeometry=false" +
            "&resultRecordCount=10" +
            "&orderByFields=FORMATTEDADDRESS" +
            "&f=json";

        var response =
            await httpClient.GetFromJsonAsync<ArcGisResponse>(
                url,
                cancellationToken
            );

        if (response is null || response.Error is not null)
        {
            throw new HttpRequestException(
                "Council address data is unavailable."
            );
        }

        var results = response.Features
            .Where(feature =>
                !string.IsNullOrWhiteSpace(
                    feature.Attributes.RateAccountKey
                ) &&
                !string.IsNullOrWhiteSpace(
                    feature.Attributes.FormattedAddress
                )
            )
            .Select(feature => new CouncilAddress(
                feature.Attributes.RateAccountKey!,
                feature.Attributes.FormattedAddress!,
                feature.Attributes.PropertyId ?? ""
            ))
            .DistinctBy(address => address.Id)
            .Take(10)
            .ToList();

        cache.Set(cacheKey, results, TimeSpan.FromMinutes(10));

        return results;
    }


    public async Task<IReadOnlyList<CollectionService>>
    GetCollectionServicesAsync(
        string id,
        CancellationToken cancellationToken
    )
    {
        if (!Regex.IsMatch(id, @"^\d{8,20}$"))
        {
            throw new ArgumentException("Invalid Council ID.");
        }

        var cacheKey = $"council-collections:{id}";

        if (
            cache.TryGetValue(
                cacheKey,
                out IReadOnlyList<CollectionService>? cached
            ) &&
            cached is not null
        )
        {
            return cached;
        }

        var url = $"{CollectionUrl}/{id}.html";

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            url
        );

        request.Headers.Accept.ParseAdd(
            "text/html,application/xhtml+xml"
        );

        request.Headers.UserAgent.ParseAdd("AKLDue/0.1");

        using var response = await httpClient.SendAsync(
            request,
            cancellationToken
        );

        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync(
            cancellationToken
        );

        var document = new HtmlParser().ParseDocument(html);
        var services = new List<CollectionService>();

        var collectionCard = document.QuerySelector(
        ".acpl-schedule-card"
    );

        if (collectionCard is null)
        {
            throw new HttpRequestException(
                "Collection schedule was not found."
            );
        }

        foreach (
            var row in collectionCard.QuerySelectorAll(
                ".card-body p.mb-0.lead"
            )
        )
        {
            var label = row.TextContent
        .Split(':', 2)[0]
        .Replace("\uFEFF", "")
        .Trim();
            var dateText = row.QuerySelector("b")?.TextContent.Trim();

            if (string.IsNullOrWhiteSpace(dateText))
            {
                continue;
            }

            var type = label switch
            {
                "Rubbish" => "rubbish",
                "Food scraps" => "foodScraps",
                "Recycling" => "recycling",
                _ => null
            };

            if (type is null)
            {
                continue;
            }

            services.Add(new CollectionService(
                type,
                label,
                ParseCollectionDate(dateText)
            ));
        }

        if (services.Count == 0)
        {
            throw new HttpRequestException(
                "No collection services were found."
            );
        }

        cache.Set(
            cacheKey,
            services,
            TimeSpan.FromHours(6)
        );

        return services;
    }

    private static DateOnly ParseCollectionDate(string value)
    {
        var culture = CultureInfo.GetCultureInfo("en-NZ");

        var formats = new[]
        {
        "dddd, d MMMM",
        "dddd, dd MMMM"
    };

        if (
            !DateTime.TryParseExact(
                value,
                formats,
                culture,
                DateTimeStyles.AllowWhiteSpaces,
                out var parsed
            )
        )
        {
            throw new HttpRequestException(
                $"Unknown Council date format: {value}"
            );
        }

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(
            "Pacific/Auckland"
        );

        var today = TimeZoneInfo.ConvertTime(
            DateTimeOffset.UtcNow,
            timeZone
        ).Date;

        var result = new DateTime(
            today.Year,
            parsed.Month,
            parsed.Day
        );

        if (result.Date < today.AddDays(-1))
        {
            result = result.AddYears(1);
        }

        return DateOnly.FromDateTime(result);
    }
    private sealed record ArcGisResponse(
        IReadOnlyList<ArcGisFeature> Features,
        ArcGisError? Error
    );

    private sealed record ArcGisFeature(
        ArcGisAttributes Attributes
    );

    private sealed record ArcGisAttributes(
        [property: JsonPropertyName("FORMATTEDADDRESS")]
        string? FormattedAddress,

        [property: JsonPropertyName("PROPERTYID")]
        string? PropertyId,

        [property: JsonPropertyName("ACRATEACCOUNTKEY")]
        string? RateAccountKey
    );

    private sealed record ArcGisError(string Message);
}

public record CouncilAddress(
    string Id,
    string Address,
    string PropertyId
);

public record CollectionService(
    string Type,
    string Title,
    DateOnly DueDate
);