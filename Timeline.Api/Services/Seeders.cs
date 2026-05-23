using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;

namespace Timeline.Api.Services;

public class ExhibitionAutoSeeder
{
    private readonly TimelineDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<ExhibitionAutoSeeder> _logger;

    public ExhibitionAutoSeeder(TimelineDbContext db, IConfiguration config, ILogger<ExhibitionAutoSeeder> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task SeedAsync(bool forceOverwrite = false, CancellationToken ct = default)
    {
        var dataRoot = ResolveDataRoot();
        if (dataRoot is null)
        {
            _logger.LogWarning("未找到 ArtsTimeline public/data 目录，跳过展览种子同步");
            return;
        }

        var indexPath = Path.Combine(dataRoot, "index.json");
        if (!File.Exists(indexPath))
        {
            _logger.LogWarning("未找到 index.json: {Path}", indexPath);
            return;
        }

        using var indexDoc = JsonDocument.Parse(await File.ReadAllTextAsync(indexPath, ct));
        var sort = 0;
        foreach (var item in indexDoc.RootElement.EnumerateArray())
        {
            var slug = item.GetProperty("id").GetString();
            if (string.IsNullOrWhiteSpace(slug)) continue;

            var topicPath = Path.Combine(dataRoot, slug, "topic.json");
            if (!File.Exists(topicPath))
            {
                _logger.LogWarning("缺少 topic.json: {Path}", topicPath);
                continue;
            }

            using var topicDoc = JsonDocument.Parse(await File.ReadAllTextAsync(topicPath, ct));
            var root = topicDoc.RootElement;
            var titleCn = root.TryGetProperty("titleCn", out var tc) ? tc.GetString() ?? slug : slug;
            var titleEn = root.TryGetProperty("titleEn", out var te) ? te.GetString() ?? slug : slug;
            var description = root.TryGetProperty("description", out var desc) ? desc.GetString() : null;
            var color = root.TryGetProperty("color", out var c) ? c.GetString() ?? "#2563eb" : "#2563eb";
            var startYear = root.GetProperty("defaultViewport").GetProperty("startYear").GetInt32();
            var endYear = root.GetProperty("defaultViewport").GetProperty("endYear").GetInt32();
            var minZoom = root.TryGetProperty("minZoomRange", out var minZ) ? minZ.GetDecimal() : 1m;
            var maxZoom = root.TryGetProperty("maxZoomRange", out var maxZ) ? maxZ.GetDecimal() : 10000m;
            var playback = root.TryGetProperty("playbackSpeed", out var ps) ? ps.GetDecimal() : 1m;
            var initialZoom = root.TryGetProperty("initialZoom", out var iz) ? iz.GetDecimal() : 6m;
            var chunked = root.TryGetProperty("chunked", out var ch) && ch.GetBoolean();
            var eventFields = root.TryGetProperty("eventFields", out var ef)
                ? ef.GetRawText()
                : "[]";

            var existing = await _db.Exhibitions.FirstOrDefaultAsync(e => e.Slug == slug, ct);
            if (existing is null)
            {
                _db.Exhibitions.Add(new Exhibition
                {
                    Id = Guid.NewGuid(),
                    Slug = slug,
                    TitleCn = titleCn,
                    TitleEn = titleEn,
                    Description = description,
                    Color = color,
                    SortOrder = sort,
                    IsPublished = true,
                    DefaultViewportStartYear = startYear,
                    DefaultViewportEndYear = endYear,
                    MinZoomRange = minZoom,
                    MaxZoomRange = maxZoom,
                    PlaybackSpeed = playback,
                    InitialZoom = initialZoom,
                    Chunked = chunked,
                    EventFieldsJson = eventFields,
                    ContentVersion = 1,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else if (forceOverwrite)
            {
                existing.TitleCn = titleCn;
                existing.TitleEn = titleEn;
                existing.Description = description;
                existing.Color = color;
                existing.SortOrder = sort;
                existing.DefaultViewportStartYear = startYear;
                existing.DefaultViewportEndYear = endYear;
                existing.MinZoomRange = minZoom;
                existing.MaxZoomRange = maxZoom;
                existing.PlaybackSpeed = playback;
                existing.InitialZoom = initialZoom;
                existing.Chunked = chunked;
                existing.EventFieldsJson = eventFields;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            sort++;
        }

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("展览种子数据已从 {Root} 同步完成", dataRoot);
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

public class BootstrapAdminSeeder
{
    private readonly TimelineDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<BootstrapAdminSeeder> _logger;

    public BootstrapAdminSeeder(TimelineDbContext db, IConfiguration config, ILogger<BootstrapAdminSeeder> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await _db.AdminUsers.AnyAsync(ct)) return;

        var username = _config["BootstrapAdmin:Username"] ?? "admin";
        var password = _config["BootstrapAdmin:Password"] ?? "ChangeMe123!";
        var email = _config["BootstrapAdmin:Email"] ?? "admin@timeline.local";

        _db.AdminUsers.Add(new AdminUser
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = AdminRoles.SuperAdmin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        _logger.LogWarning("已创建初始 super_admin 用户 {Username}，请尽快修改密码", username);
    }
}
