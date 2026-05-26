#!/usr/bin/env python3
"""将展览事件的封面图（ImageUrl）迁移至阿里云 OSS，并回写数据库。

OSS 路径规则（与 Timeline.Api.Services.OssFileUploadService 一致）：
    TimeLine/{exhibitionId}/{guid}_{safeFileName}

用法示例：
    # 中国绘画史：默认使用 WSL 源图目录（无需手动指定 --source-root）
    python scripts/upload_event_cover_images_to_oss.py \\
        --exhibition-slug chinese-painting-history \\
        --dry-run

    # 实际上传并更新数据库
    python scripts/upload_event_cover_images_to_oss.py \\
        --exhibition-slug chinese-painting-history \\
        --source-root "D:/data/chinese-painting-history"

    # 指定连接字符串与 OSS 凭据（也可通过环境变量 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）
    python scripts/upload_event_cover_images_to_oss.py \\
        --connection-string "Host=localhost;Port=5432;Database=timeline;Username=epochai;Password=***" \\
        --oss-access-key-id "***" \\
        --oss-access-key-secret "***"

依赖：psycopg（pip install "psycopg[binary]"）
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import mimetypes
import re
import subprocess
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path, PurePosixPath
from typing import Any
from urllib import error, parse, request


REPO_ROOT = Path(__file__).resolve().parents[1]
API_PROJECT = REPO_ROOT / "Timeline.Api" / "Timeline.Api.csproj"
DEFAULT_APPSETTINGS = REPO_ROOT / "Timeline.Api" / "appsettings.json"
DEFAULT_DEV_SETTINGS = REPO_ROOT / "Timeline.Api" / "appsettings.Development.json"

LEGACY_LINUX_ROOT = PurePosixPath("/home/wsz/chinese-painting-history")
# file:///home/wsz/chinese-painting-history/... 在 Windows 上对应 WSL 目录
DEFAULT_WSL_UNC_ROOT = Path(r"\\wsl.localhost\Ubuntu\home\wsz\chinese-painting-history")


@dataclass
class OssConfig:
    provider: str
    endpoint: str
    bucket: str
    access_key_id: str
    access_key_secret: str


@dataclass
class EventRow:
    id: str
    title_cn: str
    image_url: str | None


def safe_print(message: str, *, file: Any = None) -> None:
    stream = file or sys.stdout
    try:
        print(message, file=stream)
    except UnicodeEncodeError:
        encoding = getattr(stream, "encoding", None) or "utf-8"
        print(message.encode(encoding, errors="replace").decode(encoding), file=stream)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="上传展览事件封面图至 OSS 并更新 ImageUrl")
    parser.add_argument(
        "--exhibition-slug",
        default="chinese-painting-history",
        help="展览 slug，默认 chinese-painting-history（中国绘画史）",
    )
    parser.add_argument(
        "--exhibition-title",
        help="按中文标题查找展览（与 slug 二选一，slug 优先）",
    )
    parser.add_argument(
        "--source-root",
        type=Path,
        help=(
            "本地源图根目录，用于解析 file:// 与 ./_assets_/ 等相对路径。"
            "中国绘画史默认：\\\\wsl.localhost\\Ubuntu\\home\\wsz\\chinese-painting-history"
        ),
    )
    parser.add_argument(
        "--connection-string",
        help="PostgreSQL 连接字符串；默认读取 appsettings.Development.json",
    )
    parser.add_argument("--oss-endpoint", help="OSS Endpoint，默认读取 appsettings.json")
    parser.add_argument("--oss-bucket", help="OSS Bucket，默认读取 appsettings.json")
    parser.add_argument("--oss-access-key-id", help="OSS AccessKeyId，默认 user-secrets 或环境变量")
    parser.add_argument("--oss-access-key-secret", help="OSS AccessKeySecret，默认 user-secrets 或环境变量")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅预览，不上传、不写库",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="即使 ImageUrl 已是 OSS 地址也重新上传",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="最多处理 N 条（0 表示不限制）",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="将处理结果写入 JSON 报告",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


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


def parse_connection_string(raw: str) -> dict[str, str]:
    parts: dict[str, str] = {}
    for segment in raw.split(";"):
        segment = segment.strip()
        if not segment or "=" not in segment:
            continue
        key, value = segment.split("=", 1)
        parts[key.strip().lower()] = value.strip()
    return parts


def load_connection_string(explicit: str | None) -> str:
    if explicit:
        return explicit

    dev = load_json(DEFAULT_DEV_SETTINGS)
    conn = dev.get("ConnectionStrings", {}).get("DefaultConnection")
    if conn:
        return conn

    base = load_json(DEFAULT_APPSETTINGS)
    conn = base.get("ConnectionStrings", {}).get("DefaultConnection")
    if conn:
        return conn

    raise SystemExit("未找到数据库连接字符串，请使用 --connection-string 指定。")


def load_oss_config(args: argparse.Namespace) -> OssConfig:
    settings = load_json(DEFAULT_APPSETTINGS).get("Oss", {})
    secrets = load_user_secrets()

    access_key_id = (
        args.oss_access_key_id
        or secrets.get("Oss:AccessKeyId")
        or __import__("os").environ.get("OSS_ACCESS_KEY_ID", "")
    )
    access_key_secret = (
        args.oss_access_key_secret
        or secrets.get("Oss:AccessKeySecret")
        or __import__("os").environ.get("OSS_ACCESS_KEY_SECRET", "")
    )

    if not access_key_id or not access_key_secret:
        raise SystemExit(
            "OSS 凭据未配置。请设置 user-secrets、环境变量 OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET，"
            "或使用 --oss-access-key-id / --oss-access-key-secret。"
        )

    return OssConfig(
        provider=settings.get("Provider", "aliyun"),
        endpoint=args.oss_endpoint or settings.get("Endpoint", ""),
        bucket=args.oss_bucket or settings.get("Bucket", ""),
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
    )


def connect_db(connection_string: str):
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit(
            '缺少依赖 psycopg，请先执行：pip install "psycopg[binary]"'
        ) from exc

    parts = parse_connection_string(connection_string)
    host = parts.get("host", "localhost")
    port = int(parts.get("port", "5432"))
    dbname = parts.get("database", parts.get("dbname", "timeline"))
    user = parts.get("username", parts.get("user", "epochai"))
    password = parts.get("password", "")

    return psycopg.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
    )


def fetch_exhibition_id(conn, slug: str | None, title: str | None) -> tuple[str, str]:
    with conn.cursor() as cur:
        if slug:
            cur.execute(
                "SELECT id::text, title_cn FROM timeline.exhibitions WHERE slug = %s",
                (slug,),
            )
        elif title:
            cur.execute(
                "SELECT id::text, title_cn FROM timeline.exhibitions WHERE title_cn = %s",
                (title,),
            )
        else:
            raise SystemExit("请指定 --exhibition-slug 或 --exhibition-title")

        row = cur.fetchone()
        if not row:
            label = slug or title
            raise SystemExit(f"未找到展览：{label}")
        return row[0], row[1]


def fetch_events(conn, exhibition_id: str, limit: int) -> list[EventRow]:
    sql = """
        SELECT id::text, COALESCE(title_cn, ''), image_url
        FROM timeline.timeline_events
        WHERE exhibition_id = %s::uuid
          AND image_url IS NOT NULL
          AND btrim(image_url) <> ''
        ORDER BY title_cn, id
    """
    if limit > 0:
        sql += f" LIMIT {int(limit)}"

    with conn.cursor() as cur:
        cur.execute(sql, (exhibition_id,))
        return [EventRow(id=r[0], title_cn=r[1], image_url=r[2]) for r in cur.fetchall()]


def normalize_endpoint(endpoint: str) -> str:
    ep = endpoint.strip().rstrip("/")
    if not ep.startswith(("http://", "https://")):
        ep = "https://" + ep
    return ep


def build_object_url(endpoint: str, bucket: str, oss_key: str) -> str:
    parsed = parse.urlparse(normalize_endpoint(endpoint))
    return f"{parsed.scheme}://{bucket}.{parsed.netloc}/{oss_key}"


def is_oss_url(image_url: str, bucket: str) -> bool:
    lowered = image_url.lower()
    return bucket.lower() in lowered and re.search(r"/timeline/", image_url, re.IGNORECASE) is not None


def make_safe_file_name(file_name: str) -> str:
    stem = Path(file_name).stem
    ext = Path(file_name).suffix.lower()
    stem = re.sub(r"[^\w\-.]", "-", stem, flags=re.ASCII)
    stem = re.sub(r"-{2,}", "-", stem).strip("-")
    if not stem:
        stem = "file"
    return stem + ext


def resolve_default_source_root(exhibition_slug: str | None) -> Path | None:
    if exhibition_slug == "chinese-painting-history" and DEFAULT_WSL_UNC_ROOT.exists():
        return DEFAULT_WSL_UNC_ROOT
    return None


def decode_url(value: str) -> str:
    prev = value
    for _ in range(3):
        cur = parse.unquote(prev)
        if cur == prev:
            break
        prev = cur
    return prev


def map_relative_assets_path(relative: str, source_root: Path) -> Path | None:
    """./_assets_/hash/file.ext -> images/_assets__hash_file.ext"""
    relative = decode_url(relative)
    match = re.match(r"^_assets_/([^/]+)/(.+)$", relative)
    if not match:
        return None
    asset_hash, file_name = match.groups()
    candidates = [
        source_root / "images" / f"_assets__{asset_hash}_{file_name}",
        source_root / "images" / f"_assets__{asset_hash}_{decode_url(file_name)}",
    ]
    for flattened in candidates:
        if flattened.exists():
            return flattened
    return None


def decode_url(value: str) -> str:
    prev = value
    for _ in range(3):
        cur = parse.unquote(prev)
        if cur == prev:
            break
        prev = cur
    return prev


def resolve_local_path(image_url: str, source_root: Path | None) -> Path | None:
    raw = decode_url(image_url.strip())

    if raw.startswith(("http://", "https://")):
        return None

    if raw.startswith("file://"):
        parsed = parse.urlparse(raw)
        posix_path = PurePosixPath(parsed.path)
        if source_root is None:
            local = Path(parsed.path)
            return local if local.exists() else None

        if str(posix_path).startswith(str(LEGACY_LINUX_ROOT)):
            relative = posix_path.relative_to(LEGACY_LINUX_ROOT)
            candidate = source_root / Path(*relative.parts)
            if candidate.exists():
                return candidate

        file_name = posix_path.name
        for candidate in (
            source_root / "images" / file_name,
            source_root / file_name,
            source_root / Path(*posix_path.parts[1:]),
        ):
            if candidate.exists():
                return candidate
        return None

    relative = raw[2:] if raw.startswith("./") else raw.lstrip("/")
    if source_root is None:
        candidate = Path(relative)
        return candidate if candidate.exists() else None

    mapped = map_relative_assets_path(relative, source_root)
    if mapped is not None:
        return mapped

    candidate = source_root / Path(*PurePosixPath(relative).parts)
    if candidate.exists():
        return candidate

    return None


def download_http(url: str, timeout: int = 120) -> tuple[bytes, str]:
    req = request.Request(url, headers={"User-Agent": "ArtsTimeline-OSS-Migrator/1.0"})
    with request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        content_type = resp.headers.get_content_type() or "application/octet-stream"
        return data, content_type


def read_source_bytes(image_url: str, source_root: Path | None) -> tuple[bytes, str, str]:
    if image_url.startswith(("http://", "https://")):
        data, content_type = download_http(image_url)
        file_name = Path(parse.urlparse(image_url).path).name or "image"
        return data, content_type, file_name

    local_path = resolve_local_path(image_url, source_root)
    if local_path is None or not local_path.is_file():
        raise FileNotFoundError(f"无法解析本地文件：{image_url}")

    data = local_path.read_bytes()
    content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
    return data, content_type, local_path.name


def upload_to_oss(
    oss: OssConfig,
    exhibition_id: str,
    file_name: str,
    data: bytes,
    content_type: str,
) -> str:
    provider = oss.provider.strip().lower()
    if "aliyun" not in provider and "oss" not in provider:
        raise NotImplementedError(f"暂不支持的 OSS Provider: {oss.provider}")

    safe_name = make_safe_file_name(file_name)
    oss_key = f"TimeLine/{exhibition_id}/{uuid.uuid4().hex}_{safe_name}"

    md5_digest = hashlib.md5(data).digest()
    content_md5 = base64.b64encode(md5_digest).decode("ascii")
    date_header = formatdate(timeval=None, usegmt=True)
    resource = f"/{oss.bucket}/{oss_key}"
    string_to_sign = f"PUT\n{content_md5}\n{content_type}\n{date_header}\n{resource}"
    signature = base64.b64encode(
        hmac.new(
            oss.access_key_secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("ascii")

    url = build_object_url(oss.endpoint, oss.bucket, oss_key)
    req = request.Request(url, data=data, method="PUT")
    req.add_header("Content-Type", content_type)
    req.add_header("Content-MD5", content_md5)
    req.add_header("Date", date_header)
    req.add_header("Content-Disposition", "inline")
    req.add_header("Authorization", f"OSS {oss.access_key_id}:{signature}")

    try:
        with request.urlopen(req, timeout=300) as resp:
            if resp.status >= 400:
                body = resp.read().decode("utf-8", errors="replace")
                raise RuntimeError(f"OSS 上传失败 ({resp.status})：{body}")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OSS 上传失败 ({exc.code})：{body}") from exc

    return url


def update_event_image_url(conn, event_id: str, new_url: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE timeline.timeline_events
            SET image_url = %s, updated_at = NOW()
            WHERE id = %s::uuid
            """,
            (new_url, event_id),
        )


