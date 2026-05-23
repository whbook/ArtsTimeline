import csv
import json
import re
from pathlib import Path

CSV_PATH = Path(r"H:\下载\outcome_sjyss_all_20260523T011435Z.csv")
OUTPUT_DIR = Path(r"D:\Codes\ArtsTimeline\public\data\world-art-chronology")

KEY_ID = "id（记录ID）"
KEY_TITLE = "eventTitle（艺术事件标题）"
KEY_DETAIL = "eventDetailsNew（艺术事件详情（AI编辑的新值））"
KEY_TYPE = "eventType（艺术事件类型列表）"
KEY_PERIOD = "period（朝代与时期）"
KEY_YEAR = "gregorianYear（年）"
KEY_MONTH = "gregorianMonth（月）"
KEY_DAY = "gregorianDay（日）"
KEY_COUNTRY = "country（国家）"

INSTITUTION_KEYWORDS = ("学院", "博物馆", "展览", "出版", "撰写", "论文", "名人传", "历代名画记", "开馆")

EUROPE_COUNTRIES = {
    "法国", "意大利", "西班牙", "德国", "英国", "捷克", "荷兰", "比利时", "奥地利", "瑞士",
    "葡萄牙", "希腊", "俄罗斯", "苏联", "乌克兰", "匈牙利", "罗马尼亚", "丹麦", "瑞典", "挪威",
    "芬兰", "波兰",
}
AMERICAS_COUNTRIES = {"美国", "加拿大", "墨西哥", "巴西", "阿根廷", "秘鲁", "智利", "哥伦比亚"}
EAST_ASIA_COUNTRIES = {"中国", "日本", "韩国", "朝鲜", "蒙古"}
MIDEAST_AFRICA_COUNTRIES = {
    "埃及", "伊朗", "伊拉克", "土耳其", "叙利亚", "以色列", "沙特阿拉伯", "阿联酋",
    "埃塞俄比亚", "摩洛哥", "突尼斯", "尼日利亚", "南非",
}
SOUTH_ASIA_OCEANIA_COUNTRIES = {"印度", "巴基斯坦", "斯里兰卡", "孟加拉国", "尼泊尔", "澳大利亚", "新西兰"}

