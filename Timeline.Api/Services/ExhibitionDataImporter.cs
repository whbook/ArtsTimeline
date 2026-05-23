using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Stream = Timeline.Api.Models.Stream;

namespace Timeline.Api.Services;

public class ImportLegacyResult
{
    public int ExhibitionsCount { get; set; }
    public List<ExhibitionImportReport> Reports { get; set; } = [];
}

public class ExhibitionImportReport
{
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int PeriodsImported { get; set; }
    public int StreamsImported { get; set; }
    public int EventsImported { get; set; }
}

public class ExhibitionDataImporter
{
    private readonly TimelineDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<ExhibitionDataImporter> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public ExhibitionDataImporter(TimelineDbContext db, IConfiguration config, ILogger<ExhibitionDataImporter> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task<ImportLegacyResult> ImportAllAsync(CancellationToken ct = default)
    {
        var result = new ImportLegacyResult();
        var dataRoot = ResolveDataRoot();
        if (dataRoot is null)
        {
            _logger.LogError("未找到 ArtsTimeline public/data 目录，无法导入历史数据");
            throw new DirectoryNotFoundException("未找到 ArtsTimeline public/data 目录");
        }

        var exhibitions = await _db.Exhibitions.ToListAsync(ct);
        result.ExhibitionsCount = exhibitions.Count;

        foreach (var ex in exhibitions)
        {
            var report = new ExhibitionImportReport
            {
                Slug = ex.Slug,
                Title = ex.TitleCn
            };

            try
            {
                await ImportSingleExhibitionAsync(ex, dataRoot, report, ct);
                report.Success = true;
            }
            catch (Exception e)
            {
                _logger.LogError(e, "导入展览 {Slug} 失败", ex.Slug);
                report.Success = false;
                report.ErrorMessage = e.Message;
            }

            result.Reports.Add(report);
        }

        return result;
    }

    private async Task ImportSingleExhibitionAsync(Exhibition ex, string dataRoot, ExhibitionImportReport report, CancellationToken ct)
    {
        var topicDir = Path.Combine(dataRoot, ex.Slug);
        if (!Directory.Exists(topicDir))
        {
            throw new DirectoryNotFoundException($"未找到展览目录: {topicDir}");
        }

        // 按正确依存顺序，彻底清理该展览已存在的具体数据（避免主键冲突）
        await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM timeline.timeline_events WHERE exhibition_id = {0}", ex.Id);
        await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM timeline.streams WHERE exhibition_id = {0}", ex.Id);
        await _db.Database.ExecuteSqlRawAsync(
            "DELETE FROM timeline.periods WHERE exhibition_id = {0}", ex.Id);
        
        // 1. 导入 periods.json
        var periodsPath = Path.Combine(topicDir, "periods.json");
        var periodList = new List<Period>();
        if (File.Exists(periodsPath))
        {
            var json = await File.ReadAllTextAsync(periodsPath, ct);
            var nodes = JsonSerializer.Deserialize<List<JsonElement>>(json, JsonOptions) ?? [];
            foreach (var node in nodes)
            {
                var period = new Period
                {
                    Id = node.GetProperty("id").GetString() ?? string.Empty,
                    ExhibitionId = ex.Id,
                    NameCn = node.TryGetProperty("nameCn", out var nc) ? nc.GetString() ?? string.Empty : string.Empty,
                    NameEn = node.TryGetProperty("nameEn", out var ne) ? ne.GetString() ?? string.Empty : string.Empty,
                    ColorHex = node.TryGetProperty("colorHex", out var ch) ? ch.GetString() ?? string.Empty : string.Empty,
                    ColorBackground = node.TryGetProperty("colorBackground", out var cb) ? cb.GetString() ?? string.Empty : string.Empty,
                    Description = node.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                    Start = ParseFuzzyDate(node.GetProperty("start")),
                    End = ParseFuzzyDate(node.GetProperty("end"))
                };
                periodList.Add(period);
            }

            if (periodList.Count > 0)
            {
                _db.Periods.AddRange(periodList);
                await _db.SaveChangesAsync(ct);
                report.PeriodsImported = periodList.Count;
            }
        }

        // 2. 导入 streams.json
        var streamsPath = Path.Combine(topicDir, "streams.json");
        var streamList = new List<Stream>();
        if (File.Exists(streamsPath))
        {
            var json = await File.ReadAllTextAsync(streamsPath, ct);
            var nodes = JsonSerializer.Deserialize<List<JsonElement>>(json, JsonOptions) ?? [];
            foreach (var node in nodes)
            {
                var periodId = GetStringOrNull(node, "periodId");
                // 校验外键有效性
                if (periodId is not null && !periodList.Any(p => p.Id == periodId))
                {
                    _logger.LogWarning("展览 {Slug} 的流派泳道 {StreamId} 关联了不存在的分期 {PeriodId}，已自动置空关联", ex.Slug, node.GetProperty("id").GetString(), periodId);
                    periodId = null;
                }

                var stream = new Stream
                {
                    Id = node.GetProperty("id").GetString() ?? string.Empty,
                    ExhibitionId = ex.Id,
                    PeriodId = periodId,
                    NameCn = node.TryGetProperty("nameCn", out var nc) ? nc.GetString() ?? string.Empty : string.Empty,
                    NameEn = node.TryGetProperty("nameEn", out var ne) ? ne.GetString() ?? string.Empty : string.Empty,
                    Color = node.TryGetProperty("color", out var col) ? col.GetString() ?? string.Empty : string.Empty,
                    Lane = node.TryGetProperty("lane", out var ln) ? ln.GetInt32() : 0,
                    DescriptionCn = node.TryGetProperty("descriptionCn", out var dc) ? dc.GetString() : null,
                    DescriptionEn = node.TryGetProperty("descriptionEn", out var de) ? de.GetString() : null,
                    Start = ParseFuzzyDate(node.GetProperty("start")),
                    End = ParseFuzzyDate(node.GetProperty("end"))
                };
                streamList.Add(stream);
            }

            if (streamList.Count > 0)
            {
                _db.Streams.AddRange(streamList);
                await _db.SaveChangesAsync(ct);
                report.StreamsImported = streamList.Count;
            }
        }

        // 3. 导入 events
        var eventList = new List<TimelineEvent>();
        if (ex.Chunked)
        {
            var manifestPath = Path.Combine(topicDir, "manifest.json");
            if (!File.Exists(manifestPath))
            {
                throw new FileNotFoundException($"分块加载的展览缺少 manifest.json: {manifestPath}");
            }

            var manifestJson = await File.ReadAllTextAsync(manifestPath, ct);
            using var manifestDoc = JsonDocument.Parse(manifestJson);
            var chunks = manifestDoc.RootElement.GetProperty("chunks");
            foreach (var chunk in chunks.EnumerateArray())
            {
                var fileRelPath = chunk.GetProperty("file").GetString() ?? string.Empty;
                var chunkPath = Path.Combine(topicDir, fileRelPath);
                if (File.Exists(chunkPath))
                {
                    var chunkJson = await File.ReadAllTextAsync(chunkPath, ct);
                    var events = ParseEventsJson(chunkJson, ex.Id, periodList, streamList, ex.Slug);
                    eventList.AddRange(events);
                }
            }
        }
        else
        {
            var eventsPath = Path.Combine(topicDir, "events.json");
            if (File.Exists(eventsPath))
            {
                var json = await File.ReadAllTextAsync(eventsPath, ct);
                var events = ParseEventsJson(json, ex.Id, periodList, streamList, ex.Slug);
                eventList.AddRange(events);
            }
        }

        if (eventList.Count > 0)
        {
            // 确保没有因合并分块造成的重复 event_id
            var deduped = eventList.GroupBy(x => x.Id).Select(g => g.First()).ToList();
            _db.TimelineEvents.AddRange(deduped);
            await _db.SaveChangesAsync(ct);
            report.EventsImported = deduped.Count;
        }
    }

    private List<TimelineEvent> ParseEventsJson(string json, Guid exhibitionId, List<Period> periodList, List<Stream> streamList, string slug)
    {
        var result = new List<TimelineEvent>();
        var nodes = JsonSerializer.Deserialize<List<JsonElement>>(json, JsonOptions) ?? [];
        foreach (var node in nodes)
        {
            var periodId = GetStringOrNull(node, "periodId");
            // 校验外键存在
            if (periodId is not null && !periodList.Any(p => p.Id == periodId))
            {
                _logger.LogWarning("展览 {Slug} 的事件卡片 {EventId} 关联了不存在的分期 {PeriodId}，已自动置空关联", slug, node.GetProperty("id").GetString(), periodId);
                periodId = null;
            }

            var streamId = GetStringOrNull(node, "streamId");
            // 校验外键存在
            if (streamId is not null && !streamList.Any(s => s.Id == streamId))
            {
                _logger.LogWarning("展览 {Slug} 的事件卡片 {EventId} 关联了不存在的流派泳道 {StreamId}，已自动置空关联", slug, node.GetProperty("id").GetString(), streamId);
                streamId = null;
            }

            var ev = new TimelineEvent
            {
                Id = node.GetProperty("id").GetString() ?? string.Empty,
                ExhibitionId = exhibitionId,
                PeriodId = periodId,
                StreamId = streamId,
                TitleCn = node.TryGetProperty("titleCn", out var tc) ? tc.GetString() ?? string.Empty : string.Empty,
                TitleEn = node.TryGetProperty("titleEn", out var te) ? te.GetString() ?? string.Empty : string.Empty,
                CreatorCn = node.TryGetProperty("creatorCn", out var cc) ? cc.GetString() : null,
                CreatorEn = node.TryGetProperty("creatorEn", out var ce) ? ce.GetString() : null,
                Location = node.TryGetProperty("location", out var loc) ? loc.GetString() : null,
                ImageUrl = node.TryGetProperty("imageUrl", out var img) ? img.GetString() : null,
                DetailPageUrl = node.TryGetProperty("detailPageUrl", out var dp) ? dp.GetString() : null,
                HighResImageUrl = node.TryGetProperty("highResImageUrl", out var hr) ? hr.GetString() : null,
                DescriptionCn = node.TryGetProperty("descriptionCn", out var dc) ? dc.GetString() : null,
                DescriptionEn = node.TryGetProperty("descriptionEn", out var de) ? de.GetString() : null,
                Importance = node.TryGetProperty("importance", out var imp) ? imp.GetInt32() : 3,
                Date = ParseFuzzyDate(node.GetProperty("date")),
                EndDate = node.TryGetProperty("endDate", out var ed) && ed.ValueKind != JsonValueKind.Null ? ParseFuzzyDate(ed) : null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // 解析 Tags
            if (node.TryGetProperty("tags", out var tagsProp) && tagsProp.ValueKind == JsonValueKind.Array)
            {
                ev.Tags = JsonSerializer.Deserialize<List<string>>(tagsProp.GetRawText(), JsonOptions) ?? [];
            }

            // 解析 Meta
            if (node.TryGetProperty("meta", out var metaProp) && metaProp.ValueKind == JsonValueKind.Object)
            {
                ev.MetaJson = metaProp.GetRawText();
            }
            else
            {
                ev.MetaJson = "{}";
            }

            result.Add(ev);
        }
        return result;
    }

    private static string? GetStringOrNull(JsonElement node, string propertyName)
    {
        if (node.TryGetProperty(propertyName, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.Null) return null;
            var val = prop.GetString();
            return string.IsNullOrWhiteSpace(val) ? null : val;
        }
        return null;
    }

    private FuzzyDate ParseFuzzyDate(JsonElement node)
    {
        var fuzzy = new FuzzyDate
        {
            Year = node.GetProperty("year").GetInt32(),
            Month = node.TryGetProperty("month", out var m) && m.ValueKind == JsonValueKind.Number ? m.GetByte() : null,
            Day = node.TryGetProperty("day", out var d) && d.ValueKind == JsonValueKind.Number ? d.GetByte() : null,
            Accuracy = node.TryGetProperty("accuracy", out var acc) ? acc.GetString() ?? "exact" : "exact",
            OrYear = node.TryGetProperty("orYear", out var oy) && oy.ValueKind == JsonValueKind.Number ? oy.GetInt32() : null,
            OrMonth = node.TryGetProperty("orMonth", out var om) && om.ValueKind == JsonValueKind.Number ? om.GetByte() : null,
            OrDay = node.TryGetProperty("orDay", out var od) && od.ValueKind == JsonValueKind.Number ? od.GetByte() : null
        };
        return fuzzy;
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
