#!/usr/bin/env python3
"""为展览事件补全缺失的本地封面源图（写入 WSL images 扁平目录）。

优先顺序：
1. 从 image_url 中的 Wikimedia 文件名直接拉取
2. 从 Wikipedia / Wikimedia Commons 搜索拉取
3. 从英文/中文 Wikipedia 条目 pageimage 拉取

用法：
    python scripts/fetch_missing_cover_images.py --exhibition-slug chinese-painting-history
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import socket
import sys
import time
from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Any
from urllib import error, parse, request

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DEV_SETTINGS = REPO_ROOT / "Timeline.Api" / "appsettings.Development.json"
DEFAULT_APPSETTINGS = REPO_ROOT / "Timeline.Api" / "appsettings.json"
DEFAULT_WSL_UNC_ROOT = Path(r"\\wsl.localhost\Ubuntu\home\wsz\chinese-painting-history")
LEGACY_LINUX_ROOT = PurePosixPath("/home/wsz/chinese-painting-history")
ASSET_HASH = "0c70a452f799bfe840676ee341124611"
TITLE_EN_ALIASES: dict[str, str] = {
    "顾恺之": "Gu Kaizhi",
    "关仝": "Guan Tong",
    "巨然": "Juran",
    "张萱": "Zhang Xuan",
    "周昉": "Zhou Fang",
    "唐寅": "Tang Yin",
    "夏圭": "Xia Gui",
    "仇英": "Qiu Ying",
    "八大山人": "Bada Shanren",
    "吴昌硕": "Wu Changshuo",
    "任伯年": "Ren Bonian",
    "张大千": "Zhang Daqian",
    "齐白石": "Qi Baishi",
    "林风眠": "Lin Fengmian",
    "潘天寿": "Pan Tianshou",
    "陈洪绶": "Chen Hongshou",
    "韩滉": "Han Huang",
    "荆浩": "Jing Hao",
    "赵孟頫": "Zhao Mengfu",
    "马远": "Ma Yuan",
    "米芾": "Mi Fu",
    "写生珍禽图": "The Sketching of Rare Birds",
    "簪花仕女图": "Court Ladies Adorning Their Hair",
    "谿山行旅图": "Travelers Among Mountains and Streams",
    "溪山行旅图": "Travelers Among Mountains and Streams",
    "千里江山图": "A Thousand Li of Rivers and Mountains",
    "早春图": "Early Spring",
    "岭南画派": "Lingnan school of painting",
    "人物画": "Chinese figure painting",
}

KNOWN_DIRECT_URLS: dict[str, str] = {
    "富春山居图": "https://upload.wikimedia.org/wikipedia/commons/d/d2/Dwelling_in_the_Fuchun_Mountains_%28first_half%29.JPG",
    "黄公望": "https://upload.wikimedia.org/wikipedia/commons/f/f9/Huang_Gongwang._Dwelling_in_the_Fuchun_Mountains_%28detail%29.jpg",
    "苏轼": "https://upload.wikimedia.org/wikipedia/commons/9/98/Su_shi.jpg",
    "任伯年": "https://upload.wikimedia.org/wikipedia/commons/8/8d/Ren_Yi_%28Ren_Bonian%29_Self-Portrait.jpg",
    "关山月": "https://upload.wikimedia.org/wikipedia/commons/5/55/Guan_Shangyue.jpg",
    "中国画": "https://upload.wikimedia.org/wikipedia/commons/1/10/Chinese_landscape_painting_in_the_Sui_Dynasty.jpg",
    "人物画": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Traditional_Chinese_sugar_painting.jpg",
    "步辇图": "https://upload.wikimedia.org/wikipedia/commons/3/3e/Emperor_Taizong_Receiving_the_Tibetan_Envoy.jpg",
    "张择端": "https://upload.wikimedia.org/wikipedia/commons/6/6a/Along_the_River_During_the_Qingming_Festival_%28Qing_Court_Version%29.jpg",
    "董源": "https://upload.wikimedia.org/wikipedia/commons/4/4e/Dong_Yuan_-_Wintry_Groves_and_Layered_Banks.jpg",
    "李成": "https://upload.wikimedia.org/wikipedia/commons/2/2d/Li_Cheng_-_A_Buddhist_Temple_in_Mountain.jpg",
    "蒋兆和": "https://upload.wikimedia.org/wikipedia/commons/0/0a/Jiang_Zhaohe_-_The_Refugees.jpg",
}

KNOWN_COMMONS_FILES: dict[str, str] = {
    "写生珍禽图": "The Sketching of Rare Birds 写生珍禽图卷.jpg",
    "唐寅": "Tang Yin.jpg",
    "吴昌硕": "Wu Changshuo.jpg",
    "米芾": "Mi Fu.jpg",
    "陈洪绶": "Chen Hongshou selfportrait,1635 - crop.jpg",
    "齐白石": "Qi Baishi (1956), by Zheng Jingkang.jpg",
    "荆浩": "Jing Hao.Mount Kuanglu. National Palace Museum, Taipei, Taiwan.jpg",
    "早春图": "Guo Xi - Early Spring.jpg",
    "夏圭": "Xia Gui - Pure and Remote View of Streams and Mountains.jpg",
    "簪花仕女图": "Zhou Fang - Court Ladies Wearing Flowered Headdresses.jpg",
    "周昉": "Zhou Fang - Lady With Servants (or Lady With Fan). (33,7x204,8) Beijing Palace Museum.jpg",
    "韩滉": "Han Huang.jpg",
    "赵孟𫖯": "Zhao Mengfu.jpg",
    "岭南画派": "Gao Jianfu.jpg",
}

# 可复用 images 目录中已有文件的条目
COPY_EXISTING: dict[str, str] = {
    "八大山人": "_assets__0c70a452f799bfe840676ee341124611_Lotus_and_Birds_by_Zhu_Da.jpg",
    "关仝": "_assets__0c70a452f799bfe840676ee341124611_Fan_Kuan_-_Travelers_Among_Mountains_and_Streams_-_Google_Art_Project.jpg",
    "谿山行旅图": "_assets__0c70a452f799bfe840676ee341124611_Fan_Kuan_-_Travelers_Among_Mountains_and_Streams_-_Google_Art_Project.jpg",
    "溪山行旅图": "_assets__0c70a452f799bfe840676ee341124611_Fan_Kuan_-_Travelers_Among_Mountains_and_Streams_-_Google_Art_Project.jpg",
    "踏歌图": "_assets__0c70a452f799bfe840676ee341124611_Ma_Yuan_Walking_on_Path_in_Spring.jpg",
    "马远": "_assets__0c70a452f799bfe840676ee341124611_Ma_Yuan_Walking_on_Path_in_Spring.jpg",
    "花鸟画": "_assets__0c70a452f799bfe840676ee341124611_Huang-Quan-Xie-sheng-zhen-qin-tu.jpg",
}

USER_AGENT = "ArtsTimeline-CoverFetcher/1.2"
DEFAULT_TIMEOUT = 15
PLACEHOLDER_URL_MARKERS = (
    "Disambig_gray",
    "Wikisource-logo",
    "Searchtool",
    "Nuvola_",
    "Flag_of_China",
    "Confusion_grey",
    "Albrecht_D",
    "Adam_and_Eve",
)
PLACEHOLDER_FILE_MARKERS = (
    "disambig",
    "wikisource",
    "searchtool",
    "nuvola",
    "flag_of_china",
    "confusion",
)
PLACEHOLDER_MAX_BYTES = 2048


def safe_print(message: str, *, file: Any = None, flush: bool = False) -> None:
    stream = file or sys.stdout
    encoding = getattr(stream, "encoding", None) or "utf-8"
    text = message.encode(encoding, errors="replace").decode(encoding)
    print(text, file=stream, flush=flush)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="补全展览事件缺失的封面源图")
    parser.add_argument("--exhibition-slug", default="chinese-painting-history")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_WSL_UNC_ROOT)
    parser.add_argument("--connection-string")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--refetch-placeholders",
        action="store_true",
        help="重新拉取 OSS/本地占位图或错误匹配封面（需外网）",
    )
    return parser.parse_args()


def load_connection_string(explicit: str | None) -> str:
    if explicit:
        return explicit
    for path in (DEFAULT_DEV_SETTINGS, DEFAULT_APPSETTINGS):
        if path.exists():
            conn = json.loads(path.read_text(encoding="utf-8")).get("ConnectionStrings", {}).get("DefaultConnection")
            if conn:
                return conn
    raise SystemExit("未找到数据库连接字符串")


def connect_db(connection_string: str):
    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit('缺少 psycopg，请执行：pip install "psycopg[binary]"') from exc

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


def fetch_exhibition_id(conn, slug: str) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT id::text FROM timeline.exhibitions WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            raise SystemExit(f"未找到展览：{slug}")
        return row[0]


def fetch_pending_events(conn, exhibition_id: str) -> list[tuple[str, str, str, str | None]]:
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


def fetch_all_events(conn, exhibition_id: str) -> list[tuple[str, str, str, str | None]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, COALESCE(title_cn, ''), COALESCE(title_en, ''), image_url
            FROM timeline.timeline_events
            WHERE exhibition_id = %s::uuid
            ORDER BY title_cn
            """,
            (exhibition_id,),
        )
        return [(r[0], r[1], r[2], r[3]) for r in cur.fetchall()]


