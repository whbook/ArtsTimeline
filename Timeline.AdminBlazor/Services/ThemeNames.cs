namespace Timeline.AdminBlazor.Services;

/// <summary>
/// Syncfusion 主题白名单：排除会通过 @import 加载 Google Fonts 的主题（Material3/Tailwind），以符合 CSP 与零 CDN 策略。
/// </summary>
public static class ThemeNames
{
    public const string Default = "bootstrap5.3";

    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "bootstrap5.3",
        "bootstrap5.3-dark",
        "fluent2",
        "fluent2-dark",
        "highcontrast",
    };

    /// <summary>依赖 Google Fonts 的主题 → 映射为不依赖外网的等价主题。</summary>
    private static readonly Dictionary<string, string> CdnThemeFallback = new(StringComparer.OrdinalIgnoreCase)
    {
        ["material3"] = "bootstrap5.3",
        ["material3-dark"] = "bootstrap5.3-dark",
        ["tailwind3"] = "bootstrap5.3",
        ["tailwind3-dark"] = "bootstrap5.3-dark",
        ["tailwind"] = "bootstrap5.3",
        ["tailwind-dark"] = "bootstrap5.3-dark",
        ["material"] = "bootstrap5.3",
        ["material-dark"] = "bootstrap5.3-dark",
    };

    public static string Normalize(string? themeName)
    {
        var raw = (themeName ?? Default).Trim();
        if (Allowed.Contains(raw)) return raw.ToLowerInvariant();
        if (CdnThemeFallback.TryGetValue(raw, out var mapped)) return mapped;
        return raw.EndsWith("-dark", StringComparison.OrdinalIgnoreCase) ? "bootstrap5.3-dark" : Default;
    }

    public static IReadOnlyList<(string Id, string Name)> SwitcherOptions { get; } =
    [
        ("bootstrap5.3",      "Bootstrap 5.3"),
        ("bootstrap5.3-dark", "Bootstrap 5.3 Dark"),
        ("fluent2",           "Fluent 2"),
        ("fluent2-dark",      "Fluent 2 Dark"),
        ("highcontrast",      "High Contrast"),
    ];
}
