-- 002_swimlane_and_uuid_migration.sql
-- 迁移时代分期、流派泳道和作品事件的主外键为 UUID 并且进行无损生成，同时将流派泳道重命名为泳道

SET search_path TO timeline;

-- 1. 自动清空所有旧的关联外键约束（periods、streams、timeline_events）
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name AS conname, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'timeline' 
          AND tc.table_name IN ('periods', 'streams', 'swimlanes', 'timeline_events')
    ) LOOP
        EXECUTE 'ALTER TABLE timeline.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. 重命名 streams 表为 swimlanes 表
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'timeline' AND table_name = 'streams') THEN
        ALTER TABLE timeline.streams RENAME TO swimlanes;
    END IF;
END $$;

-- 3. 重命名 timeline_events 中的 stream_id 字段为 swimlane_id
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'timeline' AND table_name = 'timeline_events' AND column_name = 'stream_id') THEN
        ALTER TABLE timeline.timeline_events RENAME COLUMN stream_id TO swimlane_id;
    END IF;
END $$;

-- 4. 为三张表添加临时 UUID 字段，用来装载基于确定性 md5 的 UUID 数据
ALTER TABLE timeline.periods ADD COLUMN IF NOT EXISTS id_uuid UUID;

ALTER TABLE timeline.swimlanes ADD COLUMN IF NOT EXISTS id_uuid UUID;
ALTER TABLE timeline.swimlanes ADD COLUMN IF NOT EXISTS period_id_uuid UUID;

ALTER TABLE timeline.timeline_events ADD COLUMN IF NOT EXISTS id_uuid UUID;
ALTER TABLE timeline.timeline_events ADD COLUMN IF NOT EXISTS period_id_uuid UUID;
ALTER TABLE timeline.timeline_events ADD COLUMN IF NOT EXISTS swimlane_id_uuid UUID;

-- 5. 使用确定性 MD5 填充新 UUID 字段
-- 确定性公式: md5(exhibition_id || '_' || old_id) -> uuid
UPDATE timeline.periods 
SET id_uuid = CAST(md5(exhibition_id::text || '_' || id) AS uuid)
WHERE id_uuid IS NULL;

UPDATE timeline.swimlanes 
SET id_uuid = CAST(md5(exhibition_id::text || '_' || id) AS uuid),
    period_id_uuid = CASE 
        WHEN period_id IS NOT NULL AND period_id <> '' THEN CAST(md5(exhibition_id::text || '_' || period_id) AS uuid)
        ELSE NULL 
    END
WHERE id_uuid IS NULL;

UPDATE timeline.timeline_events 
SET id_uuid = CAST(md5(exhibition_id::text || '_' || id) AS uuid),
    period_id_uuid = CASE 
        WHEN period_id IS NOT NULL AND period_id <> '' THEN CAST(md5(exhibition_id::text || '_' || period_id) AS uuid)
        ELSE NULL 
    END,
    swimlane_id_uuid = CASE 
        WHEN swimlane_id IS NOT NULL AND swimlane_id <> '' THEN CAST(md5(exhibition_id::text || '_' || swimlane_id) AS uuid)
        ELSE NULL 
    END
WHERE id_uuid IS NULL;

-- 6. 删除原有主键约束（防止重命名冲突），然后删除旧列，并重命名新 UUID 列为正式列
ALTER TABLE timeline.periods DROP CONSTRAINT IF EXISTS periods_pkey;
ALTER TABLE timeline.periods DROP COLUMN IF EXISTS id;
ALTER TABLE timeline.periods RENAME COLUMN id_uuid TO id;
ALTER TABLE timeline.periods ALTER COLUMN id SET NOT NULL;
ALTER TABLE timeline.periods ADD PRIMARY KEY (exhibition_id, id);

