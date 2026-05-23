using System.Collections;
using System.Reflection;

namespace Timeline.Api.Infrastructure;

public static class StringValueNormalizer
{
    public static string? NormalizeString(string? value)
    {
        if (value is null) return null;
        var trimmed = value.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    public static void NormalizeInPlace(object? root)
    {
        if (root is null) return;
        var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);
        NormalizeCore(root, visited);
    }

    private static void NormalizeCore(object? obj, HashSet<object> visited)
    {
        if (obj is null) return;
        var t = obj.GetType();
        if (t == typeof(string)) return;
        if (ShouldSkipType(t)) return;
        if (!t.IsValueType && !visited.Add(obj)) return;

        if (obj is IDictionary dict) { NormalizeDictionary(dict, visited); return; }
        if (obj is IEnumerable enumerable && obj is not string) { NormalizeEnumerable(enumerable, visited); return; }
        if (t.IsPrimitive || t.IsEnum) return;
        if (obj is Uri or DateTime or DateTimeOffset or TimeSpan or Guid) return;

        foreach (var prop in t.GetProperties(BindingFlags.Instance | BindingFlags.Public))
        {
            if (!prop.CanRead || prop.GetIndexParameters().Length > 0) continue;
            object? val;
            try { val = prop.GetValue(obj); } catch { continue; }

            if (val is string s) { TrySetProperty(prop, obj, NormalizeString(s)); continue; }
            if (val is null) continue;
            var vt = val.GetType();
            if (ShouldSkipType(vt) || vt.IsPrimitive || vt.IsEnum || val is Uri or DateTime or DateTimeOffset or TimeSpan or Guid) continue;
            if (val is IDictionary d) { NormalizeDictionary(d, visited); continue; }
            if (val is IEnumerable en and not string) { NormalizeEnumerable(en, visited); continue; }
            NormalizeCore(val, visited);
        }
    }

    private static void NormalizeEnumerable(IEnumerable enumerable, HashSet<object> visited)
    {
        if (enumerable is Array arr && arr.GetType().GetElementType() == typeof(string))
        {
            for (var i = 0; i < arr.Length; i++)
                arr.SetValue(NormalizeString((string?)arr.GetValue(i)), i);
            return;
        }

        if (enumerable is ICollection<string> strCol && enumerable is not Array)
        {
            var snapshot = strCol.ToArray();
            strCol.Clear();
            foreach (var s in snapshot)
            {
                var n = NormalizeString(s);
                if (n is not null) strCol.Add(n);
            }
            return;
        }

        if (enumerable is IList list)
        {
            var gt = list.GetType();
            if (gt.IsGenericType && gt.GetGenericArguments()[0] == typeof(string))
            {
                for (var i = 0; i < list.Count; i++)
                    list[i] = NormalizeString((string?)list[i]);
                return;
            }
            if (!visited.Add(list)) return;
            for (var i = 0; i < list.Count; i++) NormalizeCore(list[i], visited);
            return;
        }

        foreach (var item in enumerable) NormalizeCore(item, visited);
    }

    private static void NormalizeDictionary(IDictionary dict, HashSet<object> visited)
    {
        if (!visited.Add(dict)) return;
        foreach (DictionaryEntry entry in dict)
        {
            if (entry.Value is string vs) dict[entry.Key] = NormalizeString(vs);
            else if (entry.Value is not null) NormalizeCore(entry.Value, visited);
        }
    }

    private static bool ShouldSkipType(Type t) =>
        t == typeof(CancellationToken) ||
        typeof(Stream).IsAssignableFrom(t) ||
        t == typeof(byte[]) || t == typeof(char[]) ||
        t.FullName?.StartsWith("Microsoft.AspNetCore.", StringComparison.Ordinal) == true ||
        t.FullName?.StartsWith("Microsoft.EntityFrameworkCore.", StringComparison.Ordinal) == true;

    private static void TrySetProperty(PropertyInfo prop, object target, string? newValue)
    {
        if (!prop.CanWrite)
        {
            prop.GetSetMethod(nonPublic: true)?.Invoke(target, [newValue]);
            return;
        }
        try { prop.SetValue(target, newValue); } catch { }
    }
}