# --- 标准历史/艺术分期泳道（参考世界艺术史与中国通史分期）---
STANDARD_STREAMS = [
    {
        "id": "s_prehistoric",
        "nameEn": "Prehistoric",
        "nameCn": "史前时代",
        "lane": 0,
        "start": {"year": -50000},
        "end": {"year": -3200},
        "color": "#78716C",
        "descriptionCn": "旧石器至新石器时代：洞穴壁画、早期雕塑、岩画与史前仪式艺术。",
    },
    {
        "id": "s_ancient_world",
        "nameEn": "Ancient World",
        "nameCn": "古代世界",
        "lane": 1,
        "start": {"year": -3200},
        "end": {"year": 500},
        "color": "#B45309",
        "descriptionCn": "美索不达米亚、埃及、爱琴海、希腊罗马、早期中国青铜文明等古典古代艺术。",
    },
    {
        "id": "s_medieval_byzantine",
        "nameEn": "Medieval & Byzantine",
        "nameCn": "中世纪与拜占庭",
        "lane": 2,
        "start": {"year": 300},
        "end": {"year": 1200},
        "color": "#7C3AED",
        "descriptionCn": "早期基督教、拜占庭、罗马式艺术及中世纪盛期欧洲艺术。",
    },
    {
        "id": "s_gothic",
        "nameEn": "Gothic",
        "nameCn": "哥特式",
        "lane": 3,
        "start": {"year": 1140},
        "end": {"year": 1500},
        "color": "#4338CA",
        "descriptionCn": "盛期哥特式大教堂、雕塑与彩绘玻璃，辐射式与垂直式哥特风格。",
    },
    {
        "id": "s_cn_ancient_medieval",
        "nameEn": "China: Ancient to Tang",
        "nameCn": "中国：上古至隋唐",
        "lane": 4,
        "start": {"year": -1600},
        "end": {"year": 907},
        "color": "#DC2626",
        "descriptionCn": "商周秦汉魏晋南北朝至隋唐：青铜器、汉画像、佛教石窟与唐代书画。",
    },
    {
        "id": "s_cn_late_imperial",
        "nameEn": "China: Song to Qing",
        "nameCn": "中国：宋元明清",
        "lane": 5,
        "start": {"year": 960},
        "end": {"year": 1912},
        "color": "#EA580C",
        "descriptionCn": "五代宋元明清：文人画、院体画、瓷器、建筑与宫廷艺术。",
    },
    {
        "id": "s_renaissance",
        "nameEn": "Renaissance",
        "nameCn": "文艺复兴",
        "lane": 6,
        "start": {"year": 1300},
        "end": {"year": 1600},
        "color": "#CA8A04",
        "descriptionCn": "意大利及欧洲文艺复兴：人文主义、透视法、古典复兴与盛期大师。",
    },
    {
        "id": "s_baroque_rococo",
        "nameEn": "Baroque & Rococo",
        "nameCn": "巴洛克与洛可可",
        "lane": 7,
        "start": {"year": 1600},
        "end": {"year": 1750},
        "color": "#A16207",
        "descriptionCn": "巴洛克戏剧性与洛可可装饰风格：宫廷艺术、宗教绘画与雕塑。",
    },
    {
        "id": "s_neoclassical_romantic",
        "nameEn": "Neoclassicism & Romanticism",
        "nameCn": "新古典主义与浪漫主义",
        "lane": 8,
        "start": {"year": 1750},
        "end": {"year": 1850},
        "color": "#059669",
        "descriptionCn": "启蒙时代新古典回潮与浪漫主义情感表达：大卫、德拉克洛瓦等。",
    },
    {
        "id": "s_realism_impressionism",
        "nameEn": "Realism to Post-Impressionism",
        "nameCn": "现实主义至后印象派",
        "lane": 9,
        "start": {"year": 1850},
        "end": {"year": 1900},
        "color": "#0891B2",
        "descriptionCn": "库尔贝现实主义、巴比松画派、印象主义与后印象主义。",
    },
    {
        "id": "s_modernism",
        "nameEn": "Modernism",
        "nameCn": "现代主义",
        "lane": 10,
        "start": {"year": 1900},
        "end": {"year": 1945},
        "color": "#2563EB",
        "descriptionCn": "立体主义、表现主义、未来主义、达达与早期抽象：先锋派艺术革命。",
    },
    {
        "id": "s_east_asia_pre_modern",
        "nameEn": "East Asia: Pre-modern",
        "nameCn": "东亚：前现代",
        "lane": 11,
        "start": {"year": 538},
        "end": {"year": 1868},
        "color": "#DB2777",
        "descriptionCn": "日本飞鸟至江户、朝鲜半岛传统艺术：佛教美术、浮世绘与工艺。",
    },
    {
        "id": "s_cn_modern",
        "nameEn": "China: Modern Era",
        "nameCn": "中国：近现代",
        "lane": 12,
        "start": {"year": 1840},
        "end": {"year": 2050},
        "color": "#BE123C",
        "descriptionCn": "晚清至民国、新中国：社会变革中的中国书画、建筑与当代艺术。",
    },
    {
        "id": "s_postwar_contemporary",
        "nameEn": "Postwar & Contemporary",
        "nameCn": "战后与当代艺术",
        "lane": 13,
        "start": {"year": 1945},
        "end": {"year": 2050},
        "color": "#4F46E5",
        "descriptionCn": "抽象表现主义、波普、极简、观念艺术与全球当代实践。",
    },
    {
        "id": "s_islamic_south_asian",
        "nameEn": "Islamic & South Asian",
        "nameCn": "伊斯兰与南亚",
        "lane": 14,
        "start": {"year": 600},
        "end": {"year": 1900},
        "color": "#0D9488",
        "descriptionCn": "伊斯兰世界建筑与书法、印度莫卧儿及南亚传统艺术。",
    },
    {
        "id": "s_americas_oceania",
        "nameEn": "Americas & Oceania",
        "nameCn": "美洲与大洋洲",
        "lane": 15,
        "start": {"year": -2000},
        "end": {"year": 2050},
        "color": "#65A30D",
        "descriptionCn": "前哥伦布文明、殖民时期至现代美洲及大洋洲艺术。",
    },
]

STREAM_LABELS = {s["id"]: s["nameCn"] for s in STANDARD_STREAMS}