ALTER TABLE timeline.swimlanes DROP CONSTRAINT IF EXISTS streams_pkey;
ALTER TABLE timeline.swimlanes DROP COLUMN IF EXISTS id;
ALTER TABLE timeline.swimlanes DROP COLUMN IF EXISTS period_id;
ALTER TABLE timeline.swimlanes RENAME COLUMN id_uuid TO id;
ALTER TABLE timeline.swimlanes RENAME COLUMN period_id_uuid TO period_id;
ALTER TABLE timeline.swimlanes ALTER COLUMN id SET NOT NULL;
ALTER TABLE timeline.swimlanes ADD PRIMARY KEY (exhibition_id, id);

ALTER TABLE timeline.timeline_events DROP CONSTRAINT IF EXISTS timeline_events_pkey;
ALTER TABLE timeline.timeline_events DROP COLUMN IF EXISTS id;
ALTER TABLE timeline.timeline_events DROP COLUMN IF EXISTS period_id;
ALTER TABLE timeline.timeline_events DROP COLUMN IF EXISTS swimlane_id;
ALTER TABLE timeline.timeline_events RENAME COLUMN id_uuid TO id;
ALTER TABLE timeline.timeline_events RENAME COLUMN period_id_uuid TO period_id;
ALTER TABLE timeline.timeline_events RENAME COLUMN swimlane_id_uuid TO swimlane_id;
ALTER TABLE timeline.timeline_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE timeline.timeline_events ADD PRIMARY KEY (exhibition_id, id);

-- 7. 组装新外键约束（已全部切换为 UUID 关联）
ALTER TABLE timeline.periods ADD CONSTRAINT periods_exhibition_id_fkey 
    FOREIGN KEY (exhibition_id) REFERENCES timeline.exhibitions(id) ON DELETE CASCADE;

ALTER TABLE timeline.swimlanes ADD CONSTRAINT swimlanes_exhibition_id_fkey 
    FOREIGN KEY (exhibition_id) REFERENCES timeline.exhibitions(id) ON DELETE CASCADE;

ALTER TABLE timeline.swimlanes ADD CONSTRAINT swimlanes_exhibition_id_period_id_fkey 
    FOREIGN KEY (exhibition_id, period_id) REFERENCES timeline.periods(exhibition_id, id) ON DELETE SET NULL;

ALTER TABLE timeline.timeline_events ADD CONSTRAINT timeline_events_exhibition_id_fkey 
    FOREIGN KEY (exhibition_id) REFERENCES timeline.exhibitions(id) ON DELETE CASCADE;

ALTER TABLE timeline.timeline_events ADD CONSTRAINT timeline_events_exhibition_id_period_id_fkey 
    FOREIGN KEY (exhibition_id, period_id) REFERENCES timeline.periods(exhibition_id, id) ON DELETE SET NULL;

ALTER TABLE timeline.timeline_events ADD CONSTRAINT timeline_events_exhibition_id_swimlane_id_fkey 
    FOREIGN KEY (exhibition_id, swimlane_id) REFERENCES timeline.swimlanes(exhibition_id, id) ON DELETE SET NULL;

-- 8. 清除旧索引并重新建立
DROP INDEX IF EXISTS timeline.idx_periods_exhibition_id;
DROP INDEX IF EXISTS timeline.idx_streams_exhibition_id;
DROP INDEX IF EXISTS timeline.idx_streams_period_id;
DROP INDEX IF EXISTS timeline.idx_timeline_events_exhibition_id;
DROP INDEX IF EXISTS timeline.idx_timeline_events_period_id;
DROP INDEX IF EXISTS timeline.idx_timeline_events_stream_id;
DROP INDEX IF EXISTS timeline.idx_timeline_events_viewport;

CREATE INDEX IF NOT EXISTS idx_periods_exhibition_id ON timeline.periods(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_swimlanes_exhibition_id ON timeline.swimlanes(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_swimlanes_period_id ON timeline.swimlanes(exhibition_id, period_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_exhibition_id ON timeline.timeline_events(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_period_id ON timeline.timeline_events(exhibition_id, period_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_swimlane_id ON timeline.timeline_events(exhibition_id, swimlane_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_viewport ON timeline.timeline_events(exhibition_id, date_year, importance);
