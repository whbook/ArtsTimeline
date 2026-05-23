using System.Net;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Models;
using Stream = Timeline.Api.Models.Stream;

namespace Timeline.Api.Data;

public class TimelineDbContext : DbContext
{
    public TimelineDbContext(DbContextOptions<TimelineDbContext> options) : base(options) { }

    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<Exhibition> Exhibitions => Set<Exhibition>();
    public DbSet<GlobalSettings> GlobalSettings => Set<GlobalSettings>();
    public DbSet<DeviceExhibition> DeviceExhibitions => Set<DeviceExhibition>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<DeviceAccessLog> DeviceAccessLogs => Set<DeviceAccessLog>();
    public DbSet<SchemaPatch> SchemaPatches => Set<SchemaPatch>();
    public DbSet<Period> Periods => Set<Period>();
    public DbSet<Stream> Streams => Set<Stream>();
    public DbSet<TimelineEvent> TimelineEvents => Set<TimelineEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("timeline");

        modelBuilder.Entity<AdminUser>(e =>
        {
            e.ToTable("admin_users");
            e.HasIndex(x => x.Username).IsUnique();
        });

        modelBuilder.Entity<Organization>(e =>
        {
            e.ToTable("organizations");
            e.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<Device>(e =>
        {
            e.ToTable("devices");
            e.HasIndex(x => x.DeviceCode).IsUnique();
            e.HasOne(x => x.Organization).WithMany(x => x.Devices).HasForeignKey(x => x.OrganizationId);
            e.Property(x => x.IpAddresses)
                .HasColumnType("inet[]")
                .HasConversion(
                    v => v.Select(IPAddress.Parse).ToArray(),
                    v => v.Select(x => x.ToString()).ToList())
                .Metadata.SetValueComparer(new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                    (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
                    v => v == null ? 0 : v.Aggregate(0, (h, x) => HashCode.Combine(h, x.GetHashCode())),
                    v => v == null ? new List<string>() : v.ToList()));
        });

        modelBuilder.Entity<Exhibition>(e =>
        {
            e.ToTable("exhibitions");
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.EventFieldsJson).HasColumnName("event_fields").HasColumnType("jsonb");
        });

        modelBuilder.Entity<GlobalSettings>(e =>
        {
            e.ToTable("global_settings");
            e.Property(x => x.ImportanceThresholdsJson).HasColumnName("importance_thresholds").HasColumnType("jsonb");
        });

        modelBuilder.Entity<DeviceExhibition>(e =>
        {
            e.ToTable("device_exhibitions");
            e.HasIndex(x => new { x.DeviceId, x.ExhibitionId }).IsUnique();
            e.HasOne(x => x.Device).WithMany(x => x.DeviceExhibitions).HasForeignKey(x => x.DeviceId);
            e.HasOne(x => x.Exhibition).WithMany(x => x.DeviceExhibitions).HasForeignKey(x => x.ExhibitionId);
            e.Property(x => x.OverridesJson).HasColumnName("overrides").HasColumnType("jsonb");
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.Property(x => x.DetailJson).HasColumnName("detail").HasColumnType("jsonb");
        });

        modelBuilder.Entity<DeviceAccessLog>(e =>
        {
            e.ToTable("device_access_logs");
            e.Property(x => x.PayloadJson).HasColumnName("payload").HasColumnType("jsonb");
        });

        modelBuilder.Entity<SchemaPatch>(e =>
        {
            e.ToTable("schema_patches");
            e.HasKey(x => x.PatchId);
        });

        modelBuilder.Entity<Period>(e =>
        {
            e.ToTable("periods");
            e.HasKey(x => new { x.ExhibitionId, x.Id });
            e.HasOne(x => x.Exhibition).WithMany().HasForeignKey(x => x.ExhibitionId).OnDelete(DeleteBehavior.Cascade);

            e.OwnsOne(x => x.Start, sa =>
            {
                sa.Property(p => p.Year).HasColumnName("start_year");
                sa.Property(p => p.Month).HasColumnName("start_month");
                sa.Property(p => p.Day).HasColumnName("start_day");
                sa.Property(p => p.Accuracy).HasColumnName("start_accuracy");
                sa.Property(p => p.OrYear).HasColumnName("start_or_year");
                sa.Property(p => p.OrMonth).HasColumnName("start_or_month");
                sa.Property(p => p.OrDay).HasColumnName("start_or_day");
            });

            e.OwnsOne(x => x.End, ea =>
            {
                ea.Property(p => p.Year).HasColumnName("end_year");
                ea.Property(p => p.Month).HasColumnName("end_month");
                ea.Property(p => p.Day).HasColumnName("end_day");
                ea.Property(p => p.Accuracy).HasColumnName("end_accuracy");
                ea.Property(p => p.OrYear).HasColumnName("end_or_year");
                ea.Property(p => p.OrMonth).HasColumnName("end_or_month");
                ea.Property(p => p.OrDay).HasColumnName("end_or_day");
            });
        });

        modelBuilder.Entity<Stream>(e =>
        {
            e.ToTable("streams");
            e.HasKey(x => new { x.ExhibitionId, x.Id });
            e.HasOne(x => x.Exhibition).WithMany().HasForeignKey(x => x.ExhibitionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Period).WithMany(p => p.Streams)
                .HasForeignKey(x => new { x.ExhibitionId, x.PeriodId })
                .OnDelete(DeleteBehavior.SetNull);

            e.OwnsOne(x => x.Start, sa =>
            {
                sa.Property(p => p.Year).HasColumnName("start_year");
                sa.Property(p => p.Month).HasColumnName("start_month");
                sa.Property(p => p.Day).HasColumnName("start_day");
                sa.Property(p => p.Accuracy).HasColumnName("start_accuracy");
                sa.Property(p => p.OrYear).HasColumnName("start_or_year");
                sa.Property(p => p.OrMonth).HasColumnName("start_or_month");
                sa.Property(p => p.OrDay).HasColumnName("start_or_day");
            });

            e.OwnsOne(x => x.End, ea =>
            {
                ea.Property(p => p.Year).HasColumnName("end_year");
                ea.Property(p => p.Month).HasColumnName("end_month");
                ea.Property(p => p.Day).HasColumnName("end_day");
                ea.Property(p => p.Accuracy).HasColumnName("end_accuracy");
                ea.Property(p => p.OrYear).HasColumnName("end_or_year");
                ea.Property(p => p.OrMonth).HasColumnName("end_or_month");
                ea.Property(p => p.OrDay).HasColumnName("end_or_day");
            });
        });

        modelBuilder.Entity<TimelineEvent>(e =>
        {
            e.ToTable("timeline_events");
            e.HasKey(x => new { x.ExhibitionId, x.Id });
            e.HasOne(x => x.Exhibition).WithMany().HasForeignKey(x => x.ExhibitionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Period).WithMany(p => p.Events)
                .HasForeignKey(x => new { x.ExhibitionId, x.PeriodId })
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(x => x.Stream).WithMany(s => s.Events)
                .HasForeignKey(x => new { x.ExhibitionId, x.StreamId })
                .OnDelete(DeleteBehavior.SetNull);

            e.Property(x => x.MetaJson).HasColumnName("meta").HasColumnType("jsonb");

            e.Property(x => x.Tags)
                .HasColumnType("text[]")
                .HasConversion(
                    v => v.ToArray(),
                    v => v.ToList())
                .Metadata.SetValueComparer(new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<List<string>>(
                    (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
                    v => v == null ? 0 : v.Aggregate(0, (h, x) => HashCode.Combine(h, x.GetHashCode())),
                    v => v == null ? new List<string>() : v.ToList()));

            e.OwnsOne(x => x.Date, da =>
            {
                da.Property(p => p.Year).HasColumnName("date_year");
                da.Property(p => p.Month).HasColumnName("date_month");
                da.Property(p => p.Day).HasColumnName("date_day");
                da.Property(p => p.Accuracy).HasColumnName("date_accuracy");
                da.Property(p => p.OrYear).HasColumnName("date_or_year");
                da.Property(p => p.OrMonth).HasColumnName("date_or_month");
                da.Property(p => p.OrDay).HasColumnName("date_or_day");
            });

            e.OwnsOne(x => x.EndDate, ed =>
            {
                ed.Property(p => p.Year).HasColumnName("end_date_year");
                ed.Property(p => p.Month).HasColumnName("end_date_month");
                ed.Property(p => p.Day).HasColumnName("end_date_day");
                ed.Property(p => p.Accuracy).HasColumnName("end_date_accuracy");
                ed.Property(p => p.OrYear).HasColumnName("end_date_or_year");
                ed.Property(p => p.OrMonth).HasColumnName("end_date_or_month");
                ed.Property(p => p.OrDay).HasColumnName("end_date_or_day");
            });

            e.HasIndex(x => new { x.ExhibitionId, x.Importance }).HasDatabaseName("idx_timeline_events_viewport");
        });
    }
}