# 原始 period 字段 → 标准泳道 ID（精确映射）
RAW_PERIOD_MAP = {
    "未分期": None,
    "旧石器时代": "s_prehistoric",
    "旧石器时代后期": "s_prehistoric",
    "史前时期": "s_prehistoric",
    "新石器时代": "s_prehistoric",
    "红山文化": "s_prehistoric",
    "诺克文化": "s_prehistoric",
    "东山文化": "s_prehistoric",
    "古埃及": "s_ancient_world",
    "古埃及第三中间期": "s_ancient_world",
    "第十八王朝": "s_ancient_world",
    "拉格什王朝": "s_ancient_world",
    "阿卡德王朝": "s_ancient_world",
    "亚述时期": "s_ancient_world",
    "亚述帝国": "s_ancient_world",
    "早期波斯文明": "s_ancient_world",
    "伊特鲁里亚时期": "s_ancient_world",
    "埃特鲁斯坎艺术": "s_ancient_world",
    "萨珊王朝": "s_ancient_world",
    "古希腊": "s_ancient_world",
    "古希腊古风时期": "s_ancient_world",
    "古希腊古典时期": "s_ancient_world",
    "古典时期": "s_ancient_world",
    "古风时期": "s_ancient_world",
    "希腊化时期": "s_ancient_world",
    "古罗马": "s_ancient_world",
    "罗马帝国时期": "s_ancient_world",
    "古代": "s_ancient_world",
    "古代印度": "s_islamic_south_asian",
    "4世纪": "s_ancient_world",
    "商朝": "s_cn_ancient_medieval",
    "商代": "s_cn_ancient_medieval",
    "商周": "s_cn_ancient_medieval",
    "战国": "s_cn_ancient_medieval",
    "秦代": "s_cn_ancient_medieval",
    "汉代": "s_cn_ancient_medieval",
    "后汉": "s_cn_ancient_medieval",
    "西汉": "s_cn_ancient_medieval",
    "东汉": "s_cn_ancient_medieval",
    "东汉末期": "s_cn_ancient_medieval",
    "三国": "s_cn_ancient_medieval",
    "三国吴": "s_cn_ancient_medieval",
    "东吴": "s_cn_ancient_medieval",
    "西晋": "s_cn_ancient_medieval",
    "东晋": "s_cn_ancient_medieval",
    "十六国": "s_cn_ancient_medieval",
    "十六国（前秦）": "s_cn_ancient_medieval",
    "北魏": "s_cn_ancient_medieval",
    "北魏晚期": "s_cn_ancient_medieval",
    "北齐": "s_cn_ancient_medieval",
    "北周": "s_cn_ancient_medieval",
    "南朝梁": "s_cn_ancient_medieval",
    "南朝陈": "s_cn_ancient_medieval",
    "南北朝": "s_cn_ancient_medieval",
    "南北朝（梁代）": "s_cn_ancient_medieval",
    "隋": "s_cn_ancient_medieval",
    "隋朝": "s_cn_ancient_medieval",
    "隋代": "s_cn_ancient_medieval",
    "唐代": "s_cn_ancient_medieval",
    "唐": "s_cn_ancient_medieval",
    "晚唐": "s_cn_ancient_medieval",
    "高句丽": "s_cn_ancient_medieval",
    "早期佛教艺术": "s_medieval_byzantine",
    "早期基督教艺术": "s_medieval_byzantine",
    "中古时期": "s_medieval_byzantine",
    "中世纪": "s_medieval_byzantine",
    "中世纪早期": "s_medieval_byzantine",
    "中世纪晚期": "s_medieval_byzantine",
    "中世纪（伊斯兰时期）": "s_islamic_south_asian",
    "拜占庭时期": "s_medieval_byzantine",
    "拜占庭帝国": "s_medieval_byzantine",
    "罗马式": "s_medieval_byzantine",
    "罗马式时期": "s_medieval_byzantine",
    "盎格鲁-撒克逊时期": "s_medieval_byzantine",
    "加洛林时期": "s_medieval_byzantine",
    "奥托时期": "s_medieval_byzantine",
    "维金时期": "s_medieval_byzantine",
    "早期哥特式": "s_gothic",
    "早期哥特式时期": "s_gothic",
    "英国早期哥特式": "s_gothic",
    "早期英国哥特式": "s_gothic",
    "哥特式": "s_gothic",
    "哥特式时期": "s_gothic",
    "盛期哥特式": "s_gothic",
    "垂直式哥特式": "s_gothic",
    "辐射式哥特式": "s_gothic",
    "火焰式哥特式": "s_gothic",
    "后期哥特式": "s_gothic",
    "德国哥特式": "s_gothic",
    "罗马式-哥特式过渡": "s_gothic",
    "北宋": "s_cn_late_imperial",
    "南宋": "s_cn_late_imperial",
    "宋代": "s_cn_late_imperial",
    "宋": "s_cn_late_imperial",
    "五代": "s_cn_late_imperial",
    "五代十国": "s_cn_late_imperial",
    "五代/北宋": "s_cn_late_imperial",
    "南唐": "s_cn_late_imperial",
    "辽": "s_cn_late_imperial",
    "辽代": "s_cn_late_imperial",
    "金代": "s_cn_late_imperial",
    "元代": "s_cn_late_imperial",
    "元": "s_cn_late_imperial",
    "明代": "s_cn_late_imperial",
    "明": "s_cn_late_imperial",
    "清代": "s_cn_late_imperial",
    "清": "s_cn_late_imperial",
    "清代晚期": "s_cn_late_imperial",
    "明清之际": "s_cn_late_imperial",
    "文艺复兴": "s_renaissance",
    "文艺复兴时期": "s_renaissance",
    "文艺复兴早期": "s_renaissance",
    "文艺复兴初期": "s_renaissance",
    "文艺复兴盛期": "s_renaissance",
    "文艺复兴后期": "s_renaissance",
    "文艺复兴晚期": "s_renaissance",
    "英国文艺复兴": "s_renaissance",
    "15世纪": "s_renaissance",
    "16世纪": "s_renaissance",
    "16世纪早期": "s_renaissance",
    "巴洛克": "s_baroque_rococo",
    "巴洛克时期": "s_baroque_rococo",
    "巴罗克时期": "s_baroque_rococo",
    "巴洛克早期": "s_baroque_rococo",
    "英国巴洛克": "s_baroque_rococo",
    "法国巴洛克": "s_baroque_rococo",
    "洛可可": "s_baroque_rococo",
    "洛可可时期": "s_baroque_rococo",
    "17世纪": "s_baroque_rococo",
    "18世纪": "s_neoclassical_romantic",
    "十八世纪": "s_neoclassical_romantic",
    "18世纪末": "s_neoclassical_romantic",
    "18世纪德国": "s_neoclassical_romantic",
    "18世纪荷兰": "s_neoclassical_romantic",
    "启蒙运动时期": "s_neoclassical_romantic",
    "启蒙时代": "s_neoclassical_romantic",
    "新古典主义": "s_neoclassical_romantic",
    "新古典主义时期": "s_neoclassical_romantic",
    "浪漫主义": "s_neoclassical_romantic",
    "浪漫主义时期": "s_neoclassical_romantic",
    "浪漫主义初期": "s_neoclassical_romantic",
    "维多利亚时期": "s_neoclassical_romantic",
    "维多利亚时代": "s_neoclassical_romantic",
    "英国乔治王朝": "s_neoclassical_romantic",
    "路易十四时期": "s_neoclassical_romantic",
    "法国大革命时期": "s_neoclassical_romantic",
    "法兰西第一帝国": "s_neoclassical_romantic",
    "法兰西第二帝国": "s_neoclassical_romantic",
    "绝对主义": "s_baroque_rococo",
    "荷兰黄金时代": "s_baroque_rococo",
    "19世纪": "s_realism_impressionism",
    "19世纪初": "s_neoclassical_romantic",
    "19世纪中期": "s_realism_impressionism",
    "19世纪末": "s_realism_impressionism",
    "现实主义": "s_realism_impressionism",
    "印象主义": "s_realism_impressionism",
    "印象主义时期": "s_realism_impressionism",
    "后印象派": "s_realism_impressionism",
    "后印象主义": "s_realism_impressionism",
    "新印象主义": "s_realism_impressionism",
    "近代": "s_realism_impressionism",
    "20世纪": "s_modernism",
    "二十世纪": "s_modernism",
    "20世纪初": "s_modernism",
    "20世纪早期": "s_modernism",
    "20世纪初期": "s_modernism",
    "20世纪20年代": "s_modernism",
    "20世纪30年代": "s_modernism",
    "20世纪40年代": "s_modernism",
    "1930年代": "s_modernism",
    "20世纪50年代": "s_modernism",
    "20世纪50-60年代": "s_modernism",
    "20世纪60年代": "s_modernism",
    "20世纪中期": "s_modernism",
    "现代主义": "s_modernism",
    "现代主义时期": "s_modernism",
    "现代主义建筑": "s_modernism",
    "现代艺术": "s_modernism",
    "现代": "s_modernism",
    "立体主义": "s_modernism",
    "表现主义": "s_modernism",
    "表现主义时期": "s_modernism",
    "未来主义": "s_modernism",
    "达达主义": "s_modernism",
    "风格派": "s_modernism",
    "新造型主义": "s_modernism",
    "综合主义": "s_modernism",
    "涡漩主义": "s_modernism",
    "装饰艺术时期": "s_modernism",
    "矫饰主义": "s_renaissance",
    "曼努埃尔时期": "s_renaissance",
    "几何风格时期": "s_ancient_world",
    "东方化时期": "s_ancient_world",
    "飞鸟时代": "s_east_asia_pre_modern",
    "平安时代": "s_east_asia_pre_modern",
    "江户时代": "s_east_asia_pre_modern",
    "江户时期": "s_east_asia_pre_modern",
    "昭和时代": "s_east_asia_pre_modern",
    "明治时期": "s_east_asia_pre_modern",
    "民国": "s_cn_modern",
    "民国时期": "s_cn_modern",
    "中华民国": "s_cn_modern",
    "晚清": "s_cn_modern",
    "清末": "s_cn_modern",
    "解放战争时期": "s_cn_modern",
    "抗日战争时期": "s_cn_modern",
    "中华人民共和国": "s_cn_modern",
    "新中国": "s_cn_modern",
    "当代中国": "s_cn_modern",
    "战后": "s_postwar_contemporary",
    "战时": "s_postwar_contemporary",
    "第二次世界大战": "s_postwar_contemporary",
    "20世纪70年代": "s_postwar_contemporary",
    "20世纪80年代": "s_postwar_contemporary",
    "20世纪晚期": "s_postwar_contemporary",
    "当代": "s_postwar_contemporary",
    "当代艺术": "s_postwar_contemporary",
    "21世纪": "s_postwar_contemporary",
    "抽象表现主义": "s_postwar_contemporary",
    "波普艺术": "s_postwar_contemporary",
    "极少主义": "s_postwar_contemporary",
    "极简主义": "s_postwar_contemporary",
    "后现代主义": "s_postwar_contemporary",
    "后现代主义/解构主义": "s_postwar_contemporary",
    "伊斯兰时期": "s_islamic_south_asian",
    "伊斯兰时期（倭马亚王朝）": "s_islamic_south_asian",
    "伊斯兰时期（奈斯尔王朝）": "s_islamic_south_asian",
    "奥斯曼帝国": "s_islamic_south_asian",
    "奥斯曼帝国时期": "s_islamic_south_asian",
    "萨非王朝": "s_islamic_south_asian",
    "莫卧儿王朝": "s_islamic_south_asian",
    "马穆鲁克王朝": "s_islamic_south_asian",
    "拉施德拉古特王朝时期": "s_islamic_south_asian",
    "夏连特拉王朝": "s_islamic_south_asian",
    "高棉帝国": "s_islamic_south_asian",
    "殖民时期": "s_americas_oceania",
    "阿兹特克时期": "s_americas_oceania",
    "波利尼西亚时期": "s_americas_oceania",
    "纳粹时期": "s_modernism",
    "法西斯时期": "s_modernism",
    "苏维埃时期": "s_modernism",
    "苏联时期": "s_modernism",
    "魏玛共和国": "s_modernism",
    "天主教国王时期": "s_baroque_rococo",
    "14世纪": "s_medieval_byzantine",
    "16世纪俄国": "s_renaissance",
    "简约时期": "s_modernism",
    "古堡文化": "s_medieval_byzantine",
    "理性主义": "s_neoclassical_romantic",
    "中形成期": "s_ancient_world",
    "爱琴文明时期": "s_ancient_world",
}

