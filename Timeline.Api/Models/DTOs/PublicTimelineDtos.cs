using System.Text.Json.Nodes;

namespace Timeline.Api.Models.DTOs;

public record PublicExhibitionListItemResponse(
    string Id,
    string TitleCn,
    string TitleEn,
    string Color
);

public record PublicViewport(int StartYear, int EndYear);

public record PublicExhibitionResponse(
    string Id,
    string TitleCn,
    string TitleEn,
    string? Description,
    string Color,
    PublicViewport DefaultViewport,
    decimal MinZoomRange,
    decimal MaxZoomRange,
    decimal PlaybackSpeed,
    decimal InitialZoom,
    bool Chunked,
    JsonNode EventFields
);