def local_name_from_image_url(image_url: str | None) -> str | None:
    if not image_url:
        return None
    raw = decode_url(image_url.strip())
    if raw.startswith("file://"):
        return PurePosixPath(parse.urlparse(raw).path).name
    match = re.search(r"__assets__(.+)$", raw)
    if match:
        return f"_assets__{match.group(1)}"
    relative = raw[2:] if raw.startswith("./") else raw
    asset_match = re.match(r"^_assets_/([^/]+)/(.+)$", relative)
    if asset_match:
        asset_hash, file_name = asset_match.groups()
        return f"_assets__{asset_hash}_{decode_url(file_name)}"
    return None


def is_placeholder_url(image_url: str | None) -> bool:
    if not image_url:
        return True
    raw = decode_url(image_url)
    return any(marker in raw for marker in PLACEHOLDER_URL_MARKERS)


def is_placeholder_file(path: Path) -> bool:
    if not path.is_file():
        return True
    if path.stat().st_size <= PLACEHOLDER_MAX_BYTES:
        return True
    lowered = path.name.lower()
    return any(marker in lowered for marker in PLACEHOLDER_FILE_MARKERS)


def needs_refetch(source_root: Path, image_url: str | None, title_en: str) -> bool:
    if not image_url or not image_url.strip():
        return True
    if is_placeholder_url(image_url):
        return True
    path = target_flat_path(source_root, image_url, title_en)
    if path.is_file() and is_placeholder_file(path):
        return True
    if image_url.startswith("file://") and is_placeholder_file(path):
        return True
    if "historyai" in image_url:
        return False
    return is_placeholder_file(path)