# 关键词兜底（按优先级排列，先匹配更具体的流派/分期）
PERIOD_KEYWORD_RULES = [
    (("旧石器", "新石器", "史前", "红山", "诺克", "东山"), "s_prehistoric"),
    (("古埃及", "亚述", "阿卡德", "拉格什", "第十八王朝", "爱琴", "希腊化", "古风", "古典时期", "伊特鲁里亚", "埃特鲁斯坎", "萨珊", "古罗马", "罗马帝国"), "s_ancient_world"),
    (("古希腊", "希腊"), "s_ancient_world"),
    (("商", "周", "秦", "汉", "三国", "晋", "南北朝", "北魏", "北齐", "北周", "南朝", "隋", "唐", "高句丽", "十六国"), "s_cn_ancient_medieval"),
    (("宋", "辽", "金", "元", "明", "清", "五代", "南唐", "帝制", "明清"), "s_cn_late_imperial"),
    (("民国", "中华", "新中国", "中华人民共和国", "当代中", "晚清", "清末", "抗日", "解放"), "s_cn_modern"),
    (("拜占庭", "罗马式", "加洛林", "奥托", "盎格鲁", "维金", "早期基督教", "中古", "中世纪"), "s_medieval_byzantine"),
    (("哥特",), "s_gothic"),
    (("文艺复兴", "矫饰", "曼努埃尔"), "s_renaissance"),
    (("巴洛克", "巴罗克", "洛可可", "路易十四", "荷兰黄金", "绝对主义", "天主教国王"), "s_baroque_rococo"),
    (("启蒙", "新古典", "浪漫", "维多利亚", "乔治", "大革命", "法兰西", "绝对主义", "理性主义"), "s_neoclassical_romantic"),
    (("现实主义", "印象", "后印象", "新印象", "巴比松"), "s_realism_impressionism"),
    (("立体", "表现主义", "未来主义", "达达", "风格派", "装饰艺术", "魏玛", "纳粹", "法西斯", "苏维埃", "苏联", "现代主义", "综合主义", "涡漩"), "s_modernism"),
    (("20世纪", "二十世纪", "现代艺术", "现代"), "s_modernism"),
    (("19世纪", "19世"), "s_realism_impressionism"),
    (("18世纪", "十八世纪", "17世纪", "15世纪", "16世纪", "14世纪"), "s_neoclassical_romantic"),
    (("飞鸟", "平安", "江户", "昭和", "明治", "朝鲜", "韩国"), "s_east_asia_pre_modern"),
    (("战后", "当代", "21世纪", "抽象表现", "波普", "极少", "极简", "后现代", "解构"), "s_postwar_contemporary"),
    (("伊斯兰", "奥斯曼", "莫卧儿", "马穆鲁克", "萨非", "印度", "高棉", "南亚"), "s_islamic_south_asian"),
    (("殖民", "阿兹特克", "波利尼西亚", "美洲", "大洋洲", "墨西哥", "秘鲁"), "s_americas_oceania"),
]

