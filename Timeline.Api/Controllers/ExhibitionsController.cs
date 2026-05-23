using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/exhibitions")]
public class ExhibitionsController : ApiControllerBase
{
    private readonly TimelineDbContext _db;
    private readonly AuditLogService _audit;

    public ExhibitionsController(TimelineDbContext db, AuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpPost("sync-from-data")]
    public async Task<ActionResult<ExhibitionSyncResult>> SyncFromData(
        [FromServices] ExhibitionAutoSeeder seeder, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        await seeder.SeedAsync(true, ct);
        var count = await _db.Exhibitions.CountAsync(ct);
        return Ok(new ExhibitionSyncResult(count, $"已从 public/data 同步 {count} 个展览主题"));
    }

    [HttpGet]
    public async Task<ActionResult<List<ExhibitionListItemResponse>>> List(CancellationToken ct)
    {
        var items = await _db.Exhibitions.AsNoTracking()
            .OrderBy(e => e.SortOrder)
            .Select(e => new ExhibitionListItemResponse(
                e.Id, e.Slug, e.TitleCn, e.TitleEn, e.Description, e.Color, e.SortOrder,
                e.IsPublished, e.PlaybackSpeed, e.Chunked, e.InitialZoom, e.MinZoomRange, e.MaxZoomRange,
                e.DefaultViewportStartYear, e.DefaultViewportEndYear))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ExhibitionResponse>> Get(Guid id, CancellationToken ct)
    {
        var e = await _db.Exhibitions.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return e is null ? NotFound() : Ok(EntityMapper.ToResponse(e));
    }

    [HttpPost]
    public async Task<ActionResult<ExhibitionResponse>> Create([FromBody] CreateExhibitionRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        try { EntityMapper.ValidateExhibition(request); }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }
        if (await _db.Exhibitions.AnyAsync(e => e.Slug == request.Slug, ct))
            return BadRequest("展览 slug 已存在");

        var entity = new Exhibition
        {
            Id = Guid.NewGuid(),
            ContentVersion = 1,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        EntityMapper.ApplyExhibition(entity, request);
        _db.Exhibitions.Add(entity);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Create, AuditEntityTypes.Exhibition,
            entity.Id, entity.TitleCn, $"创建展览 [{entity.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return CreatedAtAction(nameof(Get), new { id = entity.Id }, EntityMapper.ToResponse(entity));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ExhibitionResponse>> Update(Guid id, [FromBody] UpdateExhibitionRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        try { EntityMapper.ValidateExhibition(request); }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }

        var entity = await _db.Exhibitions.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (entity is null) return NotFound();
        if (entity.Slug != request.Slug && await _db.Exhibitions.AnyAsync(e => e.Slug == request.Slug && e.Id != id, ct))
            return BadRequest("展览 slug 已存在");

        EntityMapper.ApplyExhibition(entity, request);
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Update, AuditEntityTypes.Exhibition,
            entity.Id, entity.TitleCn, $"更新展览 [{entity.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(EntityMapper.ToResponse(entity));
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder([FromBody] ExhibitionReorderRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        var ids = request.Items.Select(i => i.Id).ToList();
        var exhibitions = await _db.Exhibitions.Where(e => ids.Contains(e.Id)).ToListAsync(ct);
        foreach (var item in request.Items)
        {
            var e = exhibitions.FirstOrDefault(x => x.Id == item.Id);
            if (e is not null)
            {
                e.SortOrder = item.SortOrder;
                e.UpdatedAt = DateTime.UtcNow;
            }
        }
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