def main() -> int:
    args = parse_args()
    connection_string = load_connection_string(args.connection_string)
    oss = load_oss_config(args)

    if not oss.endpoint or not oss.bucket:
        raise SystemExit("OSS Endpoint 或 Bucket 未配置。")

    report_rows: list[dict[str, Any]] = []
    stats = {"uploaded": 0, "skipped": 0, "failed": 0}

    with connect_db(connection_string) as conn:
        exhibition_id, exhibition_title = fetch_exhibition_id(
            conn, args.exhibition_slug, args.exhibition_title
        )
        events = fetch_events(conn, exhibition_id, args.limit)

        safe_print(f"展览：{exhibition_title} ({exhibition_id})")
        safe_print(f"待检查事件数：{len(events)}")
        if args.dry_run:
            safe_print("模式：dry-run（不上传、不写库）")

        needs_local = any(
            not (ev.image_url or "").startswith(("http://", "https://"))
            and not is_oss_url(ev.image_url or "", oss.bucket)
            for ev in events
        )
        source_root = args.source_root
        if source_root is None:
            source_root = resolve_default_source_root(args.exhibition_slug)
        if needs_local and source_root is None:
            raise SystemExit(
                "检测到 file:// 或相对路径封面图，请通过 --source-root 指定本地源图目录，"
                "或确保 WSL 路径可用：\\\\wsl.localhost\\Ubuntu\\home\\wsz\\chinese-painting-history"
            )

        if source_root and not source_root.exists():
            raise SystemExit(f"源图目录不存在：{source_root}")

        if source_root:
            safe_print(f"源图目录：{source_root}")

        for event in events:
            row: dict[str, Any] = {
                "eventId": event.id,
                "titleCn": event.title_cn,
                "oldImageUrl": event.image_url,
                "newImageUrl": None,
                "status": "pending",
                "error": None,
            }

            image_url = event.image_url or ""
            try:
                if not args.force and is_oss_url(image_url, oss.bucket):
                    row["status"] = "skipped_already_oss"
                    row["newImageUrl"] = image_url
                    stats["skipped"] += 1
                    report_rows.append(row)
                    safe_print(f"[跳过] {event.title_cn}（已是 OSS）")
                    continue

                data, content_type, file_name = read_source_bytes(image_url, source_root)

                if args.dry_run:
                    local_hint = resolve_local_path(image_url, source_root)
                    row["status"] = "dry_run"
                    row["resolvedPath"] = str(local_hint) if local_hint else None
                    stats["skipped"] += 1
                    safe_print(f"[预览] {event.title_cn} -> {file_name} ({len(data)} bytes)")
                    report_rows.append(row)
                    continue

                new_url = upload_to_oss(oss, exhibition_id, file_name, data, content_type)
                update_event_image_url(conn, event.id, new_url)
                conn.commit()

                row["status"] = "uploaded"
                row["newImageUrl"] = new_url
                stats["uploaded"] += 1
                safe_print(f"[完成] {event.title_cn}")
                safe_print(f"       {image_url}")
                safe_print(f"    -> {new_url}")

            except Exception as exc:  # noqa: BLE001 - batch script keeps going
                conn.rollback()
                row["status"] = "failed"
                row["error"] = str(exc)
                stats["failed"] += 1
                safe_print(f"[失败] {event.title_cn}: {exc}", file=sys.stderr)

            report_rows.append(row)

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "exhibitionId": exhibition_id,
        "exhibitionTitle": exhibition_title,
        "stats": stats,
        "items": report_rows,
    }

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"报告已写入：{args.report}")

    print(
        f"完成：上传 {stats['uploaded']}，跳过 {stats['skipped']}，失败 {stats['failed']}"
    )
    return 1 if stats["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
