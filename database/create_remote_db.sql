-- 在 8.152.158.252 上以 postgres 超级用户执行（一次性）
CREATE DATABASE timeline OWNER epochai;
GRANT ALL PRIVILEGES ON DATABASE timeline TO epochai;

-- 建库后由 Timeline.Api 启动时自动执行 database/init.sql
