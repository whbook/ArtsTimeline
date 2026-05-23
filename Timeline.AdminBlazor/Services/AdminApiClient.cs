using System.Net.Http.Headers;
using System.Text.Json;
using Timeline.AdminBlazor.Models;

namespace Timeline.AdminBlazor.Services;

public class AdminApiClient
{
    public HttpClient Client { get; }
    private readonly TokenProvider _tokenProvider;

    public AdminApiClient(HttpClient client, TokenProvider tokenProvider)
    {
        Client = client;
        _tokenProvider = tokenProvider;
    }

    public void SetToken(string? token)
    {
        _tokenProvider.Token = string.IsNullOrWhiteSpace(token) ? null : token;
        ApplyBearerToken();
    }

    private void ApplyBearerToken()
    {
        Client.DefaultRequestHeaders.Authorization = string.IsNullOrWhiteSpace(_tokenProvider.Token)
            ? null
            : new AuthenticationHeaderValue("Bearer", _tokenProvider.Token);
    }

    public void SetUserAgent(string ua)
    {
        Client.DefaultRequestHeaders.Remove("X-User-Agent");
        if (!string.IsNullOrWhiteSpace(ua))
            Client.DefaultRequestHeaders.TryAddWithoutValidation("X-User-Agent", ua);
    }

    private async Task<T?> GetAsync<T>(string url)
    {
        ApplyBearerToken();
        var resp = await Client.GetAsync(url);
        if (!resp.IsSuccessStatusCode) return default;
        return await resp.Content.ReadFromJsonAsync<T>();
    }

    private async Task<string?> ReadError(HttpResponseMessage resp)
    {
        try
        {
            var body = await resp.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(body))
                return resp.StatusCode == System.Net.HttpStatusCode.Unauthorized
                    ? "登录已过期或未授权，请重新登录"
                    : resp.ReasonPhrase is { Length: > 0 } reason
                        ? reason
                        : $"请求失败（HTTP {(int)resp.StatusCode}）";

            if (body.TrimStart().StartsWith('"'))
                return body.Trim().Trim('"');

            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                if (root.TryGetProperty("message", out var msg) && msg.ValueKind == JsonValueKind.String)
                    return msg.GetString();
                if (root.TryGetProperty("detail", out var detail) && detail.ValueKind == JsonValueKind.String)
                    return detail.GetString();
                if (root.TryGetProperty("title", out var title) && title.ValueKind == JsonValueKind.String)
                    return title.GetString();
            }
            catch { }