def decode_url(value: str) -> str:
    prev = value
    for _ in range(3):
        cur = parse.unquote(prev)
        if cur == prev:
            break
        prev = cur
    return prev


def target_flat_path(source_root: Path, image_url: str | None, title_en: str) -> Path:
    images_dir = source_root / "images"
    local_name = local_name_from_image_url(image_url)
    if local_name and not any(marker.lower() in local_name.lower() for marker in PLACEHOLDER_URL_MARKERS):
        return images_dir / local_name
    safe = re.sub(r"[^\w\-.]", "-", title_en or "cover").strip("-") or "cover"
    return images_dir / f"_assets__{ASSET_HASH}_{safe}.jpg"


def local_exists(source_root: Path, image_url: str | None, title_en: str) -> bool:
    path = target_flat_path(source_root, image_url, title_en)
    return path.is_file() and not is_placeholder_file(path)


def wiki_api(base: str, params: dict[str, Any]) -> dict[str, Any]:
    url = base + "?" + parse.urlencode({**params, "format": "json"})
    req = request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except (error.URLError, TimeoutError, ConnectionError) as exc:
        raise error.URLError(str(exc)) from exc


def commons_file_url(file_name: str) -> str | None:
    decoded = decode_url(file_name)
    variants = {
        decoded,
        decoded.replace(" ", "_"),
        decoded.replace("_", " "),
        decoded.replace(",", "%2C"),
    }
    titles: list[str] = []
    for name in variants:
        if not name:
            continue
        titles.append(f"File:{name}")
        if " " in name:
            titles.append(f"File:{name.replace(' ', '_')}")

    for title in titles:
        try:
            data = wiki_api(
                "https://commons.wikimedia.org/w/api.php",
                {"action": "query", "titles": title, "prop": "imageinfo", "iiprop": "url"},
            )
            pages = data.get("query", {}).get("pages", {})
            for page in pages.values():
                if page.get("missing"):
                    continue
                info = (page.get("imageinfo") or [{}])[0]
                if info.get("url"):
                    return info["url"]
        except (error.URLError, OSError):
            continue
    return None


def commons_search_file(query: str) -> str | None:
    if not query:
        return None
    try:
        data = wiki_api(
            "https://commons.wikimedia.org/w/api.php",
            {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": 6,
                "srlimit": 5,
            },
        )
        for hit in data.get("query", {}).get("search", []):
            title = hit.get("title", "")
            if title.startswith("File:"):
                url = commons_file_url(title[5:])
                if url:
                    return url
    except error.URLError:
        return None
    return None


