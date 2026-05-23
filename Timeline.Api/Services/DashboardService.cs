using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;

namespace Timeline.Api.Services;

public class DashboardService
{
    private readonly TimelineDbContext _db;

    public DashboardService(TimelineDbContext db) => _db = db;

    public async Task<DashboardSummaryResponse> GetSummaryAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var in7 = now.AddDays(7);
        var in30 = now.AddDays(30);
        var last7 = now.AddDays(-7);

        var orgTotal = await _db.Organizations.CountAsync(ct);
        var orgActive = await _db.Organizations.CountAsync(o => o.IsActive, ct);

        var devices = await _db.Devices.AsNoTracking().ToListAsync(ct);
        var deviceTotal = devices.Count;
        var deviceFormal = devices.Count(d => d.LicenseType == LicenseTypes.Formal);
        var deviceTrial = devices.Count(d => d.LicenseType == LicenseTypes.Trial);
        var deviceExpired = devices.Count(d => d.ValidUntil < now);
        var deviceExp7 = devices.Count(d => d.ValidUntil >= now && d.ValidUntil <= in7);
        var deviceExp30 = devices.Count(d => d.ValidUntil > in7 && d.ValidUntil <= in30);
        var deviceHealthy = devices.Count(d => d.ValidUntil > in30);

        var exhibitionTotal = await _db.Exhibitions.CountAsync(ct);
        var exhibitionPublished = await _db.Exhibitions.CountAsync(e => e.IsPublished, ct);

        var auditLast7 = await _db.AuditLogs.CountAsync(a => a.CreatedAt >= last7, ct);

        var topOrgs = await _db.Devices.AsNoTracking()
            .GroupBy(d => d.OrganizationId)
            .Select(g => new { OrganizationId = g.Key, DeviceCount = g.Count() })
            .OrderByDescending(x => x.DeviceCount)
            .Take(5)
            .Join(
                _db.Organizations.AsNoTracking(),
                g => g.OrganizationId,
                o => o.Id,
                (g, o) => new DashboardOrgDeviceCount(o.Name, g.DeviceCount))
            .ToListAsync(ct);

        var auditDaily = (await _db.AuditLogs.AsNoTracking()
            .Where(a => a.CreatedAt >= last7)
            .Select(a => a.CreatedAt)
            .ToListAsync(ct))
            .GroupBy(d => d.Date)
            .Select(g => new DashboardDailyAuditCount(g.Key.ToString("yyyy-MM-dd"), g.Count()))
            .OrderBy(x => x.Date)
            .ToList();

        return new DashboardSummaryResponse(
            orgTotal, orgActive, orgTotal - orgActive,
            deviceTotal, deviceFormal, deviceTrial,
            deviceExpired, deviceExp7, deviceExp30, deviceHealthy,
            exhibitionTotal, exhibitionPublished,
            auditLast7, topOrgs, auditDaily);
    }
}
