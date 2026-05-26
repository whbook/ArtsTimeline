#!/usr/bin/env python3
"""将 OSS 封面图元数据改为 inline 预览，并修正 Content-Type。

用于修复批量迁移时未设置 Content-Disposition 导致浏览器无法内联显示的问题。

用法：
    python scripts/fix_oss_image_metadata.py --exhibition-slug chinese-painting-history
    python scripts/fix_oss_image_metadata.py --url "https://historyai.oss-cn-beijing..."
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import mimetypes
import re
import subprocess
import sys
from base64 import b64encode
from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path, PurePosixPath
from typing import Any
from urllib import error, parse, request

REPO_ROOT = Path(__file__).resolve().parents[1]
API_PROJECT = REPO_ROOT / "Timeline.Api" / "Timeline.Api.csproj"
DEFAULT_APPSETTINGS = REPO_ROOT / "Timeline.Api" / "appsettings.json"
DEFAULT_DEV_SETTINGS = REPO_ROOT / "Timeline.Api" / "appsettings.Development.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="修复 OSS 对象 Content-Disposition / Content-Type")
    parser.add_argument("--exhibition-slug", default="chinese-painting-history")
    parser.add_argument("--url", action="append", help="仅修复指定 OSS URL（可重复）")
    parser.add_argument("--connection-string")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def load_user_secrets() -> dict[str, str]:
    if not API_PROJECT.exists():
        return {}
    try:
        result = subprocess.run(
            ["dotnet", "user-secrets", "list", "--project", str(API_PROJECT)],
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return {}
    secrets: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            secrets[key.strip()] = value.strip()
    return secrets


def load_connection_string(explicit: str | None) -> str:
    if explicit:
        return explicit
    for path in (DEFAULT_DEV_SETTINGS, DEFAULT_APPSETTINGS):
        conn = load_json(path).get("ConnectionStrings", {}).get("DefaultConnection")
        if conn:
            return conn
    raise SystemExit("未找到数据库连接字符串")


def load_oss_config() -> tuple[str, str, str, str]:
    settings = load_json(DEFAULT_APPSETTINGS).get("Oss", {})
    secrets = load_user_secrets()
    access_key_id = secrets.get("Oss:AccessKeyId") or __import__("os").environ.get("OSS_ACCESS_KEY_ID", "")
    access_key_secret = secrets.get("Oss:AccessKeySecret") or __import__("os").environ.get("OSS_ACCESS_KEY_SECRET", "")
    endpoint = settings.get("Endpoint", "")
    bucket = settings.get("Bucket", "")
    if not all([access_key_id, access_key_secret, endpoint, bucket]):
        raise SystemExit("OSS 凭据或 Endpoint/Bucket 未配置")
    return endpoint, bucket, access_key_id, access_key_secret


def connect_db(connection_string: str):
    import psycopg

    parts = {}
    for segment in connection_string.split(";"):
        if "=" in segment:
            k, v = segment.split("=", 1)
            parts[k.strip().lower()] = v.strip()
    return psycopg.connect(
        host=parts.get("host", "localhost"),
        port=int(parts.get("port", "5432")),
        dbname=parts.get("database", parts.get("dbname", "timeline")),
        user=parts.get("username", parts.get("user", "epochai")),
        password=parts.get("password", ""),
        connect_timeout=10,
    )


def extract_key(url: str, bucket: str) -> str:
    path = parse.urlparse(url).path.lstrip("/")
    if path.lower().startswith(bucket.lower() + "/"):
        path = path[len(bucket) + 1 :]
    return path


def guess_content_type(key: str) -> str:
    ctype, _ = mimetypes.guess_type(PurePosixPath(key).name)
    return ctype or "application/octet-stream"


def copy_with_metadata(
    endpoint: str,
    bucket: str,
    access_key_id: str,
    access_key_secret: str,
    key: str,
    content_type: str,
    dry_run: bool,
) -> None:
    if not endpoint.startswith("http"):
        endpoint = "https://" + endpoint
    host = parse.urlparse(endpoint).netloc
    object_url = f"https://{bucket}.{host}/{key}"
    date_header = formatdate(timeval=None, usegmt=True)
    copy_source = f"/{bucket}/{key}"
    oss_headers = {
        "x-oss-copy-source": copy_source,
        "x-oss-metadata-directive": "REPLACE",
    }
    canonicalized = "".join(f"{k.lower()}:{v}\n" for k, v in sorted(oss_headers.items()))
    resource = f"/{bucket}/{key}"
    string_to_sign = f"PUT\n\n{content_type}\n{date_header}\n{canonicalized}{resource}"
    signature = b64encode(
        hmac.new(access_key_secret.encode(), string_to_sign.encode(), hashlib.sha1).digest()
    ).decode()

    if dry_run:
        print(f"[预览] {key} -> inline, {content_type}")
        return

    req = request.Request(object_url, method="PUT")
    req.add_header("Date", date_header)
    req.add_header("Authorization", f"OSS {access_key_id}:{signature}")
    req.add_header("x-oss-copy-source", copy_source)
    req.add_header("x-oss-metadata-directive", "REPLACE")
    req.add_header("Content-Type", content_type)
    req.add_header("Content-Disposition", "inline")

    with request.urlopen(req, timeout=120) as resp:
        if resp.status >= 400:
            raise RuntimeError(resp.read().decode("utf-8", errors="replace"))


def fetch_oss_urls(conn, slug: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT image_url
            FROM timeline.timeline_events
            WHERE exhibition_id = (SELECT id FROM timeline.exhibitions WHERE slug = %s)
              AND image_url LIKE '%%historyai%%'
            UNION
            SELECT DISTINCT high_res_image_url
            FROM timeline.timeline_events
            WHERE exhibition_id = (SELECT id FROM timeline.exhibitions WHERE slug = %s)
              AND high_res_image_url LIKE '%%historyai%%'
            """,
            (slug, slug),
        )
        return [row[0] for row in cur.fetchall() if row[0]]


def main() -> int:
    args = parse_args()
    endpoint, bucket, access_key_id, access_key_secret = load_oss_config()
    urls = args.url or []
    if not urls:
        with connect_db(load_connection_string(args.connection_string)) as conn:
            urls = fetch_oss_urls(conn, args.exhibition_slug)

    print(f"待修复：{len(urls)} 个对象")
    failed = 0
    for url in urls:
        key = extract_key(url, bucket)
        ctype = guess_content_type(key)
        try:
            copy_with_metadata(endpoint, bucket, access_key_id, access_key_secret, key, ctype, args.dry_run)
            print(f"[完成] {key}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"[失败] {key}: {exc}", file=sys.stderr)
    print(f"完成，失败 {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
