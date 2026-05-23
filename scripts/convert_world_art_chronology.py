import csv
import json
import re
from pathlib import Path


CSV_PATH = Path(r"H:\下载\outcome_sjyss_top100_20260523T003259Z.csv")
OUTPUT_DIR = Path(r"D:\Codes\ArtsTimeline\public\data\world-art-chronology")

KEY_ID = "id（记录ID）"
KEY_TITLE = "eventTitle（艺术事件标题）"
KEY_DETAIL = "eventDetailsNew（艺术事件详情（AI编辑的新值））"
KEY_PERIOD = "period（朝代与时期）"
KEY_YEAR = "gregorianYear（年）"
KEY_MONTH = "gregorianMonth（月）"
KEY_DAY = "gregorianDay（日）"
KEY_COUNTRY = "country（国家）"

EUROPE_COUNTRIES = {"法国", "意大利", "西班牙", "德国", "奥地利", "捷克", "荷兰"}

INSTITUTION_KEYWORDS = ("学院", "博物馆", "展览", "出版", "撰写", "论文", "名人传", "历代名画记")

CATEGORY_RULES = [
    (("建造", "动工", "重建", "修建", "教堂", "大教堂", "礼拜堂"), "architecture"),
    (("出版", "撰写", "译", "论文", "手册", "名画记"), "text_historiography"),
    (("成立", "建立", "开馆", "展出", "策划展览"), "institution_exhibition"),
    (("创作", "绘制", "雕刻", "制作", "作品", "雕像", "挂毯"), "artwork"),
    (("发掘", "发现", "出土"), "archaeology"),
]

MILESTONE_KEYWORDS = (
    "巴黎圣母院",
    "雅典学院",
    "卢浮宫",
    "历代名画记",
    "三星堆祭祀坑",
    "妇好墓",
    "曾侯乙墓",
    "阿维尼翁少女",
    "名人传第一版",
)

IMPORTANCE_NOTE = {
    1: "跨时代里程碑：教材级，改变艺术史叙事或方法。",
    2: "高影响节点：区域关键转折，长期影响明显。",
    3: "标准事件：主题内重要但非拐点。",
    4: "补充事件：信息价值高但影响范围有限。",
    5: "长尾记录：仅在高倍放大时显示。",
}


def get_period_id(year: int) -> str:
    if year <= 500:
        return "p_ancient_early_china"
    if year < 1140:
        return "p_roman_medieval"
    if year < 1450:
        return "p_gothic_late_medieval"
    if year < 1800:
        return "p_renaissance_academy"
    return "p_modern_contemporary"


def get_category(text: str) -> str:
    if "名画记" in text or "名人传" in text:
        return "text_historiography"
    for keywords, category in CATEGORY_RULES:
        if any(k in text for k in keywords):
            return category
    return "other"


def get_stream_id(title: str, detail: str, country: str) -> str:
    full_text = f"{title} {detail}"
    if any(k in full_text for k in INSTITUTION_KEYWORDS):
        return "s_institutions_historiography"
    if country == "英国":
        return "s_uk_nordic"
    if country == "美国":
        return "s_us_modern"
    if country == "中国":
        return "s_china_artifacts"
    if country in EUROPE_COUNTRIES:
        return "s_europe_continent"
    return "s_institutions_historiography"


def get_importance(title: str, category: str, country: str, period_raw: str) -> int:
    if any(k in title for k in MILESTONE_KEYWORDS):
        return 1
    if category in {"institution_exhibition", "text_historiography", "archaeology"}:
        return 2
    if category in {"architecture", "other"}:
        return 4
    if country == "未标注" and period_raw == "未分期":
        return 5
    return 3


def build_topic():
    return {
        "id": "world-art-chronology",
        "titleEn": "World Art Chronology",
        "titleCn": "世界艺术编年史",
        "description": "A global timeline focused on art events, institutions, historiography, and archaeology. / 聚焦艺术事件、艺术制度、艺术史写作与考古发现的全球编年时间轴。",
        "color": "#1F8A70",
        "defaultViewport": {"startYear": -500, "endYear": 2050},
        "minZoomRange": 1,
        "maxZoomRange": 8000,
        "playbackSpeed": 1.5,
        "eventFields": [
            {"key": "country", "labelEn": "Country", "labelCn": "国家", "type": "text"},
            {"key": "originalPeriod", "labelEn": "Original Period", "labelCn": "原始时期", "type": "text"},
            {"key": "eventCategory", "labelEn": "Event Category", "labelCn": "事件类别", "type": "text"},
            {"key": "importanceNote", "labelEn": "Importance", "labelCn": "重要性说明", "type": "text"},
        ],
    }


