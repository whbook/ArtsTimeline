using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Timeline.Api.Data;
using Timeline.Api.Models;

namespace Timeline.Api.Services;

public class AuthService
{
    private readonly TimelineDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(TimelineDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<LoginResponse?> LoginAdminAsync(AdminLoginRequest request, CancellationToken ct = default)
    {
        var user = await _db.AdminUsers.FirstOrDefaultAsync(
            u => u.Username == request.Username && u.IsActive, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        return new LoginResponse
        {
            Token = GenerateAdminJwtToken(user),
            Username = user.Username,
            Role = user.Role,
            Scope = "admin",
            ExpiresAt = DateTime.UtcNow.AddHours(_config.GetValue("Jwt:ExpiryHours", 24))
        };
    }

    public async Task<AdminUserInfoResponse?> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.AdminUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        return user is null ? null : new AdminUserInfoResponse
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Role = user.Role
        };
    }

    public async Task<(bool Ok, string? Error)> ChangeAdminOwnPasswordAsync(
        Guid userId, string oldPassword, string newPassword, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(oldPassword))
            return (false, "请输入当前密码");
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            return (false, "新密码不能少于 8 位");

        var user = await _db.AdminUsers.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, ct);
        if (user is null)
            return (false, "用户不存在");
        if (!BCrypt.Net.BCrypt.Verify(oldPassword, user.PasswordHash))
            return (false, "当前密码不正确");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return (true, null);
    }

    private string GenerateAdminJwtToken(AdminUser user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(GetJwtSecret()));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("scope", "admin"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(_config.GetValue("Jwt:ExpiryHours", 24)),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GetJwtSecret()
    {
        var secret = _config["Jwt:Secret"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
            throw new InvalidOperationException("Jwt:Secret 未配置或长度不足");
        return secret;
    }
}
