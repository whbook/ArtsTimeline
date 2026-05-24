using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Timeline.Api.Data;
using Timeline.Api.Models;
using Timeline.Api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseWindowsService();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:DefaultConnection");

var stringNormalizationInterceptor = new StringNormalizationSaveChangesInterceptor();
builder.Services.AddDbContext<TimelineDbContext>(options =>
    options.UseNpgsql(connectionString)
        .UseSnakeCaseNamingConvention()
        .AddInterceptors(stringNormalizationInterceptor));

var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Missing Jwt:Secret");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "timeline-api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "timeline-admin";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireAuthenticatedUser().RequireClaim("scope", "admin"));
    options.AddPolicy("AdminSuperAdmin", p => p.RequireAuthenticatedUser().RequireClaim("scope", "admin").RequireRole("super_admin"));
});

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AuditLogService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<ExhibitionAutoSeeder>();
builder.Services.AddScoped<ExhibitionDataImporter>();
builder.Services.AddScoped<ExhibitionDataFileWriter>();
builder.Services.AddScoped<BootstrapAdminSeeder>();

builder.Services.Configure<OssSettings>(builder.Configuration.GetSection("Oss"));
builder.Services.AddHttpClient("oss-upload");
builder.Services.AddScoped<OssFileUploadService>();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AdminCors", p =>
    {
        var origins = builder.Configuration.GetSection("Cors:AdminOrigins").Get<string[]>()
            ?? ["http://localhost:5102", "https://localhost:5102"];
        p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
    options.AddPolicy("PublicCors", p =>
    {
        p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TimelineDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        await TimelineSchemaStartupPatches.ApplyAllAsync(db, scope.ServiceProvider, logger);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "启动数据库补丁失败");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
app.UseCors("AdminCors");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
