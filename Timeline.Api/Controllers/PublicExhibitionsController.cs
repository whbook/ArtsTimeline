using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Nodes;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;

namespace Timeline.Api.Controllers;

[AllowAnonymous]
[EnableCors("PublicCors")]
[Route("api/public/exhibitions")]
[ApiController]
public class PublicExhibitionsController : ControllerBase
{
    private readonly TimelineDbContext _db;

    public PublicExhibitionsController(TimelineDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<PublicExhibitionListItemResponse>>> List(CancellationToken ct)
    {
        var items = await _db.Exhibitions.AsNoTracking()
            .Where(e => e.IsPublished)
            .OrderBy(e => e.SortOrder)
            .Select(e => new PublicExhibitionListItemResponse(
                e.Slug, e.TitleCn, e.TitleEn, e.Color))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("{slug}/topic")]
    public async Task<ActionResult<PublicExhibitionResponse>> GetTopic(string slug, CancellationToken ct)
    {
        var e = await _db.Exhibitions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Slug.ToLower() == slug.ToLower() && x.IsPublished, ct);

        if (e is null) return NotFound();

        JsonNode eventFields;
        try
        {
            eventFields = JsonNode.Parse(e.EventFieldsJson) ?? new JsonArray();
        }
        catch
        {
            eventFields = new JsonArray();
        }

        var response = new PublicExhibitionResponse(
            e.Slug,
            e.TitleCn,
            e.TitleEn,
            e.Description,
            e.Color,
            new PublicViewport(e.DefaultViewportStartYear, e.DefaultViewportEndYear),
            e.MinZoomRange,
            e.MaxZoomRange,
            e.PlaybackSpeed,
            e.InitialZoom,
            e.Chunked,
            eventFields
        );

        return Ok(response);
    }

    [HttpGet("{slug}/periods")]
    public async Task<IActionResult> GetPeriods(string slug, CancellationToken ct)
    {
        var ex = await _db.Exhibitions.AsNoTracking().FirstOrDefaultAsync(e => e.Slug.ToLower() == slug.ToLower() && e.IsPublished, ct);
        if (ex is null) return NotFound();

        var list = await _db.Periods.AsNoTracking()
            .Where(p => p.ExhibitionId == ex.Id)
            .OrderBy(p => p.Start.Year)
            .ToListAsync(ct);

        var response = list.Select(p => new
        {
            id = p.Id,
            nameCn = p.NameCn,
            nameEn = p.NameEn,
            start = MapFuzzyDateToPublic(p.Start),
            end = MapFuzzyDateToPublic(p.End),
            colorHex = p.ColorHex,
            colorBackground = p.ColorBackground,
            description = p.Description
        });

        return Ok(response);
    }

    [HttpGet("{slug}/streams")]
    public async Task<IActionResult> GetStreams(string slug, CancellationToken ct)
    {
        var ex = await _db.Exhibitions.AsNoTracking().FirstOrDefaultAsync(e => e.Slug.ToLower() == slug.ToLower() && e.IsPublished, ct);
        if (ex is null) return NotFound();

        var list = await _db.Streams.AsNoTracking()
            .Where(s => s.ExhibitionId == ex.Id)
            .OrderBy(s => s.Lane).ThenBy(s => s.Start.Year)
            .ToListAsync(ct);

        var response = list.Select(s => new
        {
            id = s.Id,
            periodId = s.PeriodId,
            nameCn = s.NameCn,
            nameEn = s.NameEn,
            start = MapFuzzyDateToPublic(s.Start),
            end = MapFuzzyDateToPublic(s.End),
            color = s.Color,
            lane = s.Lane,
            descriptionCn = s.DescriptionCn,
            descriptionEn = s.DescriptionEn
        });

        return Ok(response);
    }

    [HttpGet("{slug}/events")]
    public async Task<IActionResult> GetEvents(
        string slug,
        [FromQuery] int? startYear = null,
        [FromQuery] int? endYear = null,
        CancellationToken ct = default)
    {
        var ex = await _db.Exhibitions.AsNoTracking().FirstOrDefaultAsync(e => e.Slug.ToLower() == slug.ToLower() && e.IsPublished, ct);
        if (ex is null) return NotFound();

        var query = _db.TimelineEvents.AsNoTracking().Where(e => e.ExhibitionId == ex.Id);

        // 如果传递了视口过滤条件
        if (startYear.HasValue && endYear.HasValue)
        {
            // 在视口范围内的筛选逻辑：
            // 发生年份在视口之内，或者事件跨度覆盖了视口
            query = query.Where(e => e.Date.Year <= endYear.Value && (e.EndDate == null || e.EndDate.Year >= startYear.Value));
        }

        var list = await query.OrderBy(e => e.Date.Year).ToListAsync(ct);

        var response = list.Select(e => new
        {
            id = e.Id,
            periodId = e.PeriodId,
            streamId = e.StreamId,
            titleCn = e.TitleCn,
            titleEn = e.TitleEn,
            creatorCn = e.CreatorCn,
            creator = e.CreatorEn, // 对应前端的 creator 属性
            location = e.Location,
            imageUrl = e.ImageUrl,
            detailPageUrl = e.DetailPageUrl,
            highResImageUrl = e.HighResImageUrl,
            descriptionCn = e.DescriptionCn,
            descriptionEn = e.DescriptionEn,
            importance = e.Importance,
            tags = e.Tags,
            date = MapFuzzyDateToPublic(e.Date),
            endDate = e.EndDate != null ? MapFuzzyDateToPublic(e.EndDate) : null,
            meta = ParseMetaNode(e.MetaJson)
        });

        return Ok(response);
    }

    #region Helpers

    private static object MapFuzzyDateToPublic(FuzzyDate fd) => new
    {
        year = fd.Year,
        month = fd.Month,
        day = fd.Day,
        accuracy = fd.Accuracy,
        orYear = fd.OrYear,
        orMonth = fd.OrMonth,
        orDay = fd.OrDay
    };

    private static JsonNode ParseMetaNode(string metaJson)
    {
        try
        {
            return JsonNode.Parse(metaJson) ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    #endregion
}