CATEGORY_LABELS = {
    "architecture": "建筑",
    "sculpture": "雕塑",
    "painting_design": "绘画与设计",
    "text_historiography": "出版与艺术史写作",
    "institution_exhibition": "制度与展览",
    "archaeology": "考古与发现",
    "other": "其他",
}

EVENT_TYPE_MAP = {
    "建筑": "architecture",
    "雕塑": "sculpture",
    "绘画": "painting_design",
    "设计": "painting_design",
    "摄影": "painting_design",
    "出版": "text_historiography",
    "展览": "institution_exhibition",
    "交易": "institution_exhibition",
    "其他": "other",
}

FALLBACK_CATEGORY_RULES = [
    (("建造", "动工", "重建", "修建", "教堂", "大教堂", "礼拜堂"), "architecture"),
    (("雕塑", "雕刻", "石像", "铜像", "塑像"), "sculpture"),
    (("绘制", "绘画", "创作", "拍摄", "设计", "挂毯", "插图"), "painting_design"),
    (("出版", "撰写", "译", "论文", "手册", "名画记", "名人传"), "text_historiography"),
    (("成立", "建立", "开馆", "展出", "策划展览"), "institution_exhibition"),
    (("发掘", "发现", "出土"), "archaeology"),
]

MILESTONE_KEYWORDS = (
    "巴黎圣母院", "雅典学院", "卢浮宫", "历代名画记", "三星堆", "妇好墓", "曾侯乙墓",
    "阿维尼翁少女", "名人传第一版", "古根海姆博物馆", "大卫像", "清明上河图"
)


