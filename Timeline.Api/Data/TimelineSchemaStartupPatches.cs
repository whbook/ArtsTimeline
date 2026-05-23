using Microsoft.EntityFrameworkCore;
using Timeline.Api.Data;

namespace Timeline.Api.Data;

public static class TimelineSchemaStartupPatches
{
    public static async Task ApplyAllAsync(TimelineDbContext db, IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        await ApplyInitScriptAsync(db, logger, ct);
        await ApplyMigrationFilesAsync(db, logger, ct);

        try
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE timeline.exhibitions ADD COLUMN IF NOT EXISTS initial_zoom NUMERIC(10,4) NOT NULL DEFAULT 6.0;", ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "自动添加 exhibitions.initial_zoom 字段失败（可能已存在）");
        }

        var exhibitionSeeder = services.GetRequiredService<Services.ExhibitionAutoSeeder>();
        await exhibitionSeeder.SeedAsync(forceOverwrite: false, ct: ct);

        var adminSeeder = services.GetRequiredService<Services.BootstrapAdminSeeder>();
        await adminSeeder.SeedAsync(ct);
    }

    private static async Task ApplyInitScriptAsync(TimelineDbContext db, ILogger logger, CancellationToken ct)
    {
        const string patchId = "init";
        if (await PatchAppliedAsync(db, patchId, ct)) return;

        var path = Path.Combine(AppContext.BaseDirectory, "sql-patches", "init.sql");
        if (!File.Exists(path))
        {
            logger.LogWarning("init.sql 未找到: {Path}", path);
            return;
        }

        var sql = await File.ReadAllTextAsync(path, ct);
        await ExecuteSqlAsync(db, sql, ct);
        db.SchemaPatches.Add(new Models.SchemaPatch { PatchId = patchId, AppliedAt = DateTime.UtcNow });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("已应用 init.sql");
    }

    private static async Task ApplyMigrationFilesAsync(TimelineDbContext db, ILogger logger, CancellationToken ct)
    {
        var dir = Path.Combine(AppContext.BaseDirectory, "sql-patches", "migrations");
        if (!Directory.Exists(dir)) return;

        foreach (var file in Directory.GetFiles(dir, "*.sql").OrderBy(f => f))
        {
            var patchId = Path.GetFileNameWithoutExtension(file);
            if (await PatchAppliedAsync(db, patchId, ct)) continue;

            var sql = await File.ReadAllTextAsync(file, ct);
            await ExecuteSqlAsync(db, sql, ct);
            db.SchemaPatches.Add(new Models.SchemaPatch { PatchId = patchId, AppliedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
            logger.LogInformation("已应用迁移 {PatchId}", patchId);
        }
    }

    private static async Task ExecuteSqlAsync(TimelineDbContext db, string sql, CancellationToken ct)
    {
        await db.Database.OpenConnectionAsync(ct);
        try
        {
            var conn = db.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.CommandTimeout = 120;
            await cmd.ExecuteNonQueryAsync(ct);
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static async Task<bool> PatchAppliedAsync(TimelineDbContext db, string patchId, CancellationToken ct)
    {
        try
        {
            return await db.SchemaPatches.AnyAsync(p => p.PatchId == patchId, ct);
        }
        catch
        {
            return false;
        }
    }
}
