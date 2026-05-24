using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Timeline.Api.Services;

namespace Timeline.Api.Controllers;

[Authorize(Policy = "AdminOnly")]
[Route("api/oss")]
public class OssUploadController : ApiControllerBase
{
    private readonly OssFileUploadService _ossService;
    private readonly ILogger<OssUploadController> _logger;

    public OssUploadController(OssFileUploadService ossService, ILogger<OssUploadController> logger)
    {
        _ossService = ossService;
        _logger = logger;
    }

    [HttpPost("upload")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Upload(
        [FromForm] Guid exhibitionId,
        IFormFile file,
        CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        if (exhibitionId == Guid.Empty)
        {
            return BadRequest("未指定有效的展览 ID (ExhibitionId)");
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest("未上传文件或文件内容为空");
        }

        try
        {
            using var stream = file.OpenReadStream();
            var fileUrl = await _ossService.UploadExhibitionFileAsync(
                exhibitionId,
                stream,
                file.FileName,
                file.ContentType,
                ct);

            return Ok(new { fileUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "上传文件至 OSS 失败");
            return StatusCode(500, $"上传失败: {ex.Message}");
        }
    }

    [HttpDelete("delete")]
    public async Task<IActionResult> Delete([FromQuery] string fileUrl, CancellationToken ct)
    {
        if (!CanWrite()) return Forbid();

        if (string.IsNullOrWhiteSpace(fileUrl))
        {
            return BadRequest("未指定要删除的文件 URL (fileUrl)");
        }

        try
        {
            await _ossService.DeleteFileAsync(fileUrl, ct);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "从 OSS 删除文件失败: {Url}", fileUrl);
            return StatusCode(500, $"删除失败: {ex.Message}");
        }
    }
}
