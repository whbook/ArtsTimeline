using Timeline.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Timeline.Api.Data;

public sealed class StringNormalizationSaveChangesInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Normalize(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Normalize(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void Normalize(DbContext? context)
    {
        if (context is null) return;
        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified)) continue;
            foreach (var prop in entry.Properties)
            {
                if (prop.Metadata.IsPrimaryKey()) continue;
                if (prop.CurrentValue is string s)
                {
                    prop.CurrentValue = StringValueNormalizer.NormalizeString(s)
                        ?? (prop.Metadata.IsNullable ? null : string.Empty);
                    continue;
                }
                if (prop.CurrentValue is null) continue;
                var t = prop.CurrentValue.GetType();
                if (t.IsPrimitive || t.IsEnum || prop.CurrentValue is DateTime or Guid) continue;
                StringValueNormalizer.NormalizeInPlace(prop.CurrentValue);
                try { prop.IsModified = true; } catch { }
            }
        }
    }
}