def parse_optional_int(raw: str):
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def split_types(raw_type: str):
    raw_type = (raw_type or "").strip()
    if not raw_type:
        return []
    parts = re.split(r"[，,、;/]+", raw_type)
    return [p.strip() for p in parts if p.strip()]


def get_period_id(year: int) -> str:
    if year < -3000:
        return "p_prehistoric"
    if year < 500:
        return "p_ancient_classical"
    if year < 1400:
        return "p_medieval"
    if year < 1800:
        return "p_early_modern"
    if year < 1945:
        return "p_modern"
    return "p_contemporary"


def get_category(event_types, full_text: str) -> str:
    for t in event_types:
        if t in EVENT_TYPE_MAP:
            return EVENT_TYPE_MAP[t]
    for keywords, category in FALLBACK_CATEGORY_RULES:
        if any(k in full_text for k in keywords):
            return category
    return "other"


def get_stream_id_by_year(year: int, country: str) -> str:
    """未分期事件：按公历年份与国家推断标准泳道。"""
    if country == "中国":
        if year < 907:
            return "s_cn_ancient_medieval"
        if year < 1912:
            return "s_cn_late_imperial"
        return "s_cn_modern"

    if country in {"日本", "韩国", "朝鲜"}:
        if year < 1868:
            return "s_east_asia_pre_modern"
        if year < 1945:
            return "s_modernism"
        return "s_postwar_contemporary"

    if country in AMERICAS_COUNTRIES or country in {"澳大利亚", "新西兰"}:
        if year < 1492:
            return "s_americas_oceania"
        if year < 1945:
            if year < 1900:
                return "s_realism_impressionism"
            return "s_modernism"
        return "s_postwar_contemporary"

    if country in SOUTH_ASIA_OCEANIA_COUNTRIES or country in MIDEAST_AFRICA_COUNTRIES:
        if year < 600:
            return "s_ancient_world"
        if year < 1900:
            return "s_islamic_south_asian"
        if year < 1945:
            return "s_modernism"
        return "s_postwar_contemporary"

    # 欧洲及默认：西方艺术史分期
    if year < -3200:
        return "s_prehistoric"
    if year < 500:
        return "s_ancient_world"
    if year < 1140:
        return "s_medieval_byzantine"
    if year < 1300:
        return "s_gothic"
    if year < 1600:
        return "s_renaissance"
    if year < 1750:
        return "s_baroque_rococo"
    if year < 1850:
        return "s_neoclassical_romantic"
    if year < 1900:
        return "s_realism_impressionism"
    if year < 1945:
        return "s_modernism"
    return "s_postwar_contemporary"


