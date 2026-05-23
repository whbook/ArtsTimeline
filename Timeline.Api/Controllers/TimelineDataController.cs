using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/timeline-data")]
[ApiController]
public class TimelineDataController : ApiControllerBase
{
    private readonly TimelineDbContext _db;
    private readonly AuditLogService _audit;

    public TimelineDataController(TimelineDbContext db, AuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    #region Periods (分期)

    [HttpGet("exhibitions/{exhibitionId:guid}/periods")]
    public async Task<ActionResult<List<PeriodDto>>> GetPeriods(Guid exhibitionId, CancellationToken ct)
    {
        var list = await _db.Periods.AsNoTracking()
            .Where(p => p.ExhibitionId == exhibitionId)
            .OrderBy(p => p.Start.Year)
            .Select(p => MapPeriodToDto(p))
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("periods")]
    public async Task<ActionResult<PeriodDto>> CreatePeriod([FromBody] PeriodDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var period = new Period
        {
            Id = Guid.NewGuid(),
            ExhibitionId = dto.ExhibitionId,
            NameCn = dto.NameCn,
            NameEn = dto.NameEn,
            ColorHex = dto.ColorHex,
            ColorBackground = dto.ColorBackground,
            Description = dto.Description,
            Start = MapFuzzyDate(dto.Start),
            End = MapFuzzyDate(dto.End)
        };

        _db.Periods.Add(period);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "create", "Period",
            period.Id, period.NameCn, $"创建分期 [{period.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Created("", MapPeriodToDto(period));
    }

    [HttpPut("periods/{id:guid}")]
    public async Task<ActionResult<PeriodDto>> UpdatePeriod(Guid id, [FromBody] PeriodDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var period = await _db.Periods.FirstOrDefaultAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == id, ct);
        if (period is null) return NotFound();

        period.NameCn = dto.NameCn;
        period.NameEn = dto.NameEn;
        period.ColorHex = dto.ColorHex;
        period.ColorBackground = dto.ColorBackground;
        period.Description = dto.Description;
        period.Start = MapFuzzyDate(dto.Start);
        period.End = MapFuzzyDate(dto.End);

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "update", "Period",
            period.Id, period.NameCn, $"更新分期 [{period.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Ok(MapPeriodToDto(period));
    }

    [HttpDelete("periods/{exhibitionId:guid}/{id:guid}")]
    public async Task<IActionResult> DeletePeriod(Guid exhibitionId, Guid id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var period = await _db.Periods.FirstOrDefaultAsync(p => p.ExhibitionId == exhibitionId && p.Id == id, ct);
        if (period is null) return NotFound();

        _db.Periods.Remove(period);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "delete", "Period",
            id, period.NameCn, $"删除分期 [{period.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return NoContent();
    }

    #endregion

    #region Swimlanes (泳道)