            return body.Trim();
        }
        catch
        {
            return $"请求失败（HTTP {(int)resp.StatusCode}）";
        }
    }

    public Task<DashboardSummary?> GetDashboardAsync() =>
        GetAsync<DashboardSummary>("api/dashboard/summary");

    public async Task<OrganizationPageResult?> GetOrganizationsAsync(int page = 1, int pageSize = 50, string? keyword = null)
    {
        var url = $"api/organizations?page={page}&pageSize={pageSize}";
        if (!string.IsNullOrWhiteSpace(keyword)) url += $"&keyword={Uri.EscapeDataString(keyword)}";
        return await GetAsync<OrganizationPageResult>(url);
    }

    public Task<OrganizationModel?> GetOrganizationAsync(Guid id) =>
        GetAsync<OrganizationModel>($"api/organizations/{id}");

    public async Task<(bool Ok, string? Error)> SaveOrganizationAsync(OrganizationModel model, bool isNew)
    {
        var resp = isNew
            ? await Client.PostAsJsonAsync("api/organizations", model)
            : await Client.PutAsJsonAsync($"api/organizations/{model.Id}", model);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(bool Ok, string? Error)> DeleteOrganizationAsync(Guid id)
    {
        var resp = await Client.DeleteAsync($"api/organizations/{id}");
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<DevicePageResult?> GetDevicesAsync(string? keyword = null)
    {
        var url = "api/devices?page=1&pageSize=200";
        if (!string.IsNullOrWhiteSpace(keyword)) url += $"&keyword={Uri.EscapeDataString(keyword)}";
        return await GetAsync<DevicePageResult>(url);
    }

    public async Task<JsonElement?> GetDeviceRawAsync(Guid id)
    {
        var resp = await Client.GetAsync($"api/devices/{id}");
        if (!resp.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    public async Task<(bool Ok, string? Error)> SaveDeviceAsync(object payload, bool isNew, Guid? id = null)
    {
        var resp = isNew
            ? await Client.PostAsJsonAsync("api/devices", payload)
            : await Client.PutAsJsonAsync($"api/devices/{id}", payload);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(bool Ok, string? Error)> DeleteDeviceAsync(Guid id)
    {
        var resp = await Client.DeleteAsync($"api/devices/{id}");
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(List<ExhibitionListItem>? Items, string? Error)> GetExhibitionsWithErrorAsync()
    {
        ApplyBearerToken();
        var resp = await Client.GetAsync("api/exhibitions");
        if (!resp.IsSuccessStatusCode)
            return (null, await ReadError(resp));
        var items = await resp.Content.ReadFromJsonAsync<List<ExhibitionListItem>>();
        return (items, null);
    }

    public Task<List<ExhibitionListItem>?> GetExhibitionsAsync() =>
        GetAsync<List<ExhibitionListItem>>("api/exhibitions");

    public async Task<(bool Ok, int Count, string? Message, string? Error)> SyncExhibitionsFromDataAsync()
    {
        ApplyBearerToken();
        var resp = await Client.PostAsync("api/exhibitions/sync-from-data", null);
        if (!resp.IsSuccessStatusCode)
            return (false, 0, null, await ReadError(resp));
        var result = await resp.Content.ReadFromJsonAsync<ExhibitionSyncResult>();
        return (true, result?.Count ?? 0, result?.Message, null);
    }

    public Task<ExhibitionModel?> GetExhibitionAsync(Guid id) =>
        GetAsync<ExhibitionModel>($"api/exhibitions/{id}");

    public async Task<(bool Ok, string? Error)> SaveExhibitionAsync(ExhibitionModel model, bool isNew)
    {
        ApplyBearerToken();
        var resp = isNew
            ? await Client.PostAsJsonAsync("api/exhibitions", model)
            : await Client.PutAsJsonAsync($"api/exhibitions/{model.Id}", model);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(bool Ok, string? Error)> ReorderExhibitionsAsync(ExhibitionReorderRequest request)
    {
        ApplyBearerToken();
        var resp = await Client.PutAsJsonAsync("api/exhibitions/reorder", request);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public Task<GlobalSettingsModel?> GetGlobalSettingsAsync() =>
        GetAsync<GlobalSettingsModel>("api/global-settings");

    public async Task<(bool Ok, string? Error)> SaveGlobalSettingsAsync(GlobalSettingsModel model)
    {
        var resp = await Client.PutAsJsonAsync("api/global-settings", model);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public Task<AuditLogPageResult?> GetAuditLogsAsync(int page = 1) =>
        GetAsync<AuditLogPageResult>($"api/audit-logs?page={page}&pageSize=50");

    public Task<List<AdminUserListItem>?> GetAdminUsersAsync() =>
        GetAsync<List<AdminUserListItem>>("api/admin-users");

    public async Task<(bool Ok, string? Error)> ChangeOwnPasswordAsync(string oldPassword, string newPassword)
    {
        try
        {
            ApplyBearerToken();
            var resp = await Client.PostAsJsonAsync("api/auth/admin/change-password",
                new ChangeOwnPasswordRequest { OldPassword = oldPassword, NewPassword = newPassword });
            return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    #region Periods (分期管理)

    public Task<List<PeriodDto>?> GetPeriodsAsync(Guid exhibitionId) =>
        GetAsync<List<PeriodDto>>($"api/timeline-data/exhibitions/{exhibitionId}/periods");

    public async Task<(bool Ok, string? Error)> SavePeriodAsync(PeriodDto model, bool isNew)
    {
        var resp = isNew
            ? await Client.PostAsJsonAsync("api/timeline-data/periods", model)
            : await Client.PutAsJsonAsync($"api/timeline-data/periods/{model.Id}", model);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(bool Ok, string? Error)> DeletePeriodAsync(Guid exhibitionId, string id)
    {
        var resp = await Client.DeleteAsync($"api/timeline-data/periods/{exhibitionId}/{id}");
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    #endregion

    #region Streams (泳道流派)

    public Task<List<StreamDto>?> GetStreamsAsync(Guid exhibitionId) =>
        GetAsync<List<StreamDto>>($"api/timeline-data/exhibitions/{exhibitionId}/streams");

    public async Task<(bool Ok, string? Error)> SaveStreamAsync(StreamDto model, bool isNew)
    {
        var resp = isNew
            ? await Client.PostAsJsonAsync("api/timeline-data/streams", model)
            : await Client.PutAsJsonAsync($"api/timeline-data/streams/{model.Id}", model);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(bool Ok, string? Error)> DeleteStreamAsync(Guid exhibitionId, string id)
    {
        var resp = await Client.DeleteAsync($"api/timeline-data/streams/{exhibitionId}/{id}");
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    #endregion

    #region Events (事件作品)

    public async Task<TimelineEventPageResult?> GetEventsAsync(Guid exhibitionId, int page = 1, int pageSize = 50, string? keyword = null, int? importance = null)
    {
        var url = $"api/timeline-data/exhibitions/{exhibitionId}/events?page={page}&pageSize={pageSize}";
        if (!string.IsNullOrWhiteSpace(keyword)) url += $"&keyword={Uri.EscapeDataString(keyword)}";
        if (importance.HasValue) url += $"&importance={importance.Value}";
        return await GetAsync<TimelineEventPageResult>(url);
    }

    public async Task<(bool Ok, string? Error)> SaveEventAsync(TimelineEventDto model, bool isNew)
    {
        var resp = isNew
            ? await Client.PostAsJsonAsync("api/timeline-data/events", model)
            : await Client.PutAsJsonAsync($"api/timeline-data/events/{model.Id}", model);
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    public async Task<(bool Ok, string? Error)> DeleteEventAsync(Guid exhibitionId, string id)
    {
        var resp = await Client.DeleteAsync($"api/timeline-data/events/{exhibitionId}/{id}");
        return resp.IsSuccessStatusCode ? (true, null) : (false, await ReadError(resp));
    }

    #endregion

    #region Legacy Import

    public async Task<(bool Ok, string? Error, string? Message)> ImportLegacyJsonAsync()
    {
        var resp = await Client.PostAsync("api/exhibitions/import-legacy", null);
        if (resp.IsSuccessStatusCode)
        {
            return (true, null, "一键无损导入全量历史展览数据成功！");
        }
        return (false, await ReadError(resp), null);
    }

    #endregion
}