def wiki_page_image(lang: str, title: str) -> str | None:
    if not title:
        return None
    try:
        data = wiki_api(
            f"https://{lang}.wikipedia.org/w/api.php",
            {
                "action": "query",
                "titles": title,
                "prop": "pageimages",
                "piprop": "thumbnail|original",
                "pithumbsize": 2000,
                "redirects": 1,
            },
        )
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if not page.get("pageid"):
                continue
            original = page.get("original", {}).get("source")
            if original:
                return original
            thumb = page.get("thumbnail", {}).get("source")
            if thumb:
                return re.sub(r"/\d+px-", "/2000px-", thumb)
    except error.URLError:
        return None
    return None


def wiki_search_image(lang: str, query: str) -> str | None:
    if not query:
        return None
    try:
        data = wiki_api(
            f"https://{lang}.wikipedia.org/w/api.php",
            {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": 3,
            },
        )
        for hit in data.get("query", {}).get("search", []):
            url = wiki_page_image(lang, hit.get("title", ""))
            if url:
                return url
    except error.URLError:
        return None
    return None


def download_to(url: str, dest: Path, retries: int = 3) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            req = request.Request(url, headers={"User-Agent": USER_AGENT})
            with request.urlopen(req, timeout=180) as resp:
                tmp = dest.with_suffix(dest.suffix + ".part")
                with tmp.open("wb") as out:
                    shutil.copyfileobj(resp, out, length=256 * 1024)
                if tmp.stat().st_size < 500:
                    tmp.unlink(missing_ok=True)
                    raise RuntimeError("下载文件过小")
                tmp.replace(dest)
                return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            dest.with_suffix(dest.suffix + ".part").unlink(missing_ok=True)
            if attempt + 1 < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_exc or "下载失败"))


def candidate_file_names(image_url: str | None) -> list[str]:
    if not image_url:
        return []
    raw = decode_url(image_url.strip())
    names: list[str] = []
    if raw.startswith("./"):
        raw = raw[2:]
    if raw.startswith("_assets_/"):
        names.append(raw.split("/", 1)[1])
    elif raw.startswith("file://"):
        names.append(PurePosixPath(parse.urlparse(raw).path).name)
    elif "__assets__" in raw:
        names.append(raw.rsplit("__assets__", 1)[-1])
    return names


ASSET_PATH_RE = re.compile(r"^_assets_/([^/]+)/(.+)$")


@lru_cache
def load_original_asset_names() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for name in ("events.json", "events_v2.json"):
        path = DEFAULT_WSL_UNC_ROOT / "data" / name
        if not path.is_file():
            continue
        for row in json.loads(path.read_text(encoding="utf-8")):
            cn = (row.get("title_cn") or "").strip()
            raw = row.get("image_url")
            if not cn or not raw:
                continue
            decoded = decode_url(str(raw).strip())
            file_name: str | None = None
            if decoded.startswith("file://"):
                fn = PurePosixPath(parse.urlparse(decoded).path).name
                if "_assets__" in fn:
                    file_name = fn.split("_", 2)[-1]
                else:
                    file_name = fn
            else:
                relative = decoded[2:] if decoded.startswith("./") else decoded
                match = ASSET_PATH_RE.match(relative)
                if match:
                    file_name = decode_url(match.group(2))
            if file_name and not any(
                bad in file_name for bad in ("Disambig_gray", "Searchtool", "Wikisource", "Nuvola", "Flag_of_China")
            ):
                mapping[cn] = file_name
    return mapping


def title_candidates(title_en: str, title_cn: str) -> list[str]:
    seen: set[str] = set()
    items: list[str] = []
    for value in (
        title_en,
        TITLE_EN_ALIASES.get(title_cn, ""),
        title_cn,
        title_en.replace("_", " ") if title_en else "",
    ):
        value = value.strip()
        if value and value not in seen:
            seen.add(value)
            items.append(value)
    return items


