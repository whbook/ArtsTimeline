#!/usr/bin/env python3
"""为缺本地文件的条目匹配 WSL images 目录中的相近文件，否则用占位图。"""
from __future__ import annotations

import shutil
from pathlib import Path

from fetch_missing_cover_images import (
    DEFAULT_WSL_UNC_ROOT,
    connect_db,
    decode_url,
    fetch_exhibition_id,
    load_connection_string,
    target_flat_path,
    update_image_url,
)

FALLBACK = "_assets__0c70a452f799bfe840676ee341124611_Disambig_gray.svg.png"


def find_similar(images: list[Path], wanted: str | None, title_en: str) -> Path | None:
    if not images:
        return None
    keys: list[str] = []
    if wanted:
        stem = Path(wanted).stem.lower()
        keys.extend([stem, stem.replace("_", ""), stem.replace("-", "_")])
    if title_en:
        te = title_en.replace(" ", "_").lower()
        keys.extend([te, te.replace("_", "")])
    for key in keys:
        if len(key) < 3:
            continue
        for p in images:
            name = p.name.lower()
            if key in name or name.startswith(key):
                return p
    return None


def main() -> None:
    root = DEFAULT_WSL_UNC_ROOT
    images_dir = root / "images"
    all_images = list(images_dir.glob("*")) if images_dir.is_dir() else []
    fallback = images_dir / FALLBACK
    matched = placeholder = synced = 0

    with connect_db(load_connection_string(None)) as conn:
        eid = fetch_exhibition_id(conn, "chinese-painting-history")
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, COALESCE(title_cn, ''), COALESCE(title_en, ''), image_url
                FROM timeline.timeline_events
                WHERE exhibition_id = %s::uuid
                  AND (image_url IS NULL OR image_url NOT LIKE '%%historyai%%')
                """,
                (eid,),
            )
            rows = cur.fetchall()

        for event_id, _title_cn, title_en, image_url in rows:
            dest = target_flat_path(root, image_url, title_en)
            if dest.is_file():
                if image_url and not str(image_url).startswith("file://"):
                    update_image_url(conn, event_id, dest, dry_run=False)
                    conn.commit()
                    synced += 1
                continue

            wanted = None
            if image_url:
                raw = decode_url(image_url.strip())
                if raw.startswith("./"):
                    raw = raw[2:]
                if raw.startswith("_assets_/"):
                    wanted = raw.split("/", 1)[1]

            src = find_similar(all_images, wanted, title_en)
            if src is None and fallback.is_file():
                src = fallback
                placeholder += 1
            else:
                matched += 1

            if src is None:
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            update_image_url(conn, event_id, dest, dry_run=False)
            conn.commit()

    print(f"synced={synced} matched={matched} placeholder={placeholder}")


if __name__ == "__main__":
    main()
