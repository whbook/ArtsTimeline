#!/usr/bin/env python3
"""从 image_url 中的 Commons 文件名批量下载缺失封面。"""
from __future__ import annotations

import json
import re
import socket
import sys
import time
from pathlib import Path
from urllib import parse

socket.setdefaulttimeout(20)

from fetch_missing_cover_images import (
    DEFAULT_WSL_UNC_ROOT,
    connect_db,
    commons_file_url,
    decode_url,
    download_to,
    fetch_exhibition_id,
    load_connection_string,
    target_flat_path,
    update_image_url,
    wiki_page_image,
)

REPORT = Path(__file__).resolve().parents[1] / "scripts" / "reports" / "chinese-painting-upload.json"


def pending_from_db(conn, exhibition_id: str) -> list[tuple[str, str, str, str | None]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, COALESCE(title_cn, ''), COALESCE(title_en, ''), image_url
            FROM timeline.timeline_events
            WHERE exhibition_id = %s::uuid
              AND (image_url IS NULL OR btrim(image_url) = '' OR image_url NOT LIKE '%%historyai%%')
            ORDER BY title_cn
            """,
            (exhibition_id,),
        )
        return [(r[0], r[1], r[2], r[3]) for r in cur.fetchall()]


def filename_from_url(image_url: str | None) -> str | None:
    if not image_url:
        return None
    raw = decode_url(image_url.strip())
    if raw.startswith("./"):
        raw = raw[2:]
    m = re.match(r"^_assets_/[^/]+/(.+)$", raw)
    if m:
        return decode_url(m.group(1))
    if raw.startswith("file://"):
        return Path(parse.urlparse(raw).path).name
    return Path(parse.urlparse(raw).path).name if "/" in raw else None


def resolve_url(image_url: str | None, title_en: str, title_cn: str) -> str | None:
    name = filename_from_url(image_url)
    if name:
        url = commons_file_url(name)
        if url:
            return url
        base = name.rsplit(".", 1)[0]
        url = commons_file_url(base.replace("_", " ") + ".jpg")
        if url:
            return url
    for title in (title_en, title_cn):
        if title:
            url = wiki_page_image("en", title)
            if url:
                return url
    for title in (title_cn, title_en):
        if title:
            url = wiki_page_image("zh", title)
            if url:
                return url
    return None


def main() -> int:
    root = DEFAULT_WSL_UNC_ROOT
    ok = fail = skip = 0
    with connect_db(load_connection_string(None)) as conn:
        eid = fetch_exhibition_id(conn, "chinese-painting-history")
        rows = pending_from_db(conn, eid)
        print(f"pending {len(rows)}", flush=True)
        for event_id, title_cn, title_en, image_url in rows:
            dest = target_flat_path(root, image_url, title_en)
            if dest.is_file():
                update_image_url(conn, event_id, dest, dry_run=False)
                conn.commit()
                skip += 1
                continue
            url = resolve_url(image_url, title_en, title_cn)
            if not url:
                fail += 1
                continue
            try:
                download_to(url, dest)
                update_image_url(conn, event_id, dest, dry_run=False)
                conn.commit()
                ok += 1
                print("ok", dest.name[:60], flush=True)
            except Exception as exc:  # noqa: BLE001
                fail += 1
                print("err", str(exc)[:80], flush=True)
            time.sleep(0.25)
    print(f"done ok={ok} skip={skip} fail={fail}", flush=True)
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
