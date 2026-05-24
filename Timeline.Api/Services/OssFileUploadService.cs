using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Timeline.Api.Models;

namespace Timeline.Api.Services;

public class OssFileUploadService
{
    private readonly OssSettings _settings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OssFileUploadService> _logger;

    public OssFileUploadService(
        IOptions<OssSettings> options,
        IHttpClientFactory httpClientFactory,
        ILogger<OssFileUploadService> logger)
    {
        _settings = options.Value;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    /// <summary>
    /// 上传展览文件。
    /// 路径：TimeLine/{exhibitionId}/{guid}_{fileName}
    /// </summary>
    public async Task<string> UploadExhibitionFileAsync(
        Guid exhibitionId,
        Stream fileStream,
        string fileName,
        string contentType,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.AccessKeyId) || string.IsNullOrWhiteSpace(_settings.AccessKeySecret))
        {
            throw new InvalidOperationException("OSS 凭据配置不完整，请配置 User Secrets！");
        }

        // 整理文件名，只保留安全字符
        var safeFileName = MakeSafeFileName(fileName);
        var fileGuid = Guid.NewGuid().ToString("N");
        var ossKey = $"TimeLine/{exhibitionId}/{fileGuid}_{safeFileName}";

        // 将流读取为 byte[]，因为计算 MD5 签名和发送 PUT 都会用到它
        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms, ct);
        var fileData = ms.ToArray();

        return await PutObjectAsync(ossKey, fileData, contentType, ct);
    }

    /// <summary>
    /// 根据文件完整 URL 删除 OSS 对象。
    /// </summary>
    public async Task DeleteFileAsync(string fileUrl, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(fileUrl)) return;

        var ossKey = ExtractKeyFromUrl(fileUrl);
        if (string.IsNullOrWhiteSpace(ossKey))
        {
            _logger.LogWarning("无法从 URL 解析 OSS key: {Url}", fileUrl);
            return;
        }

        await DeleteObjectAsync(ossKey, ct);
    }

    private async Task<string> PutObjectAsync(
        string ossKey,
        byte[] data,
        string contentType,
        CancellationToken ct)
    {
        var providerNorm = _settings.Provider.Trim().ToLowerInvariant();
        if (providerNorm.Contains("aliyun") || providerNorm.Contains("oss"))
        {
            return await PutObjectAliyunAsync(ossKey, data, contentType, ct);
        }

        throw new NotSupportedException($"不支持的云存储服务商: {_settings.Provider}");
    }

    private async Task<string> PutObjectAliyunAsync(
        string ossKey,
        byte[] data,
        string contentType,
        CancellationToken ct)
    {
        var date = DateTime.UtcNow.ToString("R");
        var md5 = Convert.ToBase64String(MD5.HashData(data));
        var resource = $"/{_settings.Bucket}/{ossKey}";
        var stringToSign = $"PUT\n{md5}\n{contentType}\n{date}\n{resource}";
        var signature = ComputeHmacSha1(_settings.AccessKeySecret, stringToSign);
        var authorization = $"OSS {_settings.AccessKeyId}:{signature}";

        var baseUrl = BuildAliyunObjectUrl(_settings.Endpoint, _settings.Bucket, ossKey);
        _logger.LogDebug("正在上传文件至阿里云 OSS: {Url}", baseUrl);

        var client = _httpClientFactory.CreateClient("oss-upload");
        client.Timeout = TimeSpan.FromMinutes(10);

        using var request = new HttpRequestMessage(HttpMethod.Put, baseUrl);
        request.Content = new ByteArrayContent(data);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        request.Content.Headers.ContentMD5 = Convert.FromBase64String(md5);
        request.Headers.TryAddWithoutValidation("Date", date);
        request.Headers.TryAddWithoutValidation("Authorization", authorization);

        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new InvalidOperationException($"阿里云 OSS 上传失败（{(int)response.StatusCode}）：{body}");
        }

        return baseUrl;
    }

    private async Task DeleteObjectAsync(string ossKey, CancellationToken ct)
    {
        var providerNorm = _settings.Provider.Trim().ToLowerInvariant();
        if (providerNorm.Contains("aliyun") || providerNorm.Contains("oss"))
        {
            var date = DateTime.UtcNow.ToString("R");
            var resource = $"/{_settings.Bucket}/{ossKey}";
            var stringToSign = $"DELETE\n\n\n{date}\n{resource}";
            var signature = ComputeHmacSha1(_settings.AccessKeySecret, stringToSign);
            var authorization = $"OSS {_settings.AccessKeyId}:{signature}";
            var url = BuildAliyunObjectUrl(_settings.Endpoint, _settings.Bucket, ossKey);

            var client = _httpClientFactory.CreateClient("oss-upload");
            client.Timeout = TimeSpan.FromSeconds(30);

            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.TryAddWithoutValidation("Date", date);
            request.Headers.TryAddWithoutValidation("Authorization", authorization);

            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode 
                && response.StatusCode != System.Net.HttpStatusCode.NoContent
                && response.StatusCode != System.Net.HttpStatusCode.NotFound)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("删除 OSS 对象失败，状态码 {Status}: {Body}", (int)response.StatusCode, body);
            }
        }
    }

    private string ExtractKeyFromUrl(string url)
    {
        try
        {
            var uri = new Uri(url);
            var path = Uri.UnescapeDataString(uri.AbsolutePath);
            if (path.StartsWith('/'))
            {
                path = path.TrimStart('/');
            }
            if (path.StartsWith(_settings.Bucket + "/", StringComparison.OrdinalIgnoreCase))
            {
                path = path[(_settings.Bucket.Length + 1)..];
            }
            return path;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "提取 OSS key 时发生错误");
            return string.Empty;
        }
    }

    private static string BuildAliyunObjectUrl(string endpoint, string bucket, string key)
    {
        var ep = NormalizeEndpoint(endpoint);
        var uri = new Uri(ep);
        return $"{uri.Scheme}://{bucket}.{uri.Host}/{key}";
    }

    private static string NormalizeEndpoint(string endpoint)
    {
        var ep = endpoint.Trim().TrimEnd('/');
        if (!ep.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !ep.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            ep = "https://" + ep;
        return ep;
    }

    private static string ComputeHmacSha1(string key, string data)
    {
        using var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(key));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));
    }

    private static string MakeSafeFileName(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName);
        var ext = Path.GetExtension(fileName);

        name = System.Text.RegularExpressions.Regex.Replace(name, @"[^\w\-.]", "-");
        name = System.Text.RegularExpressions.Regex.Replace(name, @"-{2,}", "-").Trim('-');
        if (string.IsNullOrEmpty(name)) name = "file";

        return name + ext.ToLowerInvariant();
    }
}
