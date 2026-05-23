using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/organizations")]
public class OrganizationsController : ApiControllerBase
{
    private readonly TimelineDbContext _db;
    private readonly AuditLogService _audit;

    public OrganizationsController(TimelineDbContext db, AuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<OrganizationPageResult>> List([FromQuery] OrganizationListFilter filter, CancellationToken ct)
    {
        var q = _db.Organizations.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(filter.Keyword))
        {
            var kw = filter.Keyword.Trim();
            q = q.Where(o => o.Code.Contains(kw) || o.Name.Contains(kw) || (o.ContactName != null && o.ContactName.Contains(kw)));
        }
        if (filter.IsActive.HasValue) q = q.Where(o => o.IsActive == filter.IsActive.Value);

        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(o => o.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(o => new OrganizationListItemResponse(
                o.Id, o.Code, o.Name, o.ContactName, o.Phone, o.IsActive,
                o.Devices.Count, o.CreatedAt))
            .ToListAsync(ct);

        return Ok(new OrganizationPageResult(items, total, filter.Page, filter.PageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrganizationResponse>> Get(Guid id, CancellationToken ct)
    {
        var org = await _db.Organizations.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id, ct);
        return org is null ? NotFound() : Ok(EntityMapper.ToResponse(org));
    }

    [HttpPost]
    public async Task<ActionResult<OrganizationResponse>> Create([FromBody] CreateOrganizationRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        if (await _db.Organizations.AnyAsync(o => o.Code == request.Code, ct))
            return BadRequest("单位编码已存在");

        var org = new Organization
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        EntityMapper.ApplyOrganization(org, request);
        _db.Organizations.Add(org);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Create, AuditEntityTypes.Organization,
            org.Id, org.Name, $"创建单位 [{org.Name}]", ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return CreatedAtAction(nameof(Get), new { id = org.Id }, EntityMapper.ToResponse(org));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OrganizationResponse>> Update(Guid id, [FromBody] UpdateOrganizationRequest request, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == id, ct);
        if (org is null) return NotFound();
        if (org.Code != request.Code && await _db.Organizations.AnyAsync(o => o.Code == request.Code && o.Id != id, ct))
            return BadRequest("单位编码已存在");

        EntityMapper.ApplyOrganization(org, request);
        org.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Update, AuditEntityTypes.Organization,
            org.Id, org.Name, $"更新单位 [{org.Name}]", ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(EntityMapper.ToResponse(org));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();
        var org = await _db.Organizations.Include(o => o.Devices).FirstOrDefaultAsync(o => o.Id == id, ct);
        if (org is null) return NotFound();
        if (org.Devices.Any()) return BadRequest("该单位下仍有设备，无法删除");

        _db.Organizations.Remove(org);
        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Delete, AuditEntityTypes.Organization,
            org.Id, org.Name, $"删除单位 [{org.Name}]", ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return NoContent();
    }
}
