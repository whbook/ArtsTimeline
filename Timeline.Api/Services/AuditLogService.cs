using System.Text.Json;
using Timeline.Api.Data;
using Timeline.Api.Models;

namespace Timeline.Api.Services;

public class AuditLogService
{
    private readonly TimelineDbContext _db;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(TimelineDbContext db, ILogger<AuditLogService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task LogAsync(
        Guid? adminUserId,
        string? adminUsername,
        string action,
        string entityType,
        Guid? entityId,
        string? entityLabel,
        string summary,
        object? detail = null,
        string? ipAddress = null,
        string? userAgent = null,
        CancellationToken ct = default)
    {
        try
        {
            _db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                AdminUserId = adminUserId,
                AdminUsername = adminUsername,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                EntityLabel = entityLabel,
                Summary = summary,
                DetailJson = detail is null ? null : JsonSerializer.Serialize(detail),
                IpAddress = ipAddress,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "写入审计日志失败: {Summary}", summary);
        }
    }
}

public static class AuditActions
{
    public const string Create = "create";
    public const string Update = "update";
    public const string Delete = "delete";
    public const string Login = "login";
    public const string ChangePassword = "change_password";
}

public static class AuditEntityTypes
{
    public const string Organization = "Organization";
    public const string Device = "Device";
    public const string Exhibition = "Exhibition";
    public const string GlobalSettings = "GlobalSettings";
    public const string AdminUser = "AdminUser";
    public const string System = "System";
}
