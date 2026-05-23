-- Timeline 管理系统初始化脚本
-- 首次建库后执行；Api 启动补丁会再次幂等应用

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS timeline;
SET search_path TO timeline;

-- 管理用户
CREATE TABLE IF NOT EXISTS admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) NOT NULL UNIQUE,
    email         VARCHAR(200) NOT NULL DEFAULT '',
    password_hash VARCHAR(200) NOT NULL,
    role          VARCHAR(32)  NOT NULL DEFAULT 'admin',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 客户单位
CREATE TABLE IF NOT EXISTS organizations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(64)  NOT NULL UNIQUE,
    name           VARCHAR(200) NOT NULL,
    phone          VARCHAR(50),
    contact_name   VARCHAR(100),
    contact_phone  VARCHAR(50),
    contact_email  VARCHAR(200),
    introduction   TEXT,
    website_url    VARCHAR(500),
    province       VARCHAR(50),
    city           VARCHAR(50),
    district       VARCHAR(50),
    address        VARCHAR(500),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);

-- 设备
CREATE TABLE IF NOT EXISTS devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    device_code     VARCHAR(64)  NOT NULL UNIQUE,
    screen_width    INTEGER      NOT NULL DEFAULT 1920,
    screen_height   INTEGER      NOT NULL DEFAULT 1080,
    os_version      VARCHAR(100),
    license_type    VARCHAR(16)  NOT NULL DEFAULT 'trial',
    valid_from      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until     TIMESTAMPTZ  NOT NULL,
    ip_addresses    INET[]       NOT NULL DEFAULT '{}',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_organization_id ON devices(organization_id);
CREATE INDEX IF NOT EXISTS idx_devices_valid_until ON devices(valid_until);
CREATE INDEX IF NOT EXISTS idx_devices_license_type ON devices(license_type);

-- 展览
CREATE TABLE IF NOT EXISTS exhibitions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                        VARCHAR(64)  NOT NULL UNIQUE,
    title_cn                    VARCHAR(200) NOT NULL,
    title_en                    VARCHAR(200) NOT NULL,
    description                 TEXT,
    color                       VARCHAR(16)  NOT NULL DEFAULT '#2563eb',
    sort_order                  INTEGER      NOT NULL DEFAULT 0,
    is_published                BOOLEAN      NOT NULL DEFAULT TRUE,
    default_viewport_start_year INTEGER      NOT NULL DEFAULT -4000,
    default_viewport_end_year   INTEGER      NOT NULL DEFAULT 2050,
    min_zoom_range              NUMERIC(18,6) NOT NULL DEFAULT 1,
    max_zoom_range              NUMERIC(18,6) NOT NULL DEFAULT 10000,
    playback_speed              NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    chunked                     BOOLEAN      NOT NULL DEFAULT FALSE,
    event_fields                JSONB        NOT NULL DEFAULT '[]'::jsonb,
    content_version             INTEGER      NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exhibitions_sort_order ON exhibitions(sort_order);
CREATE INDEX IF NOT EXISTS idx_exhibitions_is_published ON exhibitions(is_published);

-- 全局设置（单行）
CREATE TABLE IF NOT EXISTS global_settings (
    id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    autoplay_idle_timeout_ms INTEGER      NOT NULL DEFAULT 10000,
    autoplay_mode            VARCHAR(16)  NOT NULL DEFAULT 'sequential',
    autoplay_base_speed      NUMERIC(10,4) NOT NULL DEFAULT 10,
    autoplay_fast_speed      NUMERIC(10,4) NOT NULL DEFAULT 500,
    min_zoom_range_global    NUMERIC(18,6) NOT NULL DEFAULT 0.003,
    max_zoom_range_global    NUMERIC(18,6) NOT NULL DEFAULT 50000,
    base_screen_width        INTEGER      NOT NULL DEFAULT 1920,
    base_screen_height       INTEGER      NOT NULL DEFAULT 1080,
    base_column_width        INTEGER      NOT NULL DEFAULT 320,
    importance_thresholds    JSONB        NOT NULL DEFAULT '{"1":null,"2":5000,"3":1500,"4":400,"5":100}'::jsonb,
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO global_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 设备-展览授权
CREATE TABLE IF NOT EXISTS device_exhibitions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    exhibition_id UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    overrides     JSONB,
    UNIQUE (device_id, exhibition_id)
);

CREATE INDEX IF NOT EXISTS idx_device_exhibitions_device_id ON device_exhibitions(device_id);

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id   UUID,
    admin_username  VARCHAR(100),
    action          VARCHAR(32)  NOT NULL,
    entity_type     VARCHAR(64)  NOT NULL,
    entity_id       UUID,
    entity_label    VARCHAR(200),
    summary         VARCHAR(500) NOT NULL DEFAULT '',
    detail          JSONB,
    ip_address      VARCHAR(50),
    user_agent      VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);

-- 设备访问日志（预留）
CREATE TABLE IF NOT EXISTS device_access_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    accessed_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_ip       VARCHAR(50),
    event_type      VARCHAR(32) NOT NULL,
    payload         JSONB
);

CREATE INDEX IF NOT EXISTS idx_device_access_logs_accessed_at ON device_access_logs(accessed_at DESC);

-- 补丁版本追踪
CREATE TABLE IF NOT EXISTS schema_patches (
    patch_id    VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
