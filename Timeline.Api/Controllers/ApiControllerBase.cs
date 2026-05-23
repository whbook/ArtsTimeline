using Microsoft.AspNetCore.Mvc;
using Timeline.Api.Models;

namespace Timeline.Api.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected Guid? GetAdminUserId()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(sub, out var id) ? id : null;
    }

    protected string? GetAdminUsername() =>
        User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

    protected string? GetClientIp()
    {
        var forwarded = Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
            return forwarded.Split(',')[0].Trim();
        return HttpContext.Connection.RemoteIpAddress?.ToString();
    }

    protected string? GetUserAgent() =>
        Request.Headers["X-User-Agent"].FirstOrDefault()
        ?? Request.Headers.UserAgent.FirstOrDefault();

    protected bool CanWrite() =>
        User.IsInRole(AdminRoles.SuperAdmin) || User.IsInRole(AdminRoles.Admin);
}
