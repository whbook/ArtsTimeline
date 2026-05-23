using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/devices")]
public class DevicesController : ApiControllerBase
{
    private readonly TimelineDbContext _db;
    private readonly AuditLogService _audit;

    public DevicesController(TimelineDbContext db, AuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<DevicePageResult>> List([FromQuery] DeviceListFilter filter, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var q = _db.Devices.AsNoTracking().Include(d => d.Organization).AsQueryable();
        if (!string.IsNullOrWhiteSpace(filter.Keyword))
        {
            var kw = filter.Keyword.Trim();
            q = q.Where(d => d.DeviceCode.Contains(kw) || d.Organization.Name.Contains(kw));
        }
        if (filter.OrganizationId.HasValue) q = q.Where(d => d.OrganizationId == filter.OrganizationId);
        if (!string.IsNullOrWhiteSpace(filter.LicenseType)) q = q.Where(d => d.LicenseType == filter.LicenseType);
        if (filter.IsActive.HasValue) q = q.Where(d => d.IsActive == filter.IsActive.Value);

        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(d => d.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(d => new DeviceListItemResponse(
                d.Id, d.DeviceCode, d.Organization.Name, d.LicenseType,
                d.ValidFrom, d.ValidUntil, d.IsActive, d.ValidUntil < now,
                d.LastSeenAt, d.DeviceExhibitions.Count))
            .ToListAsync(ct);

        return Ok(new DevicePageResult(items, total, filter.Page, filter.PageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DeviceResponse>> Get(Guid id, CancellationToken ct)
    {
        var device = await LoadDeviceAsync(id, ct);
        return device is null ? NotFound() : Ok(EntityMapper.ToResponse(device));
    }

    [HttpPost]
    public async Task<ActionResult<DeviceResponse>> Create([FromBody] CreateDeviceRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        if (!await _db.Organizations.AnyAsync(o => o.Id == request.OrganizationId, ct))
            return BadRequest("单位不存在");
        if (await _db.Devices.AnyAsync(d => d.DeviceCode == request.DeviceCode, ct))
            return BadRequest("设备代码已存在");
        if (request.ValidFrom >= request.ValidUntil)
            return BadRequest("有效期起始时间必须早于截止时间");

        List<string> ips;
        try { ips = IpAddressValidator.ParseAndValidate(request.IpAddresses); }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }

        var device = new Device
        {
            Id = Guid.NewGuid(),
            OrganizationId = request.OrganizationId,
            DeviceCode = request.DeviceCode,
            ScreenWidth = request.ScreenWidth,
            ScreenHeight = request.ScreenHeight,
            OsVersion = request.OsVersion,
            LicenseType = request.LicenseType,
            ValidFrom = request.ValidFrom.ToUniversalTime(),
            ValidUntil = request.ValidUntil.ToUniversalTime(),
            IpAddresses = ips,
            IsActive = request.IsActive,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Devices.Add(device);
        await _db.SaveChangesAsync(ct);
        await ReplaceExhibitionsAsync(device.Id, request.Exhibitions, ct);

        device = await LoadDeviceAsync(device.Id, ct);
        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Create, AuditEntityTypes.Device,
            device!.Id, device.DeviceCode, $"创建设备 [{device.DeviceCode}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return CreatedAtAction(nameof(Get), new { id = device.Id }, EntityMapper.ToResponse(device));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DeviceResponse>> Update(Guid id, [FromBody] UpdateDeviceRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        var device = await _db.Devices.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (device is null) return NotFound();
        if (device.DeviceCode != request.DeviceCode &&
            await _db.Devices.AnyAsync(d => d.DeviceCode == request.DeviceCode && d.Id != id, ct))
            return BadRequest("设备代码已存在");
        if (request.ValidFrom >= request.ValidUntil)
            return BadRequest("有效期起始时间必须早于截止时间");

        List<string> ips;
        try { ips = IpAddressValidator.ParseAndValidate(request.IpAddresses); }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }

        device.OrganizationId = request.OrganizationId;
        device.DeviceCode = request.DeviceCode;
        device.ScreenWidth = request.ScreenWidth;
        device.ScreenHeight = request.ScreenHeight;
        device.OsVersion = request.OsVersion;
        device.LicenseType = request.LicenseType;
        device.ValidFrom = request.ValidFrom.ToUniversalTime();
        device.ValidUntil = request.ValidUntil.ToUniversalTime();
        device.IpAddresses = ips;
        device.IsActive = request.IsActive;
        device.Notes = request.Notes;
        device.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await ReplaceExhibitionsAsync(id, request.Exhibitions, ct);

        device = await LoadDeviceAsync(id, ct);
        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Update, AuditEntityTypes.Device,
            device!.Id, device.DeviceCode, $"更新设备 [{device.DeviceCode}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(EntityMapper.ToResponse(device));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        var device = await _db.Devices.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (device is null) return NotFound();
        _db.Devices.Remove(device);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Delete, AuditEntityTypes.Device,
            device.Id, device.DeviceCode, $"删除设备 [{device.DeviceCode}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/exhibitions")]
    public async Task<ActionResult<List<DeviceExhibitionAssignmentResponse>>> GetExhibitions(Guid id, CancellationToken ct)
    {
        var device = await LoadDeviceAsync(id, ct);
        if (device is null) return NotFound();
        return Ok(device.DeviceExhibitions.OrderBy(x => x.SortOrder).Select(x =>
            new DeviceExhibitionAssignmentResponse(
                x.ExhibitionId, x.Exhibition.Slug, x.Exhibition.TitleCn,
                x.SortOrder, x.IsDefault, x.OverridesJson)).ToList());
    }

    [HttpPut("{id:guid}/exhibitions")]
    public async Task<IActionResult> SetExhibitions(Guid id, [FromBody] List<DeviceExhibitionAssignmentRequest> assignments, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        if (!await _db.Devices.AnyAsync(d => d.Id == id, ct)) return NotFound();
        await ReplaceExhibitionsAsync(id, assignments, ct);
        return NoContent();
    }

    private async Task<Device?> LoadDeviceAsync(Guid id, CancellationToken ct) =>
        await _db.Devices
            .Include(d => d.Organization)
            .Include(d => d.DeviceExhibitions).ThenInclude(de => de.Exhibition)
            .FirstOrDefaultAsync(d => d.Id == id, ct);

    private async Task ReplaceExhibitionsAsync(Guid deviceId, List<DeviceExhibitionAssignmentRequest> assignments, CancellationToken ct)
    {
        var existing = await _db.DeviceExhibitions.Where(x => x.DeviceId == deviceId).ToListAsync(ct);
        _db.DeviceExhibitions.RemoveRange(existing);

        foreach (var a in assignments.OrderBy(x => x.SortOrder))
        {
            _db.DeviceExhibitions.Add(new DeviceExhibition
            {
                Id = Guid.NewGuid(),
                DeviceId = deviceId,
                ExhibitionId = a.ExhibitionId,
                SortOrder = a.SortOrder,
                IsDefault = a.IsDefault,
                OverridesJson = a.OverridesJson
            });
        }
        await _db.SaveChangesAsync(ct);
    }
}
