using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/global-settings")]
public class GlobalSettingsController : ApiControllerBase
{
    private readonly TimelineDbContext _db;
    private readonly AuditLogService _audit;

    public GlobalSettingsController(TimelineDbContext db, AuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<GlobalSettingsResponse>> Get(CancellationToken ct)
    {
        var settings = await _db.GlobalSettings.AsNoTracking().FirstAsync(ct);
        return Ok(EntityMapper.ToResponse(settings));
    }

    [HttpPut]
    [Authorize(Policy = "AdminSuperAdmin")]
    public async Task<ActionResult<GlobalSettingsResponse>> Update([FromBody] UpdateGlobalSettingsRequest request, CancellationToken ct)
    {
        var settings = await _db.GlobalSettings.FirstAsync(ct);
        settings.AutoplayIdleTimeoutMs = request.AutoplayIdleTimeoutMs;
        settings.AutoplayMode = request.AutoplayMode;
        settings.AutoplayBaseSpeed = request.AutoplayBaseSpeed;
        settings.AutoplayFastSpeed = request.AutoplayFastSpeed;
        settings.MinZoomRangeGlobal = request.MinZoomRangeGlobal;
        settings.MaxZoomRangeGlobal = request.MaxZoomRangeGlobal;
        settings.BaseScreenWidth = request.BaseScreenWidth;
        settings.BaseScreenHeight = request.BaseScreenHeight;
        settings.BaseColumnWidth = request.BaseColumnWidth;
        settings.ImportanceThresholdsJson = request.ImportanceThresholdsJson;
        settings.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Update, AuditEntityTypes.GlobalSettings,
            null, "全局设置", "更新全局运行参数",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(EntityMapper.ToResponse(settings));
    }
}

[Authorize(Policy = "AdminOnly")]
[Route("api/admin-users")]
public class AdminUsersController : ApiControllerBase
{
    private readonly TimelineDbContext _db;
    private readonly AuditLogService _audit;

    public AdminUsersController(TimelineDbContext db, AuditLogService audit)
    {
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    [Authorize(Policy = "AdminSuperAdmin")]
    public async Task<ActionResult<List<AdminUserListItemResponse>>> List(CancellationToken ct)
    {
        var items = await _db.AdminUsers.AsNoTracking()
            .OrderBy(u => u.Username)
            .Select(u => new AdminUserListItemResponse(u.Id, u.Username, u.Email, u.Role, u.IsActive, u.CreatedAt))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Policy = "AdminSuperAdmin")]
    public async Task<ActionResult<AdminUserResponse>> Create([FromBody] CreateAdminUserRequest request, CancellationToken ct)
    {
        if (await _db.AdminUsers.AnyAsync(u => u.Username == request.Username, ct))
            return BadRequest("用户名已存在");

        var user = new AdminUser
        {
            Id = Guid.NewGuid(),
            Username = request.Username,
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.AdminUsers.Add(user);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Create, AuditEntityTypes.AdminUser,
            user.Id, user.Username, $"创建管理员 [{user.Username}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(new AdminUserResponse(user.Id, user.Username, user.Email, user.Role, user.IsActive, user.CreatedAt, user.UpdatedAt));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "AdminSuperAdmin")]
    public async Task<ActionResult<AdminUserResponse>> Update(Guid id, [FromBody] UpdateAdminUserRequest request, CancellationToken ct)
    {
        var user = await _db.AdminUsers.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();
        if (!string.IsNullOrWhiteSpace(request.Email)) user.Email = request.Email;
        if (!string.IsNullOrWhiteSpace(request.Password)) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        if (!string.IsNullOrWhiteSpace(request.Role)) user.Role = request.Role;
        if (request.IsActive.HasValue) user.IsActive = request.IsActive.Value;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(GetAdminUserId(), GetAdminUsername(), AuditActions.Update, AuditEntityTypes.AdminUser,
            user.Id, user.Username, $"更新管理员 [{user.Username}]",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(new AdminUserResponse(user.Id, user.Username, user.Email, user.Role, user.IsActive, user.CreatedAt, user.UpdatedAt));
    }
}

[Authorize(Policy = "AdminOnly")]
[Route("api/audit-logs")]
public class AuditLogsController : ApiControllerBase
{
    private readonly TimelineDbContext _db;

    public AuditLogsController(TimelineDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<AuditLogPageResult>> List([FromQuery] AuditLogFilter filter, CancellationToken ct)
    {
        var q = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(filter.Keyword))
        {
            var kw = filter.Keyword.Trim();
            q = q.Where(a => a.Summary.Contains(kw) || (a.AdminUsername != null && a.AdminUsername.Contains(kw)));
        }
        if (!string.IsNullOrWhiteSpace(filter.EntityType)) q = q.Where(a => a.EntityType == filter.EntityType);
        if (filter.From.HasValue) q = q.Where(a => a.CreatedAt >= filter.From.Value.ToUniversalTime());
        if (filter.To.HasValue) q = q.Where(a => a.CreatedAt <= filter.To.Value.ToUniversalTime());

        var total = await q.CountAsync(ct);
        var items = await q.OrderByDescending(a => a.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .Select(a => new AuditLogListItemResponse(
                a.Id, a.AdminUsername, a.Action, a.EntityType, a.EntityLabel,
                a.Summary, a.IpAddress, a.CreatedAt))
            .ToListAsync(ct);
        return Ok(new AuditLogPageResult(items, total, filter.Page, filter.PageSize));
    }
}

[Authorize(Policy = "AdminOnly")]
[Route("api/dashboard")]
public class DashboardController : ApiControllerBase
{
    private readonly DashboardService _dashboard;

    public DashboardController(DashboardService dashboard) => _dashboard = dashboard;

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryResponse>> Summary(CancellationToken ct) =>
        Ok(await _dashboard.GetSummaryAsync(ct));
}
