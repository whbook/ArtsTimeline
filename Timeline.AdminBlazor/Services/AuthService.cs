using Timeline.AdminBlazor.Models;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Server.ProtectedBrowserStorage;

namespace Timeline.AdminBlazor.Services;

public class AuthService
{
    private readonly ProtectedLocalStorage _storage;
    private readonly JwtAuthStateProvider _authStateProvider;
    private readonly AdminApiClient _apiClient;

    public AuthService(ProtectedLocalStorage storage, AuthenticationStateProvider authStateProvider, AdminApiClient apiClient)
    {
        _storage = storage;
        _authStateProvider = (JwtAuthStateProvider)authStateProvider;
        _apiClient = apiClient;
    }

    public async Task<(bool Ok, string? Error)> LoginAsync(string username, string password)
    {
        try
        {
            var resp = await _apiClient.Client.PostAsJsonAsync("api/auth/admin/login",
                new AdminLoginRequest { Username = username, Password = password });
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                return (false, string.IsNullOrWhiteSpace(err) ? "用户名或密码错误" : err.Trim('"'));
            }
            var login = await resp.Content.ReadFromJsonAsync<LoginResponse>();
            if (login is null) return (false, "登录响应解析失败");
            await _storage.SetAsync("auth_token", login.Token);
            _apiClient.SetToken(login.Token);
            _authStateProvider.NotifyUserAuthentication(login.Token);
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public async Task LogoutAsync()
    {
        await _storage.DeleteAsync("auth_token");
        _apiClient.SetToken(null);
        _authStateProvider.NotifyUserLogout();
    }

    public async Task InitializeAsync()
    {
        try
        {
            var result = await _storage.GetAsync<string>("auth_token");
            if (result.Success && !string.IsNullOrEmpty(result.Value))
                _apiClient.SetToken(result.Value);
        }
        catch { }
    }

    public async Task<bool> RestoreSessionAsync()
    {
        if (_authStateProvider.IsAuthenticated) return true;

        try
        {
            var result = await _storage.GetAsync<string>("auth_token");
            if (result.Success && !string.IsNullOrEmpty(result.Value))
            {
                _apiClient.SetToken(result.Value);
                _authStateProvider.NotifyUserAuthentication(result.Value);
                return true;
            }
        }
        catch { }

        return false;
    }
}

public class ToastService
{
    public event Action<string, string>? OnShow;
    public void Success(string msg) => OnShow?.Invoke(msg, "success");
    public void Error(string msg) => OnShow?.Invoke(msg, "danger");
    public void Info(string msg) => OnShow?.Invoke(msg, "info");
}
