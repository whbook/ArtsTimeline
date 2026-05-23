using System.Globalization;
using System.Security.Cryptography;
using Timeline.AdminBlazor.Components;
using Timeline.AdminBlazor.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Syncfusion.Blazor;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService();

var keysPath = builder.Configuration["DataProtection:KeysPath"];
if (string.IsNullOrWhiteSpace(keysPath))
    keysPath = Path.Combine(AppContext.BaseDirectory, "dataprotection-keys");
Directory.CreateDirectory(keysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keysPath))
    .SetApplicationName("Timeline.AdminBlazor");

builder.Services.AddRazorComponents().AddInteractiveServerComponents();
builder.Services.AddAuthentication();
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IAuthorizationMiddlewareResultHandler, BlazorPassthroughAuthHandler>();
builder.Services.AddSyncfusionBlazor();
builder.Services.AddLocalization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddScoped<TokenProvider>();
builder.Services.AddScoped<AuthenticationStateProvider, JwtAuthStateProvider>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ToastService>();
builder.Services.AddTransient<AuthTokenHandler>();
builder.Services.AddHttpClient<AdminApiClient>(c =>
    c.BaseAddress = new Uri(builder.Configuration["ApiBaseUrl"] ?? "http://localhost:5287/"))
    .AddHttpMessageHandler<AuthTokenHandler>();

var app = builder.Build();
var syncfusionLicense = builder.Configuration["Syncfusion:LicenseKey"];
if (!string.IsNullOrWhiteSpace(syncfusionLicense))
    Syncfusion.Licensing.SyncfusionLicenseProvider.RegisterLicense(syncfusionLicense);

if (!app.Environment.IsDevelopment())
    app.UseExceptionHandler("/Error", createScopeForErrors: true);

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseRequestLocalization(new RequestLocalizationOptions()
    .SetDefaultCulture("zh-CN")
    .AddSupportedCultures("zh-CN", "en-US")
    .AddSupportedUICultures("zh-CN", "en-US"));

app.Use(async (context, next) =>
{
    var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
    context.Items["CspNonce"] = nonce;
    var csp = "base-uri 'self'; default-src 'self'; connect-src 'self' https: http: ws: wss:; img-src 'self' data: https:; object-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'nonce-" + nonce + "'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;";
    if (!app.Environment.IsDevelopment())
        csp += " upgrade-insecure-requests;";
    context.Response.Headers.Append("Content-Security-Policy", csp);
    await next();
});

app.UseAntiforgery();
app.MapStaticAssets();
app.MapGet("/favicon.ico", (IWebHostEnvironment env) =>
{
    var svgPath = Path.Combine(env.WebRootPath, "favicon.svg");
    return File.Exists(svgPath)
        ? Results.File(svgPath, "image/svg+xml")
        : Results.NotFound();
});
app.MapRazorComponents<App>().AddInteractiveServerRenderMode();
app.Run();

class BlazorPassthroughAuthHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _default = new();
    public Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult result)
    {
        var isBlazor = context.GetEndpoint()?.Metadata
            .GetMetadata<Microsoft.AspNetCore.Components.Endpoints.RootComponentMetadata>() != null;
        return isBlazor ? next(context) : _default.HandleAsync(next, context, policy, result);
    }
}