def resolve_download_url(image_url: str | None, title_en: str, title_cn: str) -> str | None:
    direct = KNOWN_DIRECT_URLS.get(title_cn)
    if direct:
        return direct

    known = KNOWN_COMMONS_FILES.get(title_cn)
    if known:
        url = commons_file_url(known)
        if url:
            return url

    original = load_original_asset_names().get(title_cn)
    if original:
        url = commons_file_url(original)
        if url:
            return url
        base = original.rsplit(".", 1)[0]
        url = commons_file_url(base.replace("_", " ") + ".jpg")
        if url:
            return url

    for name in candidate_file_names(image_url):
        url = commons_file_url(name)
        if url:
            return url

    for title in title_candidates(title_en, title_cn):
        url = wiki_page_image("en", title)
        if url:
            return url

    for title in title_candidates(title_cn, title_en):
        url = wiki_page_image("zh", title)
        if url:
            return url

    for title in title_candidates(title_en, title_cn):
        url = wiki_search_image("en", title)
        if url:
            return url

    for title in title_candidates(title_cn, title_en):
        url = wiki_search_image("zh", title)
        if url:
            return url

    for title in title_candidates(title_en, title_cn):
        url = commons_search_file(title)
        if url:
            return url

    return None


def update_image_url(conn, event_id: str, local_path: Path, dry_run: bool) -> None:
    linux_path = LEGACY_LINUX_ROOT / "images" / local_path.name
    new_url = f"file://{linux_path.as_posix()}"
    if dry_run:
        return
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
    socket.setdefaulttimeout(DEFAULT_TIMEOUT)
    source_root = args.source_root
    if not source_root.exists():
        raise SystemExit(f"源图目录不存在：{source_root}")

    stats = {"skipped": 0, "downloaded": 0, "failed": 0}

    with connect_db(load_connection_string(args.connection_string)) as conn:
        exhibition_id = fetch_exhibition_id(conn, args.exhibition_slug)
        if args.refetch_placeholders:
            events = [
                row
                for row in fetch_all_events(conn, exhibition_id)
                if needs_refetch(source_root, row[3], row[2])
            ]
            safe_print(f"待重拉占位图：{len(events)} 条", flush=True)
        else:
            events = fetch_pending_events(conn, exhibition_id)
            safe_print(f"待补全：{len(events)} 条", flush=True)

        for event_id, title_cn, title_en, image_url in events:
            if local_exists(source_root, image_url, title_en):
                stats["skipped"] += 1
                if not args.dry_run and image_url and not image_url.startswith("file://"):
                    dest = target_flat_path(source_root, image_url, title_en)
                    update_image_url(conn, event_id, dest, dry_run=False)
                    conn.commit()
                    safe_print(f"[同步] {title_cn}（本地已存在，已更新 image_url）")
                else:
                    safe_print(f"[跳过] {title_cn}（本地已存在）")
                continue

            download_url = resolve_download_url(image_url, title_en, title_cn)
            dest = target_flat_path(source_root, image_url, title_en)
            existing_name = COPY_EXISTING.get(title_cn)
            if existing_name and not args.refetch_placeholders:
                src = source_root / "images" / existing_name
                if src.is_file() and not is_placeholder_file(src):
                    try:
                        if args.dry_run:
                            safe_print(f"[预览] {title_cn} <- 复制 {existing_name}")
                            stats["downloaded"] += 1
                            continue
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(src, dest)
                        update_image_url(conn, event_id, dest, dry_run=False)
                        conn.commit()
                        stats["downloaded"] += 1
                        safe_print(f"[完成] {title_cn}（复制已有图）")
                        safe_print(f"       -> {dest.name}")
                        continue
                    except Exception as exc:  # noqa: BLE001
                        conn.rollback()
                        stats["failed"] += 1
                        safe_print(f"[失败] {title_cn}：{exc}", file=sys.stderr)
                        continue

            if not download_url:
                stats["failed"] += 1
                safe_print(f"[失败] {title_cn}：未找到可下载图片", file=sys.stderr)
                continue

            try:
                if args.dry_run:
                    safe_print(f"[预览] {title_cn} <- {download_url}")
                    safe_print(f"       -> {dest}")
                    stats["downloaded"] += 1
                    continue

                download_to(download_url, dest)
                update_image_url(conn, event_id, dest, dry_run=False)
                conn.commit()
                stats["downloaded"] += 1
                safe_print(f"[完成] {title_cn} 已下载", flush=True)
                safe_print(f"       -> {dest.name}", flush=True)
            except Exception as exc:  # noqa: BLE001
                conn.rollback()
                stats["failed"] += 1
                safe_print(f"[失败] {title_cn}：{exc}", file=sys.stderr, flush=True)

            time.sleep(0.35)

    safe_print(f"完成：下载 {stats['downloaded']}，跳过 {stats['skipped']}，失败 {stats['failed']}")
    return 1 if stats["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