def map_period_to_stream(period_raw: str, year: int, country: str) -> str:
    period_raw = (period_raw or "").strip() or "未分期"

    if period_raw in RAW_PERIOD_MAP:
        mapped = RAW_PERIOD_MAP[period_raw]
        if mapped:
            return mapped

    for keywords, stream_id in PERIOD_KEYWORD_RULES:
        if any(k in period_raw for k in keywords):
            return stream_id

    return get_stream_id_by_year(year, country)


def get_importance(title: str, category: str, country: str, period_raw: str) -> int:
    if any(k in title for k in MILESTONE_KEYWORDS):
        return 1
    if category in {"text_historiography", "institution_exhibition", "archaeology"}:
        return 2
    if country == "未标注" and period_raw == "未分期":
        return 5
    if category == "other":
        return 4
    return 3


def build_topic():
    return {
        "id": "world-art-chronology",
        "titleEn": "World Art Chronology",
        "titleCn": "世界艺术编年史",
        "description": "Global art chronology organized by standard historical and art-historical periods. / 按标准历史与艺术史分期组织的世界艺术编年史。",
        "color": "#1F8A70",
        "defaultViewport": {"startYear": -3000, "endYear": 2025},
        "minZoomRange": 1,
        "maxZoomRange": 30000,
        "playbackSpeed": 2.0,
        "chunked": True,
        "eventFields": [
            {"key": "country", "labelEn": "Country", "labelCn": "国家", "type": "text"},
            {"key": "originalPeriod", "labelEn": "Original Period", "labelCn": "原始时期", "type": "text"},
            {"key": "standardPeriod", "labelEn": "Standard Period", "labelCn": "标准分期", "type": "text"},
            {"key": "eventTypeRaw", "labelEn": "Original Types", "labelCn": "原始类型", "type": "text"},
            {"key": "eventCategory", "labelEn": "Category", "labelCn": "归一类别", "type": "text"},
        ],
    }


