namespace Timeline.Api.Models.DTOs;

public record OrganizationListItemResponse(
    Guid Id,
    string Code,
    string Name,
    string? ContactName,
    string? Phone,
    bool IsActive,
    int DeviceCount,
    DateTime CreatedAt);

public record OrganizationResponse(
    Guid Id,
    string Code,
    string Name,
    string? Phone,
    string? ContactName,
    string? ContactPhone,
    string? ContactEmail,
    string? Introduction,
    string? WebsiteUrl,
    string? Province,
    string? City,
    string? District,
    string? Address,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public class CreateOrganizationRequest
{
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

public class UpdateOrganizationRequest : CreateOrganizationRequest;

public class OrganizationListFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Keyword { get; set; }
    public bool? IsActive { get; set; }
}

public record OrganizationPageResult(
    List<OrganizationListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record DeviceListItemResponse(
    Guid Id,
    string DeviceCode,
    string OrganizationName,
    string LicenseType,
    DateTime ValidFrom,
    DateTime ValidUntil,
    bool IsActive,
    bool IsExpired,
    DateTime? LastSeenAt,
    int ExhibitionCount);

public record DeviceExhibitionAssignmentResponse(
    Guid ExhibitionId,
    string Slug,
    string TitleCn,
    int SortOrder,
    bool IsDefault,
    string? OverridesJson);

public record DeviceResponse(
    Guid Id,
    Guid OrganizationId,
    string OrganizationName,
    string DeviceCode,
    int ScreenWidth,
    int ScreenHeight,
    string? OsVersion,
    string LicenseType,
    DateTime ValidFrom,
    DateTime ValidUntil,
    bool IsActive,
    DateTime? LastSeenAt,
    List<string> IpAddresses,
    string? Notes,
    List<DeviceExhibitionAssignmentResponse> Exhibitions,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public class CreateDeviceRequest
{
    public Guid OrganizationId { get; set; }
    public string DeviceCode { get; set; } = string.Empty;
    public int ScreenWidth { get; set; } = 1920;
    public int ScreenHeight { get; set; } = 1080;
    public string? OsVersion { get; set; }
    public string LicenseType { get; set; } = "trial";
    public DateTime ValidFrom { get; set; }
    public DateTime ValidUntil { get; set; }
    public List<string> IpAddresses { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public List<DeviceExhibitionAssignmentRequest> Exhibitions { get; set; } = [];
}

public class UpdateDeviceRequest : CreateDeviceRequest;

public class DeviceExhibitionAssignmentRequest
{
    public Guid ExhibitionId { get; set; }
    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public string? OverridesJson { get; set; }
}

public class DeviceListFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Keyword { get; set; }
    public Guid? OrganizationId { get; set; }
    public string? LicenseType { get; set; }
    public bool? IsActive { get; set; }
}

public record DevicePageResult(
    List<DeviceListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record ExhibitionSyncResult(int Count, string Message);

public record ExhibitionListItemResponse(
    Guid Id,
    string Slug,
    string TitleCn,
    string TitleEn,
    string? Description,
    string Color,
    int SortOrder,
    bool IsPublished,
    decimal PlaybackSpeed,
    bool Chunked,
    decimal InitialZoom,
    decimal MinZoomRange,
    decimal MaxZoomRange,
    int DefaultViewportStartYear,
    int DefaultViewportEndYear,
    string EventFieldsJson);

public record ExhibitionResponse(
    Guid Id,
    string Slug,
    string TitleCn,
    string TitleEn,
    string? Description,
    string Color,
    int SortOrder,
    bool IsPublished,
    int DefaultViewportStartYear,
    int DefaultViewportEndYear,
    decimal MinZoomRange,
    decimal MaxZoomRange,
    decimal PlaybackSpeed,
    decimal InitialZoom,
    bool Chunked,
    string EventFieldsJson,
    int ContentVersion,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public class CreateExhibitionRequest
{
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

public class UpdateExhibitionRequest : CreateExhibitionRequest;

public class ExhibitionReorderRequest
{
    public List<ExhibitionOrderItem> Items { get; set; } = [];
}

public class ExhibitionOrderItem
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
}

public record GlobalSettingsResponse(
    int AutoplayIdleTimeoutMs,
    string AutoplayMode,
    decimal AutoplayBaseSpeed,
    decimal AutoplayFastSpeed,
    decimal MinZoomRangeGlobal,
    decimal MaxZoomRangeGlobal,
    int BaseScreenWidth,
    int BaseScreenHeight,
    int BaseColumnWidth,
    string ImportanceThresholdsJson,
    DateTime UpdatedAt);

public class UpdateGlobalSettingsRequest
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

public record AdminUserListItemResponse(
    Guid Id,
    string Username,
    string Email,
    string Role,
    bool IsActive,
    DateTime CreatedAt);

public record AdminUserResponse(
    Guid Id,
    string Username,
    string Email,
    string Role,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public class CreateAdminUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "admin";
    public bool IsActive { get; set; } = true;
}

public class UpdateAdminUserRequest
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}

public record AuditLogListItemResponse(
    Guid Id,
    string? AdminUsername,
    string Action,
    string EntityType,
    string? EntityLabel,
    string Summary,
    string? IpAddress,
    DateTime CreatedAt);

public class AuditLogFilter
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Keyword { get; set; }
    public string? EntityType { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}

public record AuditLogPageResult(
    List<AuditLogListItemResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public record DashboardSummaryResponse(
    int OrganizationTotal,
    int OrganizationActive,
    int OrganizationInactive,
    int DeviceTotal,
    int DeviceFormal,
    int DeviceTrial,
    int DeviceExpired,
    int DeviceExpiring7Days,
    int DeviceExpiring30Days,
    int DeviceHealthy,
    int ExhibitionTotal,
    int ExhibitionPublished,
    int AuditLogsLast7Days,
    List<DashboardOrgDeviceCount> TopOrganizations,
    List<DashboardDailyAuditCount> AuditDailyCounts);

public record DashboardOrgDeviceCount(string OrganizationName, int DeviceCount);

public record DashboardDailyAuditCount(string Date, int Count);

public record LabelValueOption(string Value, string Label);

public class FuzzyDateDto
{
    public int Year { get; set; }
    public byte? Month { get; set; }
    public byte? Day { get; set; }
    public string Accuracy { get; set; } = "exact";
    public int? OrYear { get; set; }
    public byte? OrMonth { get; set; }
    public byte? OrDay { get; set; }
}

public class PeriodDto
{
    public string Id { get; set; } = string.Empty;
    public Guid ExhibitionId { get; set; }
    public string NameCn { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string ColorHex { get; set; } = string.Empty;
    public string ColorBackground { get; set; } = string.Empty;
    public string? Description { get; set; }
    public FuzzyDateDto Start { get; set; } = new();
    public FuzzyDateDto End { get; set; } = new();
}

public class StreamDto
{
    public string Id { get; set; } = string.Empty;
    public Guid ExhibitionId { get; set; }
    public string? PeriodId { get; set; }
    public string NameCn { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Lane { get; set; }
    public string? DescriptionCn { get; set; }
    public string? DescriptionEn { get; set; }
    public FuzzyDateDto Start { get; set; } = new();
    public FuzzyDateDto End { get; set; } = new();
}

public class TimelineEventDto
{
    public string Id { get; set; } = string.Empty;
    public Guid ExhibitionId { get; set; }
    public string? PeriodId { get; set; }
    public string? StreamId { get; set; }
    public string TitleCn { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string? CreatorCn { get; set; }
    public string? CreatorEn { get; set; }
    public string? Location { get; set; }
    public string? ImageUrl { get; set; }
    public string? DetailPageUrl { get; set; }
    public string? HighResImageUrl { get; set; }
    public string? DescriptionCn { get; set; }
    public string? DescriptionEn { get; set; }
    public int Importance { get; set; } = 3;
    public List<string> Tags { get; set; } = [];
    public string MetaJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public FuzzyDateDto Date { get; set; } = new();
    public FuzzyDateDto? EndDate { get; set; }
}

public class TimelineEventPageResult
{
    public List<TimelineEventDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
