-- 001_timeline_data_model.sql
-- 创建分期、泳道和具体作品事件的数据表

SET search_path TO timeline;

-- 1. 时代分期表
CREATE TABLE IF NOT EXISTS periods (
    id                  VARCHAR(100) NOT NULL,
    exhibition_id       UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
    name_cn             VARCHAR(200) NOT NULL,
    name_en             VARCHAR(200) NOT NULL,
    color_hex           VARCHAR(32) NOT NULL,
    color_background    VARCHAR(32) NOT NULL,
    description         TEXT,
    
    -- 模糊日期：Start
    start_year          INTEGER NOT NULL,
    start_month         SMALLINT,
    start_day           SMALLINT,
    start_accuracy      VARCHAR(32) NOT NULL DEFAULT 'exact',
    start_or_year       INTEGER,
    start_or_month      SMALLINT,
    start_or_day        SMALLINT,
    
    -- 模糊日期：End
    end_year            INTEGER NOT NULL,
    end_month           SMALLINT,
    end_day             SMALLINT,
    end_accuracy        VARCHAR(32) NOT NULL DEFAULT 'exact',
    end_or_year         INTEGER,
    end_or_month        SMALLINT,
    end_or_day          SMALLINT,
    
    PRIMARY KEY (exhibition_id, id)
);

CREATE INDEX IF NOT EXISTS idx_periods_exhibition_id ON periods(exhibition_id);

-- 2. 流派泳道表
CREATE TABLE IF NOT EXISTS streams (
    id                  VARCHAR(100) NOT NULL,
    exhibition_id       UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
    period_id           VARCHAR(100),
    name_cn             VARCHAR(200) NOT NULL,
    name_en             VARCHAR(200) NOT NULL,
    color               VARCHAR(32) NOT NULL,
    lane                INTEGER NOT NULL DEFAULT 0,
    description_cn      TEXT,
    description_en      TEXT,
    
    -- 模糊日期：Start
    start_year          INTEGER NOT NULL,
    start_month         SMALLINT,
    start_day           SMALLINT,
    start_accuracy      VARCHAR(32) NOT NULL DEFAULT 'exact',
    start_or_year       INTEGER,
    start_or_month      SMALLINT,
    start_or_day        SMALLINT,
    
    -- 模糊日期：End
    end_year            INTEGER NOT NULL,
    end_month           SMALLINT,
    end_day             SMALLINT,
    end_accuracy        VARCHAR(32) NOT NULL DEFAULT 'exact',
    end_or_year         INTEGER,
    end_or_month        SMALLINT,
    end_or_day          SMALLINT,
    
    PRIMARY KEY (exhibition_id, id),
    FOREIGN KEY (exhibition_id, period_id) REFERENCES periods(exhibition_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_streams_exhibition_id ON streams(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_streams_period_id ON streams(exhibition_id, period_id);

-- 3. 作品事件表
CREATE TABLE IF NOT EXISTS timeline_events (
    id                  VARCHAR(100) NOT NULL,
    exhibition_id       UUID NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
    period_id           VARCHAR(100),
    stream_id           VARCHAR(100),
    title_cn            VARCHAR(300) NOT NULL,
    title_en            VARCHAR(300) NOT NULL,
    creator_cn          VARCHAR(200),
    creator_en          VARCHAR(200),
    location            VARCHAR(300),
    image_url           VARCHAR(500),
    detail_page_url     VARCHAR(500),
    high_res_image_url  VARCHAR(500),
    description_cn      TEXT,
    description_en      TEXT,
    importance          INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
    tags                TEXT[] NOT NULL DEFAULT '{}',
    meta                JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 模糊日期：Date
    date_year           INTEGER NOT NULL,
    date_month          SMALLINT,
    date_day            SMALLINT,
    date_accuracy       VARCHAR(32) NOT NULL DEFAULT 'exact',
    date_or_year        INTEGER,
    date_or_month       SMALLINT,
    date_or_day         SMALLINT,
    
    -- 模糊日期：EndDate
    end_date_year       INTEGER,
    end_date_month      SMALLINT,
    end_date_day        SMALLINT,
    end_date_accuracy   VARCHAR(32),
    end_date_or_year    INTEGER,
    end_date_or_month   SMALLINT,
    end_date_or_day     SMALLINT,
    
    PRIMARY KEY (exhibition_id, id),
    FOREIGN KEY (exhibition_id, period_id) REFERENCES periods(exhibition_id, id) ON DELETE SET NULL,
    FOREIGN KEY (exhibition_id, stream_id) REFERENCES streams(exhibition_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_exhibition_id ON timeline_events(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_period_id ON timeline_events(exhibition_id, period_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_stream_id ON timeline_events(exhibition_id, stream_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_viewport ON timeline_events(exhibition_id, date_year, importance);