def build_periods():
    return [
        {
            "id": "p_prehistoric",
            "nameEn": "Prehistoric & Early Civilizations",
            "nameCn": "史前与早期文明",
            "colorHex": "#5E548E",
            "colorBackground": "#f2eff9",
            "start": {"year": -30000},
            "end": {"year": -3001},
        },
        {
            "id": "p_ancient_classical",
            "nameEn": "Ancient & Classical",
            "nameCn": "古代与古典时期",
            "colorHex": "#4C78A8",
            "colorBackground": "#edf3fb",
            "start": {"year": -3000},
            "end": {"year": 499},
        },
        {
            "id": "p_medieval",
            "nameEn": "Medieval",
            "nameCn": "中世纪",
            "colorHex": "#B279A2",
            "colorBackground": "#f8eef6",
            "start": {"year": 500},
            "end": {"year": 1399},
        },
        {
            "id": "p_early_modern",
            "nameEn": "Early Modern",
            "nameCn": "近代早期",
            "colorHex": "#F58518",
            "colorBackground": "#fff4e9",
            "start": {"year": 1400},
            "end": {"year": 1799},
        },
        {
            "id": "p_modern",
            "nameEn": "Modern",
            "nameCn": "现代",
            "colorHex": "#54A24B",
            "colorBackground": "#eef9ee",
            "start": {"year": 1800},
            "end": {"year": 1944},
        },
        {
            "id": "p_contemporary",
            "nameEn": "Contemporary",
            "nameCn": "当代",
            "colorHex": "#E45756",
            "colorBackground": "#fff0f0",
            "start": {"year": 1945},
            "end": {"year": 2050},
        },
    ]


def build_streams():
    return STANDARD_STREAMS


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
    events = []

    for row in rows:
        title = (row.get(KEY_TITLE) or "").strip()
        detail = (row.get(KEY_DETAIL) or "").strip()
        country = (row.get(KEY_COUNTRY) or "").strip() or "未标注"
        period_raw = (row.get(KEY_PERIOD) or "").strip() or "未分期"
        event_types = split_types(row.get(KEY_TYPE) or "")
        event_type_raw = "、".join(event_types) if event_types else "未标注"

        year = int((row.get(KEY_YEAR) or "").strip())
        month = parse_optional_int(row.get(KEY_MONTH) or "")
        day = parse_optional_int(row.get(KEY_DAY) or "")

        full_text = f"{title} {detail}"
        category = get_category(event_types, full_text)
        stream_id = map_period_to_stream(period_raw, year, country)
        standard_period = STREAM_LABELS.get(stream_id, stream_id)
        period_id = get_period_id(year)
        importance = get_importance(title, category, country, period_raw)

        date_obj = {"year": year}
        if month and 1 <= month <= 12:
            date_obj["month"] = month
        if day and 1 <= day <= 31:
            date_obj["day"] = day
        if re.search(r"约|大约|约公元前|以前|左右|之间", full_text):
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
                "tags": event_types,
                "meta": {
                    "country": country,
                    "originalPeriod": period_raw,
                    "standardPeriod": standard_period,
                    "eventTypeRaw": event_type_raw,
                    "eventCategory": CATEGORY_LABELS.get(category, "其他"),
                },
            }
        )

    events.sort(key=lambda x: (x["date"]["year"], x["titleCn"]))

    (OUTPUT_DIR / "topic.json").write_text(json.dumps(build_topic(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "periods.json").write_text(json.dumps(build_periods(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "streams.json").write_text(json.dumps(build_streams(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_DIR / "events.json").write_text(json.dumps(events, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Generate Chunks for Lazy Loading
    chunks_dir = OUTPUT_DIR / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    ranges = [
        (-100000, 499),
        (500, 999),
        (1000, 1399),
        (1400, 1499),
        (1500, 1599),
        (1600, 1699),
        (1700, 1799),
        (1800, 1849),
        (1850, 1899),
        (1900, 1944),
        (1945, 1969),
        (1970, 1989),
        (1990, 3000)
    ]

    manifest_chunks = []
    for start, end in ranges:
        chunk_events = [e for e in events if start <= e["date"]["year"] <= end]
        if chunk_events:
            file_name = f"chunks/events_chunk_{start}_{end}.json"
            (OUTPUT_DIR / file_name).write_text(json.dumps(chunk_events, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            manifest_chunks.append({
                "start": start,
                "end": end,
                "file": file_name,
                "count": len(chunk_events)
            })

    manifest = {
        "topicId": "world-art-chronology",
        "chunks": manifest_chunks
    }
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Generated {len(events)} events in {OUTPUT_DIR} across {len(manifest_chunks)} chunks.")

    from collections import Counter
    stream_counts = Counter(e["streamId"] for e in events)
    print("\nStandard stream distribution:")
    for sid, count in stream_counts.most_common():
        print(f"  {STREAM_LABELS.get(sid, sid):20s} {count:4d}")

    unclassified = sum(1 for r in rows if (r.get(KEY_PERIOD) or "").strip() in ("", "未分期"))
    print(f"\nUnclassified raw period rows: {unclassified} (assigned via year/country fallback)")


if __name__ == "__main__":
    main()
