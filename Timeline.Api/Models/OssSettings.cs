namespace Timeline.Api.Models;

public class OssSettings
{
    public string Provider { get; set; } = "aliyun";
    public string Endpoint { get; set; } = string.Empty;
    public string Bucket { get; set; } = string.Empty;
    public string AccessKeyId { get; set; } = string.Empty;
    public string AccessKeySecret { get; set; } = string.Empty;
    public string? Region { get; set; }
}
