namespace Timeline.AdminBlazor.Models;

public class AdminLoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public string Token { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class ChangeOwnPasswordRequest
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class OrganizationListItem
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ContactName { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; }
    public int DeviceCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class OrganizationPageResult
{
    public List<OrganizationListItem> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class OrganizationModel
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? ContactName { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? Introduction { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? Province { get; set; }
    public string? City { get; set; }
    public string? District { get; set; }
    public string? Address { get; set; }
    public bool IsActive { get; set; } = true;
}

public class DeviceListItem
{
    public Guid Id { get; set; }
    public string DeviceCode { get; set; } = string.Empty;
    public string OrganizationName { get; set; } = string.Empty;
    public string LicenseType { get; set; } = string.Empty;
    public DateTime ValidFrom { get; set; }
    public DateTime ValidUntil { get; set; }
    public bool IsActive { get; set; }
    public bool IsExpired { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public int ExhibitionCount { get; set; }
}

public class DevicePageResult
{
    public List<DeviceListItem> Items { get; set; } = [];
    public int TotalCount { get; set; }
}

public class DeviceExhibitionAssignment
{
    public Guid ExhibitionId { get; set; }
    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public string? OverridesJson { get; set; }
}

public class DeviceModel
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string DeviceCode { get; set; } = string.Empty;
    public int ScreenWidth { get; set; } = 1920;
    public int ScreenHeight { get; set; } = 1080;
    public string? OsVersion { get; set; }
    public string LicenseType { get; set; } = "trial";
    public DateTime ValidFrom { get; set; } = DateTime.UtcNow.Date;
    public DateTime ValidUntil { get; set; } = DateTime.UtcNow.Date.AddMonths(1);
    public string IpAddressesText { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public List<DeviceExhibitionAssignment> Exhibitions { get; set; } = [];
}

public class ExhibitionSyncResult
{
    public int Count { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ExhibitionListItem
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string TitleCn { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
    public decimal PlaybackSpeed { get; set; }
    public decimal InitialZoom { get; set; } = 6;
    public bool Chunked { get; set; }
    public decimal MinZoomRange { get; set; }
    public decimal MaxZoomRange { get; set; }
    public int DefaultViewportStartYear { get; set; }
    public int DefaultViewportEndYear { get; set; }
}

public class ExhibitionModel
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string TitleCn { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Color { get; set; } = "#2563eb";
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; } = true;
    public int DefaultViewportStartYear { get; set; } = -4000;
    public int DefaultViewportEndYear { get; set; } = 2050;
    public decimal MinZoomRange { get; set; } = 1;
    public decimal MaxZoomRange { get; set; } = 10000;
    public decimal PlaybackSpeed { get; set; } = 1;
    public decimal InitialZoom { get; set; } = 6;
    public bool Chunked { get; set; }
    public string EventFieldsJson { get; set; } = "[]";
}

public class GlobalSettingsModel
{
    public int AutoplayIdleTimeoutMs { get; set; } = 10000;
    public string AutoplayMode { get; set; } = "sequential";
    public decimal AutoplayBaseSpeed { get; set; } = 10;
    public decimal AutoplayFastSpeed { get; set; } = 500;
    public decimal MinZoomRangeGlobal { get; set; } = 0.003m;
    public decimal MaxZoomRangeGlobal { get; set; } = 50000;
    public int BaseScreenWidth { get; set; } = 1920;
    public int BaseScreenHeight { get; set; } = 1080;
    public int BaseColumnWidth { get; set; } = 320;
    public string ImportanceThresholdsJson { get; set; } = "{\"1\":null,\"2\":5000,\"3\":1500,\"4\":400,\"5\":100}";
}

public class AdminUserListItem
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class AuditLogListItem
{
    public Guid Id { get; set; }
    public string? AdminUsername { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityLabel { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AuditLogPageResult
{
    public List<AuditLogListItem> Items { get; set; } = [];
    public int TotalCount { get; set; }
}

public class DashboardSummary
{
    public int OrganizationTotal { get; set; }
    public int OrganizationActive { get; set; }
    public int DeviceTotal { get; set; }
    public int DeviceFormal { get; set; }
    public int DeviceTrial { get; set; }
    public int DeviceExpired { get; set; }
    public int DeviceExpiring7Days { get; set; }
    public int DeviceExpiring30Days { get; set; }
    public int DeviceHealthy { get; set; }
    public int ExhibitionTotal { get; set; }
    public int ExhibitionPublished { get; set; }
    public int AuditLogsLast7Days { get; set; }
    public List<DashboardOrgDeviceCount> TopOrganizations { get; set; } = [];
    public List<DashboardDailyAuditCount> AuditDailyCounts { get; set; } = [];
}

public class DashboardOrgDeviceCount
{
    public string OrganizationName { get; set; } = string.Empty;
    public int DeviceCount { get; set; }
}

public class DashboardDailyAuditCount
{
    public string Date { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class LabelValueOption
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}
