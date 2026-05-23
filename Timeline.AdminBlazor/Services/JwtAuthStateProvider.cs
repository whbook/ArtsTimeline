using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Server.ProtectedBrowserStorage;

namespace Timeline.AdminBlazor.Services;

public class JwtAuthStateProvider : AuthenticationStateProvider
{
    private readonly ProtectedLocalStorage _storage;
    private readonly TokenProvider _tokenProvider;
    private static readonly AuthenticationState Anonymous =
        new(new ClaimsPrincipal(new ClaimsIdentity()));

    private AuthenticationState? _cached;

    public JwtAuthStateProvider(ProtectedLocalStorage storage, TokenProvider tokenProvider)
    {
        _storage = storage;
        _tokenProvider = tokenProvider;
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        if (_cached != null) return _cached;
        try
        {
            var result = await _storage.GetAsync<string>("auth_token");
            if (!result.Success || string.IsNullOrEmpty(result.Value)) return Anonymous;
            _tokenProvider.Token = result.Value;
            _cached = BuildState(ParseClaims(result.Value));
            return _cached;
        }
        catch { return Anonymous; }
    }

    public bool IsAuthenticated => _cached?.User.Identity?.IsAuthenticated == true;

    public void NotifyUserAuthentication(string token)
    {
        _tokenProvider.Token = token;
        _cached = BuildState(ParseClaims(token));
        NotifyAuthenticationStateChanged(Task.FromResult(_cached));
    }

    public void NotifyUserLogout()
    {
        _tokenProvider.Token = null;
        _cached = null;
        NotifyAuthenticationStateChanged(Task.FromResult(Anonymous));
    }

    private static AuthenticationState BuildState(IEnumerable<Claim> claims)
    {
        var identity = new ClaimsIdentity(claims, "jwt");
        return new AuthenticationState(new ClaimsPrincipal(identity));
    }

    private static IEnumerable<Claim> ParseClaims(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3) return [];
        var payload = parts[1];
        payload = (payload.Length % 4) switch { 2 => payload + "==", 3 => payload + "=", _ => payload };
        try
        {
            var jsonBytes = Convert.FromBase64String(payload.Replace('-', '+').Replace('_', '/'));
            using var doc = JsonDocument.Parse(jsonBytes);
            var claims = new List<Claim>();
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var type = prop.Name switch
                {
                    "sub" => ClaimTypes.NameIdentifier,
                    "unique_name" or "name" => ClaimTypes.Name,
                    "role" => ClaimTypes.Role,
                    _ => prop.Name
                };
                if (prop.Value.ValueKind == JsonValueKind.Array)
                    foreach (var item in prop.Value.EnumerateArray())
                        claims.Add(new Claim(type, item.GetString() ?? ""));
                else
                    claims.Add(new Claim(type, prop.Value.ToString()));
            }
            return claims;
        }
        catch { return []; }
    }
}