    [HttpGet("exhibitions/{exhibitionId:guid}/swimlanes")]
    public async Task<ActionResult<List<SwimlaneDto>>> GetSwimlanes(Guid exhibitionId, CancellationToken ct)
    {
        var list = await _db.Swimlanes.AsNoTracking()
            .Where(s => s.ExhibitionId == exhibitionId)
            .OrderBy(s => s.Lane).ThenBy(s => s.Start.Year)
            .Select(s => MapSwimlaneToDto(s))
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("swimlanes")]
    public async Task<ActionResult<SwimlaneDto>> CreateSwimlane([FromBody] SwimlaneDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        if (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty)
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId.Value, ct);
            if (!pExists) return BadRequest($"关联分期 [{dto.PeriodId}] 不存在");
        }

        var swimlane = new Swimlane
        {
            Id = Guid.NewGuid(),
            ExhibitionId = dto.ExhibitionId,
            PeriodId = (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty) ? dto.PeriodId : null,
            NameCn = dto.NameCn,
            NameEn = dto.NameEn,
            Color = dto.Color,
            Lane = dto.Lane,
            DescriptionCn = dto.DescriptionCn,
            DescriptionEn = dto.DescriptionEn,
            Start = MapFuzzyDate(dto.Start),
            End = MapFuzzyDate(dto.End)
        };

        _db.Swimlanes.Add(swimlane);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "create", "Swimlane",
            swimlane.Id, swimlane.NameCn, $"创建泳道 [{swimlane.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Created("", MapSwimlaneToDto(swimlane));
    }

    [HttpPut("swimlanes/{id:guid}")]
    public async Task<ActionResult<SwimlaneDto>> UpdateSwimlane(Guid id, [FromBody] SwimlaneDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var swimlane = await _db.Swimlanes.FirstOrDefaultAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == id, ct);
        if (swimlane is null) return NotFound();

        if (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty)
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId.Value, ct);
            if (!pExists) return BadRequest($"关联分期 [{dto.PeriodId}] 不存在");
        }

        swimlane.PeriodId = (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty) ? dto.PeriodId : null;
        swimlane.NameCn = dto.NameCn;
        swimlane.NameEn = dto.NameEn;
        swimlane.Color = dto.Color;
        swimlane.Lane = dto.Lane;
        swimlane.DescriptionCn = dto.DescriptionCn;
        swimlane.DescriptionEn = dto.DescriptionEn;
        swimlane.Start = MapFuzzyDate(dto.Start);
        swimlane.End = MapFuzzyDate(dto.End);

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "update", "Swimlane",
            swimlane.Id, swimlane.NameCn, $"更新泳道 [{swimlane.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Ok(MapSwimlaneToDto(swimlane));
    }

    [HttpDelete("swimlanes/{exhibitionId:guid}/{id:guid}")]
    public async Task<IActionResult> DeleteSwimlane(Guid exhibitionId, Guid id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var swimlane = await _db.Swimlanes.FirstOrDefaultAsync(s => s.ExhibitionId == exhibitionId && s.Id == id, ct);
        if (swimlane is null) return NotFound();

        _db.Swimlanes.Remove(swimlane);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "delete", "Swimlane",
            id, swimlane.NameCn, $"删除泳道 [{swimlane.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return NoContent();
    }

    #endregion

    #region TimelineEvents (作品/事件卡片)

    [HttpGet("exhibitions/{exhibitionId:guid}/events")]
    public async Task<ActionResult<TimelineEventPageResult>> GetEvents(
        Guid exhibitionId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? keyword = null,
        [FromQuery] int? importance = null,
        CancellationToken ct = default)
    {
        var query = _db.TimelineEvents.AsNoTracking().Where(e => e.ExhibitionId == exhibitionId);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var k = keyword.Trim().ToLower();
            query = query.Where(e => e.TitleCn.ToLower().Contains(k) || 
                                     e.TitleEn.ToLower().Contains(k) || 
                                     (e.CreatorCn != null && e.CreatorCn.ToLower().Contains(k)) ||
                                     (e.CreatorEn != null && e.CreatorEn.ToLower().Contains(k)));
        }

        if (importance.HasValue)
        {
            query = query.Where(e => e.Importance == importance.Value);
        }

        var total = await query.CountAsync(ct);
        var list = await query
            .OrderBy(e => e.Date.Year)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => MapEventToDto(e))
            .ToListAsync(ct);

        return Ok(new TimelineEventPageResult
        {
            Items = list,
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        });
    }

    [HttpGet("events/{exhibitionId:guid}/{id:guid}")]
    public async Task<ActionResult<TimelineEventDto>> GetEvent(Guid exhibitionId, Guid id, CancellationToken ct)
    {
        var ev = await _db.TimelineEvents.AsNoTracking()
            .FirstOrDefaultAsync(e => e.ExhibitionId == exhibitionId && e.Id == id, ct);
        return ev is null ? NotFound() : Ok(MapEventToDto(ev));
    }

    [HttpPost("events")]
    public async Task<ActionResult<TimelineEventDto>> CreateEvent([FromBody] TimelineEventDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        if (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty)
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId.Value, ct);
            if (!pExists) return BadRequest($"关联分期 [{dto.PeriodId}] 不存在");
        }

        if (dto.SwimlaneId.HasValue && dto.SwimlaneId != Guid.Empty)
        {
            var sExists = await _db.Swimlanes.AnyAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == dto.SwimlaneId.Value, ct);
            if (!sExists) return BadRequest($"关联泳道 [{dto.SwimlaneId}] 不存在");
        }

        var ev = new TimelineEvent
        {
            Id = Guid.NewGuid(),
            ExhibitionId = dto.ExhibitionId,
            PeriodId = (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty) ? dto.PeriodId : null,
            SwimlaneId = (dto.SwimlaneId.HasValue && dto.SwimlaneId != Guid.Empty) ? dto.SwimlaneId : null,
            TitleCn = dto.TitleCn,
            TitleEn = dto.TitleEn,
            CreatorCn = dto.CreatorCn,
            CreatorEn = dto.CreatorEn,
            Location = dto.Location,
            ImageUrl = dto.ImageUrl,
            DetailPageUrl = dto.DetailPageUrl,
            HighResImageUrl = dto.HighResImageUrl,
            DescriptionCn = dto.DescriptionCn,
            DescriptionEn = dto.DescriptionEn,
            Importance = dto.Importance,
            Tags = dto.Tags ?? [],
            MetaJson = string.IsNullOrWhiteSpace(dto.MetaJson) ? "{}" : dto.MetaJson,
            Date = MapFuzzyDate(dto.Date),
            EndDate = dto.EndDate is not null ? MapFuzzyDate(dto.EndDate) : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.TimelineEvents.Add(ev);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "create", "TimelineEvent",
            ev.Id, ev.TitleCn, $"创建卡片作品 [{ev.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Created("", MapEventToDto(ev));
    }

    [HttpPut("events/{id:guid}")]
    public async Task<ActionResult<TimelineEventDto>> UpdateEvent(Guid id, [FromBody] TimelineEventDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var ev = await _db.TimelineEvents.FirstOrDefaultAsync(e => e.ExhibitionId == dto.ExhibitionId && e.Id == id, ct);
        if (ev is null) return NotFound();

        if (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty)
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId.Value, ct);
            if (!pExists) return BadRequest($"关联分期 [{dto.PeriodId}] 不存在");
        }

        if (dto.SwimlaneId.HasValue && dto.SwimlaneId != Guid.Empty)
        {
            var sExists = await _db.Swimlanes.AnyAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == dto.SwimlaneId.Value, ct);
            if (!sExists) return BadRequest($"关联泳道 [{dto.SwimlaneId}] 不存在");
        }

        ev.PeriodId = (dto.PeriodId.HasValue && dto.PeriodId != Guid.Empty) ? dto.PeriodId : null;
        ev.SwimlaneId = (dto.SwimlaneId.HasValue && dto.SwimlaneId != Guid.Empty) ? dto.SwimlaneId : null;
        ev.TitleCn = dto.TitleCn;
        ev.TitleEn = dto.TitleEn;
        ev.CreatorCn = dto.CreatorCn;
        ev.CreatorEn = dto.CreatorEn;
        ev.Location = dto.Location;
        ev.ImageUrl = dto.ImageUrl;
        ev.DetailPageUrl = dto.DetailPageUrl;
        ev.HighResImageUrl = dto.HighResImageUrl;
        ev.DescriptionCn = dto.DescriptionCn;
        ev.DescriptionEn = dto.DescriptionEn;
        ev.Importance = dto.Importance;
        ev.Tags = dto.Tags ?? [];
        ev.MetaJson = string.IsNullOrWhiteSpace(dto.MetaJson) ? "{}" : dto.MetaJson;
        ev.Date = MapFuzzyDate(dto.Date);
        ev.EndDate = dto.EndDate is not null ? MapFuzzyDate(dto.EndDate) : null;
        ev.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "update", "TimelineEvent",
            ev.Id, ev.TitleCn, $"更新卡片作品 [{ev.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Ok(MapEventToDto(ev));
    }

    [HttpDelete("events/{exhibitionId:guid}/{id:guid}")]
    public async Task<IActionResult> DeleteEvent(Guid exhibitionId, Guid id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var ev = await _db.TimelineEvents.FirstOrDefaultAsync(e => e.ExhibitionId == exhibitionId && e.Id == id, ct);
        if (ev is null) return NotFound();

        _db.TimelineEvents.Remove(ev);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "delete", "TimelineEvent",
            id, ev.TitleCn, $"删除卡片作品 [{ev.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return NoContent();
    }

    #endregion

    #region Mapper Helpers

    private static FuzzyDate MapFuzzyDate(FuzzyDateDto dto) => new()
    {
        Year = dto.Year,
        Month = dto.Month,
        Day = dto.Day,
        Accuracy = dto.Accuracy,
        OrYear = dto.OrYear,
        OrMonth = dto.OrMonth,
        OrDay = dto.OrDay
    };

    private static FuzzyDateDto MapFuzzyDateDto(FuzzyDate entity) => new()
    {
        Year = entity.Year,
        Month = entity.Month,
        Day = entity.Day,
        Accuracy = entity.Accuracy,
        OrYear = entity.OrYear,
        OrMonth = entity.OrMonth,
        OrDay = entity.OrDay
    };

    private static PeriodDto MapPeriodToDto(Period p) => new()
    {
        Id = p.Id,
        ExhibitionId = p.ExhibitionId,
        NameCn = p.NameCn,
        NameEn = p.NameEn,
        ColorHex = p.ColorHex,
        ColorBackground = p.ColorBackground,
        Description = p.Description,
        Start = MapFuzzyDateDto(p.Start),
        End = MapFuzzyDateDto(p.End)
    };

    private static SwimlaneDto MapSwimlaneToDto(Swimlane s) => new()
    {
        Id = s.Id,
        ExhibitionId = s.ExhibitionId,
        PeriodId = s.PeriodId,
        NameCn = s.NameCn,
        NameEn = s.NameEn,
        Color = s.Color,
        Lane = s.Lane,
        DescriptionCn = s.DescriptionCn,
        DescriptionEn = s.DescriptionEn,
        Start = MapFuzzyDateDto(s.Start),
        End = MapFuzzyDateDto(s.End)
    };

    private static TimelineEventDto MapEventToDto(TimelineEvent e) => new()
    {
        Id = e.Id,
        ExhibitionId = e.ExhibitionId,
        PeriodId = e.PeriodId,
        SwimlaneId = e.SwimlaneId,
        TitleCn = e.TitleCn,
        TitleEn = e.TitleEn,
        CreatorCn = e.CreatorCn,
        CreatorEn = e.CreatorEn,
        Location = e.Location,
        ImageUrl = e.ImageUrl,
        DetailPageUrl = e.DetailPageUrl,
        HighResImageUrl = e.HighResImageUrl,
        DescriptionCn = e.DescriptionCn,
        DescriptionEn = e.DescriptionEn,
        Importance = e.Importance,
        Tags = e.Tags,
        MetaJson = e.MetaJson,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt,
        Date = MapFuzzyDateDto(e.Date),
        EndDate = e.EndDate is not null ? MapFuzzyDateDto(e.EndDate) : null
    };

    #endregion
}
