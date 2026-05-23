using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Timeline.Api.Models;

namespace Timeline.Api.Services;

public class ExhibitionDataFileWriter
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IConfiguration _config;
    private readonly ILogger<ExhibitionDataFileWriter> _logger;

    public ExhibitionDataFileWriter(IConfiguration config, ILogger<ExhibitionDataFileWriter> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task WriteTopicAsync(Exhibition exhibition, CancellationToken ct = default)
    {
        var dataRoot = ResolveDataRoot();
        if (dataRoot is null)
        {
            _logger.LogWarning("未找到 ArtsTimeline public/data 目录，跳过写入展览 topic.json");
            return;
        }

        var topicDir = Path.Combine(dataRoot, exhibition.Slug);
        Directory.CreateDirectory(topicDir);

        var eventFields = JsonNode.Parse(exhibition.EventFieldsJson) ?? new JsonArray();
        var topic = new JsonObject
        {
            ["id"] = exhibition.Slug,
            ["titleEn"] = exhibition.TitleEn,
            ["titleCn"] = exhibition.TitleCn,
            ["description"] = exhibition.Description ?? string.Empty,
            ["color"] = exhibition.Color,
            ["defaultViewport"] = new JsonObject
            {
                ["startYear"] = exhibition.DefaultViewportStartYear,
                ["endYear"] = exhibition.DefaultViewportEndYear
            },
            ["minZoomRange"] = exhibition.MinZoomRange,
            ["maxZoomRange"] = exhibition.MaxZoomRange,
            ["playbackSpeed"] = exhibition.PlaybackSpeed,
            ["chunked"] = exhibition.Chunked,
            ["eventFields"] = eventFields
        };

        await File.WriteAllTextAsync(
            Path.Combine(topicDir, "topic.json"),
            topic.ToJsonString(JsonOptions) + Environment.NewLine,
            ct);
    }

    public async Task WriteIndexAsync(IEnumerable<Exhibition> exhibitions, CancellationToken ct = default)
    {
        var dataRoot = ResolveDataRoot();
        if (dataRoot is null)
        {
            _logger.LogWarning("未找到 ArtsTimeline public/data 目录，跳过写入展览 index.json");
            return;
        }

        var index = new JsonArray();
        foreach (var exhibition in exhibitions.Where(e => e.IsPublished).OrderBy(e => e.SortOrder))
        {
            index.Add(new JsonObject
            {
                ["id"] = exhibition.Slug,
                ["titleCn"] = exhibition.TitleCn,
                ["titleEn"] = exhibition.TitleEn,
                ["color"] = exhibition.Color
            });
        }

        await File.WriteAllTextAsync(
            Path.Combine(dataRoot, "index.json"),
            index.ToJsonString(JsonOptions) + Environment.NewLine,
            ct);
    }

    private string? ResolveDataRoot()
    {
        var configured = _config["ArtsTimeline:DataRoot"];
        if (!string.IsNullOrWhiteSpace(configured) && Directory.Exists(configured))
            return configured;

        var candidates = new[]
        {
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "public", "data")),
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "public", "data")),
            Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "public", "data")),
            @"D:\Codes\ArtsTimeline\public\data"
        };

        return candidates.FirstOrDefault(Directory.Exists);
    }
}
