namespace Timeline.Api.Models;

public class AdminUser
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "admin";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class Organization
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
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<Device> Devices { get; set; } = new List<Device>();
}

public class Device
{
    public Guid Id { get; set; }
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
    public DateTime? LastSeenAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public ICollection<DeviceExhibition> DeviceExhibitions { get; set; } = new List<DeviceExhibition>();
}

public class Exhibition
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
    public int ContentVersion { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<DeviceExhibition> DeviceExhibitions { get; set; } = new List<DeviceExhibition>();
}

public class GlobalSettings
{
    public int Id { get; set; } = 1;
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
    public DateTime UpdatedAt { get; set; }
}

public class DeviceExhibition
{
    public Guid Id { get; set; }
    public Guid DeviceId { get; set; }
    public Guid ExhibitionId { get; set; }
    public int SortOrder { get; set; }
    public bool IsDefault { get; set; }
    public string? OverridesJson { get; set; }

    public Device Device { get; set; } = null!;
    public Exhibition Exhibition { get; set; } = null!;
}

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? AdminUserId { get; set; }
    public string? AdminUsername { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? EntityLabel { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string? DetailJson { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DeviceAccessLog
{
    public Guid Id { get; set; }
    public Guid? DeviceId { get; set; }
    public Guid? OrganizationId { get; set; }
    public DateTime AccessedAt { get; set; }
    public string? ClientIp { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
}

public class SchemaPatch
{
    public string PatchId { get; set; } = string.Empty;
    public DateTime AppliedAt { get; set; }
}

public static class AdminRoles
{
    public const string SuperAdmin = "super_admin";
    public const string Admin = "admin";
    public const string Viewer = "viewer";

    public static readonly HashSet<string> WriteRoles = [SuperAdmin, Admin];
}

public static class LicenseTypes
{
    public const string Trial = "trial";
    public const string Formal = "formal";
}

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
    public string Scope { get; set; } = "admin";
    public DateTime ExpiresAt { get; set; }
}

public class AdminUserInfoResponse
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class ChangeOwnPasswordRequest
{
    public string OldPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class FuzzyDate
{
    public int Year { get; set; }
    public byte? Month { get; set; }
    public byte? Day { get; set; }
    public string Accuracy { get; set; } = "exact"; // exact, approximate, not_before, not_after, either_or
    public int? OrYear { get; set; }
    public byte? OrMonth { get; set; }
    public byte? OrDay { get; set; }
}

public class Period
{
    public Guid Id { get; set; } = Guid.Empty;
    public Guid ExhibitionId { get; set; }
    public string NameCn { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string ColorHex { get; set; } = string.Empty;
    public string ColorBackground { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Navigation properties
    public Exhibition Exhibition { get; set; } = null!;
    public ICollection<Swimlane> Swimlanes { get; set; } = new List<Swimlane>();
    public ICollection<TimelineEvent> Events { get; set; } = new List<TimelineEvent>();

    // Owned Fuzzy Dates
    public FuzzyDate Start { get; set; } = new();
    public FuzzyDate End { get; set; } = new();
}

public class Swimlane
{
    public Guid Id { get; set; } = Guid.Empty;
    public Guid ExhibitionId { get; set; }
    public Guid? PeriodId { get; set; }
    public string NameCn { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Lane { get; set; }
    public string? DescriptionCn { get; set; }
    public string? DescriptionEn { get; set; }

    // Navigation properties
    public Exhibition Exhibition { get; set; } = null!;
    public Period? Period { get; set; }
    public ICollection<TimelineEvent> Events { get; set; } = new List<TimelineEvent>();

    // Owned Fuzzy Dates
    public FuzzyDate Start { get; set; } = new();
    public FuzzyDate End { get; set; } = new();
}

public class TimelineEvent
{
    public Guid Id { get; set; } = Guid.Empty;
    public Guid ExhibitionId { get; set; }
    public Guid? PeriodId { get; set; }
    public Guid? SwimlaneId { get; set; }
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
    public int Importance { get; set; } = 3; // 1-5
    public List<string> Tags { get; set; } = [];
    public string MetaJson { get; set; } = "{}"; // JSONB properties
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Exhibition Exhibition { get; set; } = null!;
    public Period? Period { get; set; }
    public Swimlane? Swimlane { get; set; }

    // Owned Fuzzy Dates
    public FuzzyDate Date { get; set; } = new();
    public FuzzyDate? EndDate { get; set; }
}
