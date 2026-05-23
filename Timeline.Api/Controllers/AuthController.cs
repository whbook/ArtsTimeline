using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Timeline.Api.Models;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Route("api/auth/admin")]
public class AuthController : ApiControllerBase
{
    private readonly AuthService _auth;
    private readonly AuditLogService _audit;

    public AuthController(AuthService auth, AuditLogService audit)
    {
        _auth = auth;
        _audit = audit;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] AdminLoginRequest request, CancellationToken ct)
    {
        var result = await _auth.LoginAdminAsync(request, ct);
        if (result is null)
        {
            await _audit.LogAsync(null, request.Username, AuditActions.Login, AuditEntityTypes.System,
                null, request.Username, "管理端登录失败", ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
            return Unauthorized("用户名或密码错误");
        }

        await _audit.LogAsync(null, result.Username, AuditActions.Login, AuditEntityTypes.System,
            null, result.Username, "管理端登录成功", ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<AdminUserInfoResponse>> Me(CancellationToken ct)
    {
        var userId = GetAdminUserId();
        if (userId is null) return Unauthorized();
        var user = await _auth.GetCurrentUserAsync(userId.Value, ct);
        return user is null ? Unauthorized() : Ok(user);
    }

    [HttpPost("change-password")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangeOwnPasswordRequest? request, CancellationToken ct)
    {
        if (request is null) return BadRequest("请求体无效");

        var userId = GetAdminUserId();
        if (userId is null) return Unauthorized();

        var (ok, err) = await _auth.ChangeAdminOwnPasswordAsync(
            userId.Value, request.OldPassword ?? string.Empty, request.NewPassword ?? string.Empty, ct);
        if (!ok)
        {
            await _audit.LogAsync(userId, GetAdminUsername(), AuditActions.ChangePassword, AuditEntityTypes.AdminUser,
                userId, GetAdminUsername(), "修改密码失败", detail: new { error = err },
                ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
            return BadRequest(err ?? "修改失败");
        }

        await _audit.LogAsync(userId, GetAdminUsername(), AuditActions.ChangePassword, AuditEntityTypes.AdminUser,
            userId, GetAdminUsername(), "修改密码成功",
            ipAddress: GetClientIp(), userAgent: GetUserAgent(), ct: ct);
        return NoContent();
    }
}