def build_periods():
    return [
        {
            "id": "p_ancient_early_china",
            "nameEn": "Ancient & Early Chinese Traditions",
            "nameCn": "古代与早期中国传统",
            "colorHex": "#6C5B7B",
            "colorBackground": "#f6f2fa",
            "start": {"year": -5000},
            "end": {"year": 500},
        },
        {
            "id": "p_roman_medieval",
            "nameEn": "Romanesque & Early Medieval",
            "nameCn": "罗马式与早期中世纪",
            "colorHex": "#355C7D",
            "colorBackground": "#eef4fa",
            "start": {"year": 500},
            "end": {"year": 1139},
        },
        {
            "id": "p_gothic_late_medieval",
            "nameEn": "Gothic & Late Medieval",
            "nameCn": "哥特式与晚期中世纪",
            "colorHex": "#C06C84",
            "colorBackground": "#fdf1f5",
            "start": {"year": 1140},
            "end": {"year": 1449},
        },
        {
            "id": "p_renaissance_academy",
            "nameEn": "Renaissance & Academy Formation",
            "nameCn": "文艺复兴与学院化",
            "colorHex": "#F67280",
            "colorBackground": "#fff1f3",
            "start": {"year": 1450},
            "end": {"year": 1799},
        },
        {
            "id": "p_modern_contemporary",
            "nameEn": "Modern & Contemporary Art Systems",
            "nameCn": "现代与当代艺术体系",
            "colorHex": "#2A9D8F",
            "colorBackground": "#edf8f6",
            "start": {"year": 1800},
            "end": {"year": 2050},
        },
    ]


def build_streams():
    return [
        {
            "id": "s_europe_continent",
            "nameEn": "Continental Europe",
            "nameCn": "欧洲大陆",
            "color": "#7F5539",
            "lane": 0,
            "start": {"year": -500},
            "end": {"year": 2050},
            "descriptionCn": "法国、意大利、西班牙、德国等欧洲大陆艺术事件。",
        },
        {
            "id": "s_uk_nordic",
            "nameEn": "United Kingdom & Nordic",
            "nameCn": "英国与北欧",
            "color": "#3A86FF",
            "lane": 1,
            "start": {"year": -500},
            "end": {"year": 2050},
            "descriptionCn": "以英国为主的艺术与建筑发展线索。",
        },
        {
            "id": "s_us_modern",
            "nameEn": "United States Modern Art",
            "nameCn": "美国现代艺术",
            "color": "#8338EC",
            "lane": 2,
            "start": {"year": 1700},
            "end": {"year": 2050},
            "descriptionCn": "美国近现代艺术、展览制度与公共艺术节点。",
        },
        {
            "id": "s_china_artifacts",
            "nameEn": "Chinese Art & Archaeology",
            "nameCn": "中国艺术与考古",
            "color": "#E76F51",
            "lane": 3,
            "start": {"year": -1000},
            "end": {"year": 2050},
            "descriptionCn": "中国文物、书画史与考古发现相关事件。",
        },
        {
            "id": "s_institutions_historiography",
            "nameEn": "Institutions & Historiography",
            "nameCn": "艺术制度与史学写作",
            "color": "#2A9D8F",
            "lane": 4,
            "start": {"year": -500},
            "end": {"year": 2050},
            "descriptionCn": "跨国的学院、博物馆、展览与艺术史写作事件。",
        },
    ]


def parse_optional_int(raw: str):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
    events = []

    for row in rows:
        title = (row.get(KEY_TITLE) or "").strip()
        detail = (row.get(KEY_DETAIL) or "").strip()
        country = (row.get(KEY_COUNTRY) or "").strip() or "未标注"
        period_raw = (row.get(KEY_PERIOD) or "").strip() or "未分期"
        year = int((row.get(KEY_YEAR) or "").strip())
        month = parse_optional_int(row.get(KEY_MONTH) or "")
        day = parse_optional_int(row.get(KEY_DAY) or "")

        full_text = f"{title} {detail}"
        category = get_category(full_text)
        stream_id = get_stream_id(title, detail, country)
        period_id = get_period_id(year)
        importance = get_importance(title, category, country, period_raw)

        date_obj = {"year": year}
        if month and 1 <= month <= 12:
            date_obj["month"] = month
        if day and 1 <= day <= 31:
            date_obj["day"] = day
        if re.search(r"约|大约|约公元前|以前", full_text):
            date_obj["accuracy"] = "approximate"

        events.append(
            {
                "id": (row.get(KEY_ID) or "").strip(),
                "periodId": period_id,
                "streamId": stream_id,
                "titleEn": title,
                "titleCn": title,
                "date": date_obj,
                "descriptionCn": detail,
                "importance": importance,
                "meta": {
                    "country": country,
                    "originalPeriod": period_raw,
                    "eventCategory": category,
                    "importanceNote": IMPORTANCE_NOTE[importance],
                },
            }
        )

    events.sort(key=lambda x: (x["date"]["year"], x["titleCn"]))

    (OUTPUT_DIR / "topic.json").write_text(
        json.dumps(build_topic(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT_DIR / "periods.json").write_text(
        json.dumps(build_periods(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT_DIR / "streams.json").write_text(
        json.dumps(build_streams(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT_DIR / "events.json").write_text(
        json.dumps(events, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Generated {len(events)} events in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
