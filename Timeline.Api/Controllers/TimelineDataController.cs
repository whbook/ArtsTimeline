using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;
using Timeline.Api.Services;
using Stream = Timeline.Api.Models.Stream;

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

    #region Periods (时代分期)

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
        if (string.IsNullOrWhiteSpace(dto.Id)) return BadRequest("分期 ID 不能为空");

        var exists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.Id, ct);
        if (exists) return BadRequest($"分期 ID [{dto.Id}] 在该展览中已存在");

        var period = new Period
        {
            Id = dto.Id.Trim(),
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
            null, period.Id, $"创建时代分期 [{period.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Created("", MapPeriodToDto(period));
    }

    [HttpPut("periods/{id}")]
    public async Task<ActionResult<PeriodDto>> UpdatePeriod(string id, [FromBody] PeriodDto dto, CancellationToken ct)
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
            null, period.Id, $"更新时代分期 [{period.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Ok(MapPeriodToDto(period));
    }

    [HttpDelete("periods/{exhibitionId:guid}/{id}")]
    public async Task<IActionResult> DeletePeriod(Guid exhibitionId, string id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var period = await _db.Periods.FirstOrDefaultAsync(p => p.ExhibitionId == exhibitionId && p.Id == id, ct);
        if (period is null) return NotFound();

        _db.Periods.Remove(period);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "delete", "Period",
            null, id, $"删除时代分期 [{period.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return NoContent();
    }

    #endregion

    #region Streams (流派泳道)

    [HttpGet("exhibitions/{exhibitionId:guid}/streams")]
    public async Task<ActionResult<List<StreamDto>>> GetStreams(Guid exhibitionId, CancellationToken ct)
    {
        var list = await _db.Streams.AsNoTracking()
            .Where(s => s.ExhibitionId == exhibitionId)
            .OrderBy(s => s.Lane).ThenBy(s => s.Start.Year)
            .Select(s => MapStreamToDto(s))
            .ToListAsync(ct);
        return Ok(list);
    }

    [HttpPost("streams")]
    public async Task<ActionResult<StreamDto>> CreateStream([FromBody] StreamDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Id)) return BadRequest("泳道 ID 不能为空");

        var exists = await _db.Streams.AnyAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == dto.Id, ct);
        if (exists) return BadRequest($"泳道 ID [{dto.Id}] 在该展览中已存在");

        if (!string.IsNullOrWhiteSpace(dto.PeriodId))
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId, ct);
            if (!pExists) return BadRequest($"关联时代分期 [{dto.PeriodId}] 不存在");
        }

        var stream = new Stream
        {
            Id = dto.Id.Trim(),
            ExhibitionId = dto.ExhibitionId,
            PeriodId = string.IsNullOrWhiteSpace(dto.PeriodId) ? null : dto.PeriodId,
            NameCn = dto.NameCn,
            NameEn = dto.NameEn,
            Color = dto.Color,
            Lane = dto.Lane,
            DescriptionCn = dto.DescriptionCn,
            DescriptionEn = dto.DescriptionEn,
            Start = MapFuzzyDate(dto.Start),
            End = MapFuzzyDate(dto.End)
        };

        _db.Streams.Add(stream);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "create", "Stream",
            null, stream.Id, $"创建流派泳道 [{stream.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Created("", MapStreamToDto(stream));
    }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Style", "IDE0060")]
    [HttpPut("streams/{id}")]
    public async Task<ActionResult<StreamDto>> UpdateStream(string id, [FromBody] StreamDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var stream = await _db.Streams.FirstOrDefaultAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == id, ct);
        if (stream is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.PeriodId))
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId, ct);
            if (!pExists) return BadRequest($"关联时代分期 [{dto.PeriodId}] 不存在");
        }

        stream.PeriodId = string.IsNullOrWhiteSpace(dto.PeriodId) ? null : dto.PeriodId;
        stream.NameCn = dto.NameCn;
        stream.NameEn = dto.NameEn;
        stream.Color = dto.Color;
        stream.Lane = dto.Lane;
        stream.DescriptionCn = dto.DescriptionCn;
        stream.DescriptionEn = dto.DescriptionEn;
        stream.Start = MapFuzzyDate(dto.Start);
        stream.End = MapFuzzyDate(dto.End);

        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "update", "Stream",
            null, stream.Id, $"更新流派泳道 [{stream.NameCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Ok(MapStreamToDto(stream));
    }

    [HttpDelete("streams/{exhibitionId:guid}/{id}")]
    public async Task<IActionResult> DeleteStream(Guid exhibitionId, string id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var stream = await _db.Streams.FirstOrDefaultAsync(s => s.ExhibitionId == exhibitionId && s.Id == id, ct);
        if (stream is null) return NotFound();

        _db.Streams.Remove(stream);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "delete", "Stream",
            null, id, $"删除流派泳道 [{stream.NameCn}]",
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

    [HttpGet("events/{exhibitionId:guid}/{id}")]
    public async Task<ActionResult<TimelineEventDto>> GetEvent(Guid exhibitionId, string id, CancellationToken ct)
    {
        var ev = await _db.TimelineEvents.AsNoTracking()
            .FirstOrDefaultAsync(e => e.ExhibitionId == exhibitionId && e.Id == id, ct);
        return ev is null ? NotFound() : Ok(MapEventToDto(ev));
    }

    [HttpPost("events")]
    public async Task<ActionResult<TimelineEventDto>> CreateEvent([FromBody] TimelineEventDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Id)) return BadRequest("事件 ID 不能为空");

        var exists = await _db.TimelineEvents.AnyAsync(e => e.ExhibitionId == dto.ExhibitionId && e.Id == dto.Id, ct);
        if (exists) return BadRequest($"事件 ID [{dto.Id}] 在该展览中已存在");

        if (!string.IsNullOrWhiteSpace(dto.PeriodId))
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId, ct);
            if (!pExists) return BadRequest($"关联时代分期 [{dto.PeriodId}] 不存在");
        }

        if (!string.IsNullOrWhiteSpace(dto.StreamId))
        {
            var sExists = await _db.Streams.AnyAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == dto.StreamId, ct);
            if (!sExists) return BadRequest($"关联泳道 [{dto.StreamId}] 不存在");
        }

        var ev = new TimelineEvent
        {
            Id = dto.Id.Trim(),
            ExhibitionId = dto.ExhibitionId,
            PeriodId = string.IsNullOrWhiteSpace(dto.PeriodId) ? null : dto.PeriodId,
            StreamId = string.IsNullOrWhiteSpace(dto.StreamId) ? null : dto.StreamId,
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
            null, ev.Id, $"创建卡片作品 [{ev.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Created("", MapEventToDto(ev));
    }

    [System.Diagnostics.CodeAnalysis.SuppressMessage("Style", "IDE0060")]
    [HttpPut("events/{id}")]
    public async Task<ActionResult<TimelineEventDto>> UpdateEvent(string id, [FromBody] TimelineEventDto dto, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var ev = await _db.TimelineEvents.FirstOrDefaultAsync(e => e.ExhibitionId == dto.ExhibitionId && e.Id == id, ct);
        if (ev is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.PeriodId))
        {
            var pExists = await _db.Periods.AnyAsync(p => p.ExhibitionId == dto.ExhibitionId && p.Id == dto.PeriodId, ct);
            if (!pExists) return BadRequest($"关联时代分期 [{dto.PeriodId}] 不存在");
        }

        if (!string.IsNullOrWhiteSpace(dto.StreamId))
        {
            var sExists = await _db.Streams.AnyAsync(s => s.ExhibitionId == dto.ExhibitionId && s.Id == dto.StreamId, ct);
            if (!sExists) return BadRequest($"关联泳道 [{dto.StreamId}] 不存在");
        }

        ev.PeriodId = string.IsNullOrWhiteSpace(dto.PeriodId) ? null : dto.PeriodId;
        ev.StreamId = string.IsNullOrWhiteSpace(dto.StreamId) ? null : dto.StreamId;
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
            null, ev.Id, $"更新卡片作品 [{ev.TitleCn}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);

        return Ok(MapEventToDto(ev));
    }

    [HttpDelete("events/{exhibitionId:guid}/{id}")]
    public async Task<IActionResult> DeleteEvent(Guid exhibitionId, string id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        var ev = await _db.TimelineEvents.FirstOrDefaultAsync(e => e.ExhibitionId == exhibitionId && e.Id == id, ct);
        if (ev is null) return NotFound();

        _db.TimelineEvents.Remove(ev);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), "delete", "TimelineEvent",
            null, id, $"删除卡片作品 [{ev.TitleCn}]",
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

    private static StreamDto MapStreamToDto(Stream s) => new()
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
        StreamId = e.StreamId,
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
