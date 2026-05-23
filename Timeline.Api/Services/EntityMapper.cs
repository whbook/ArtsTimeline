using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Models;
using Timeline.Api.Models.DTOs;

namespace Timeline.Api.Services;

public static class IpAddressValidator
{
    public static List<string> ParseAndValidate(IEnumerable<string>? lines)
    {
        var result = new List<string>();
        if (lines is null) return result;

        foreach (var raw in lines)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var line = raw.Trim();
            if (!IPAddress.TryParse(line, out _))
                throw new ArgumentException($"无效的 IP 地址：{line}");
            result.Add(line);
        }

        return result.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }
}

public static class EntityMapper
{
    public static OrganizationResponse ToResponse(Organization o) => new(
        o.Id, o.Code, o.Name, o.Phone, o.ContactName, o.ContactPhone, o.ContactEmail,
        o.Introduction, o.WebsiteUrl, o.Province, o.City, o.District, o.Address,
        o.IsActive, o.CreatedAt, o.UpdatedAt);

    public static ExhibitionResponse ToResponse(Exhibition e) => new(
        e.Id, e.Slug, e.TitleCn, e.TitleEn, e.Description, e.Color, e.SortOrder, e.IsPublished,
        e.DefaultViewportStartYear, e.DefaultViewportEndYear, e.MinZoomRange, e.MaxZoomRange,
        e.PlaybackSpeed, e.InitialZoom, e.Chunked, e.EventFieldsJson, e.ContentVersion, e.CreatedAt, e.UpdatedAt);

    public static GlobalSettingsResponse ToResponse(GlobalSettings s) => new(
        s.AutoplayIdleTimeoutMs, s.AutoplayMode, s.AutoplayBaseSpeed, s.AutoplayFastSpeed,
        s.MinZoomRangeGlobal, s.MaxZoomRangeGlobal, s.BaseScreenWidth, s.BaseScreenHeight,
        s.BaseColumnWidth, s.ImportanceThresholdsJson, s.UpdatedAt);

    public static DeviceResponse ToResponse(Device d) => new(
        d.Id, d.OrganizationId, d.Organization?.Name ?? string.Empty, d.DeviceCode,
        d.ScreenWidth, d.ScreenHeight, d.OsVersion, d.LicenseType,
        d.ValidFrom, d.ValidUntil, d.IsActive, d.LastSeenAt,
        d.IpAddresses.ToList(), d.Notes,
        d.DeviceExhibitions.OrderBy(x => x.SortOrder).Select(x => new DeviceExhibitionAssignmentResponse(
            x.ExhibitionId, x.Exhibition?.Slug ?? string.Empty, x.Exhibition?.TitleCn ?? string.Empty,
            x.SortOrder, x.IsDefault, x.OverridesJson)).ToList(),
        d.CreatedAt, d.UpdatedAt);

    public static void ApplyOrganization(Organization entity, CreateOrganizationRequest req)
    {
        entity.Code = req.Code;
        entity.Name = req.Name;
        entity.Phone = req.Phone;
        entity.ContactName = req.ContactName;
        entity.ContactPhone = req.ContactPhone;
        entity.ContactEmail = req.ContactEmail;
        entity.Introduction = req.Introduction;
        entity.WebsiteUrl = req.WebsiteUrl;
        entity.Province = req.Province;
        entity.City = req.City;
        entity.District = req.District;
        entity.Address = req.Address;
        entity.IsActive = req.IsActive;
    }

    public static void ApplyExhibition(Exhibition entity, CreateExhibitionRequest req)
    {
        entity.Slug = req.Slug;
        entity.TitleCn = req.TitleCn;
        entity.TitleEn = req.TitleEn;
        entity.Description = req.Description;
        entity.Color = req.Color;
        entity.SortOrder = req.SortOrder;
        entity.IsPublished = req.IsPublished;
        entity.DefaultViewportStartYear = req.DefaultViewportStartYear;
        entity.DefaultViewportEndYear = req.DefaultViewportEndYear;
        entity.MinZoomRange = req.MinZoomRange;
        entity.MaxZoomRange = req.MaxZoomRange;
        entity.PlaybackSpeed = req.PlaybackSpeed;
        entity.InitialZoom = req.InitialZoom;
        entity.Chunked = req.Chunked;
        entity.EventFieldsJson = req.EventFieldsJson;
    }

    public static void ValidateExhibition(CreateExhibitionRequest req)
    {
        if (req.DefaultViewportStartYear >= req.DefaultViewportEndYear)
            throw new ArgumentException("默认视口起始年必须小于结束年");
        if (req.MinZoomRange <= 0 || req.MaxZoomRange <= req.MinZoomRange)
            throw new ArgumentException("缩放范围无效");
        if (req.PlaybackSpeed <= 0)
            throw new ArgumentException("播放速度必须大于 0");
        if (req.InitialZoom <= 0)
            throw new ArgumentException("初始放大倍数必须大于 0");
        JsonDocument.Parse(req.EventFieldsJson);
    }
}
