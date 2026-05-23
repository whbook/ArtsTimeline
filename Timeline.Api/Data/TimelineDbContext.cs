using System.Net;
using Microsoft.EntityFrameworkCore;
using Timeline.Api.Models;

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
    }
}
