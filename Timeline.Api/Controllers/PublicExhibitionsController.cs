using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;
using Timeline.Api.Data;
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
}
