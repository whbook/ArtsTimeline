import { ArtMovement, EraColumn } from './types';

export const INITIAL_VIEWPORT = {
  startYear: -4000, 
  endYear: 2050
};

// Allow zooming down to ~1 day (1/365 ≈ 0.0027)
export const MIN_ZOOM_RANGE = 0.003; 
export const MAX_ZOOM_RANGE = 50000; 

// Professional Art History Palette
const PALETTE = {
  PREHISTORIC: '#8B4513',   // SaddleBrown - Earthy
  ANCIENT_NEAR_EAST: '#D2691E', // Chocolate - Clay/Brick
  EGYPT: '#DAA520',         // Goldenrod - Gold/Sand
  GREEK: '#556B2F',         // DarkOliveGreen - Olive/Nature
  ROMAN: '#8FBC8F',         // DarkSeaGreen - Marble/Order
  BYZANTINE: '#4682B4',     // SteelBlue - Mosaics/Sky
  MEDIEVAL: '#483D8B',      // DarkSlateBlue - Royal/Religious
  RENAISSANCE: '#800080',   // Purple - Rebirth/Nobility
  BAROQUE: '#8B0000',       // DarkRed - Drama/Emotion
  NEOCLASSICAL: '#708090',  // SlateGray - Reason/Stone
  ROMANTICISM: '#C71585',   // MediumVioletRed - Passion
  REALISM: '#A0522D',       // Sienna - Earth/Reality
  MODERN: '#FF4500',        // OrangeRed - Radical/Bold
  CONTEMPORARY: '#C71585',  // MediumVioletRed - Diverse
};

export const ERAS: EraColumn[] = [
  {
    id: 'pre_ancient',
    title: 'Prehistoric & Ancient / 史前与上古',
    colorHeader: 'bg-stone-700',
    colorHex: PALETTE.PREHISTORIC,
    colorBackground: '#fcfaf9',
    borderColor: 'border-stone-300',
    startYear: -40000,
    endYear: -800,
    events: [
      { id: 101, year: -24000, label: 'Venus of Willendorf / 维伦多夫维纳斯', artist: 'Unknown', description: 'Oolitic limestone figurine. Symbol of fertility. \n 舊石器時代的女性雕像，象徵多產与生命。' },
      { id: 102, year: -17000, label: 'Lascaux Hall of Bulls / 拉斯科公牛大厅', artist: 'Paleolithic Humans', description: 'Magdalenian cave paintings. \n 马格德林时期的岩洞壁画杰作。' },
      { id: 103, year: -2500, label: 'Great Sphinx / 狮身人面像', artist: 'Old Kingdom Egypt', description: 'Limestone statue of a reclining sphinx. \n 古埃及第四王朝的巨型石灰岩雕像。' },
      { id: 104, year: -1754, label: 'Code of Hammurabi / 汉谟拉比法典', artist: 'Babylonian', description: 'Basalt stele with laws. \n 刻在黑色玄武岩柱上的巴比伦法律条文。' },
      { id: 105, year: -1323, label: 'Mask of Tutankhamun / 图坦卡蒙金面具', artist: 'New Kingdom Egypt', description: 'Gold death mask. \n 古埃及新王国时期的黄金陪葬面具。' }
    ]
  },
  {
    id: 'classical',
    title: 'Classical World / 古典文明',
    colorHeader: 'bg-green-700',
    colorHex: PALETTE.GREEK,
    colorBackground: '#f4fbf4',
    borderColor: 'border-green-300',
    startYear: -800,
    endYear: 400,
    events: [
      { id: 201, year: -450, label: 'Discobolus / 掷铁饼者', artist: 'Myron / 米隆', description: 'Classical Greek sculpture depicting athletic motion. \n 希腊古典时期表现运动张力的雕塑杰作。' },
      { id: 202, year: -432, label: 'Parthenon Sculptures / 帕特农神庙雕塑', artist: 'Phidias / 菲迪亚斯', description: 'Elgin Marbles, high classical style. \n 雅典卫城的巅峰之作，埃尔金大理石雕。' },
      { id: 203, year: -190, label: 'Winged Victory / 萨莫色雷斯胜利女神', artist: 'Hellenistic / 希腊化', description: 'Masterpiece of movement and emotion. \n 卢浮宫镇馆之宝，表现海风吹拂下的动态。' },
      { id: 204, year: -130, label: 'Venus de Milo / 断臂维纳斯', artist: 'Alexandros / 亚历山德罗斯', description: 'Standard of female beauty. \n 希腊化时期女性美的典范。' },
      { id: 205, year: 113, label: 'Trajan\'s Column / 图拉真柱', artist: 'Roman Imperial', description: 'Continuous narrative relief. \n 罗马帝国连续叙事浮雕的代表。' }
    ]
  },
  {
    id: 'medieval',
    title: 'Middle Ages / 中世纪',
    colorHeader: 'bg-indigo-800',
    colorHex: PALETTE.MEDIEVAL,
    colorBackground: '#f0f0f8',
    borderColor: 'border-indigo-300',
    startYear: 400,
    endYear: 1400,
    events: [
      { id: 301, year: 537, label: 'Hagia Sophia / 圣索菲亚大教堂', artist: 'Isidore & Anthemius', description: 'Byzantine architectural marvel. \n 拜占庭建筑奇迹，巨大的穹顶。' },
      { id: 302, year: 800, label: 'Book of Kells / 凯尔经', artist: 'Celtic Monks', description: 'Illuminated manuscript. \n 爱尔兰岛屿风格手抄本巅峰。' },
      { id: 303, year: 1305, label: 'Lamentation / 哀悼基督', artist: 'Giotto / 乔托', description: 'Early emotional realism in fresco. \n 斯克罗威尼礼拜堂壁画，开启了现实主义情感表达。' },
      { id: 304, year: 1339, label: 'Effects of Good Gov. / 好政府的寓意', artist: 'Ambrogio Lorenzetti', description: 'Secular fresco in Siena. \n 锡耶纳市政厅的世俗题材壁画。' }
    ]
  },
  {
    id: 'renaissance',
    title: 'Renaissance / 文艺复兴',
    colorHeader: 'bg-purple-800',
    colorHex: PALETTE.RENAISSANCE,
    colorBackground: '#faf5fa',
    borderColor: 'border-purple-300',
    startYear: 1400,
    endYear: 1600,
    events: [
      { id: 401, year: 1434, label: 'Arnolfini Portrait / 阿尔诺芬尼夫妇像', artist: 'Jan van Eyck / 扬·范·艾克', description: 'Mastery of oil paint and symbolism. \n 北方文艺复兴油画技法与象征主义的代表。' },
      { id: 402, year: 1486, label: 'The Birth of Venus / 维纳斯的诞生', artist: 'Botticelli / 波提切利', description: 'Neoplatonic mythology. \n 佛罗伦萨新柏拉图主义的视觉化。' },
      { id: 403, year: 1498, label: 'The Last Supper / 最后的晚餐', artist: 'da Vinci / 达·芬奇', description: 'Perspective and psychological drama. \n 透视法与心理戏剧张力的完美结合。' },
      { id: 404, year: 1504, label: 'David / 大卫像', artist: 'Michelangelo / 米开朗基罗', description: 'High Renaissance sculpture. \n 盛期文艺复兴人体雕塑的巅峰。' },
      { id: 405, year: 1511, label: 'The School of Athens / 雅典学院', artist: 'Raphael / 拉斐尔', description: 'Philosophy and harmony. \n 梵蒂冈教皇宫壁画，哲学的颂歌。' },
      { id: 406, year: 1565, label: 'Hunters in the Snow / 雪中猎人', artist: 'Bruegel / 老勃鲁盖尔', description: 'Northern landscape tradition. \n 北方风景画与风俗画的杰作。' }
    ]
  },
  {
    id: 'baroque_rococo',
    title: 'Baroque & Rococo / 巴洛克与洛可可',
    colorHeader: 'bg-red-800',
    colorHex: PALETTE.BAROQUE,
    colorBackground: '#fdf2f2',
    borderColor: 'border-red-300',
    startYear: 1600,
    endYear: 1780,
    events: [
      { id: 501, year: 1600, label: 'Calling of St Matthew / 圣马太蒙召', artist: 'Caravaggio / 卡拉瓦乔', description: 'Chiaroscuro (Tenebrism). \n 强烈的明暗对照法（暗绘风格）。' },
      { id: 502, year: 1625, label: 'Judith Slaying Holofernes / 朱迪斯斩首荷罗孚尼', artist: 'Artemisia Gentileschi', description: 'Female Baroque power. \n 女性画家的力量与复仇主题。' },
      { id: 503, year: 1642, label: 'The Night Watch / 夜巡', artist: 'Rembrandt / 伦勃朗', description: 'Group portrait in action. \n 充满动感与光影的团体肖像。' },
      { id: 504, year: 1652, label: 'Ecstasy of Saint Teresa / 圣特雷萨的狂喜', artist: 'Bernini / 贝尼尼', description: 'Baroque sculpture drama. \n 巴洛克雕塑剧场感的极致。' },
      { id: 505, year: 1656, label: 'Las Meninas / 宫俄', artist: 'Velázquez / 委拉斯开兹', description: 'Complex composition. \n 构图复杂、探讨真实与幻觉的杰作。' },
      { id: 506, year: 1767, label: 'The Swing / 秋千', artist: 'Fragonard / 弗拉戈纳尔', description: 'Rococo playfulness. \n 洛可可风格的轻浮与欢愉。' }
    ]
  },
  {
    id: 'neoclassic_romantic',
    title: '19th Century / 19世纪艺术',
    colorHeader: 'bg-slate-700',
    colorHex: PALETTE.ROMANTICISM,
    colorBackground: '#f0f4f8',
    borderColor: 'border-slate-300',
    startYear: 1780,
    endYear: 1900,
    events: [
      { id: 601, year: 1784, label: 'Oath of the Horatii / 荷拉斯兄弟之誓', artist: 'David / 大卫', description: 'Neoclassical civic duty. \n 新古典主义的理性与公民责任。' },
      { id: 602, year: 1814, label: 'The Third of May 1808 / 1808年5月3日', artist: 'Goya / 戈雅', description: 'Raw war brutality. \n 对战争残酷性的直白描绘。' },
      { id: 603, year: 1818, label: 'Wanderer above the Sea of Fog / 雾海上的旅人', artist: 'Friedrich / 弗里德里希', description: 'Romantic sublime. \n 浪漫主义的崇高感与孤独。' },
      { id: 604, year: 1819, label: 'Raft of the Medusa / 梅杜萨之筏', artist: 'Géricault / 席里柯', description: 'Human desperation. \n 浪漫主义对绝望人性的刻画。' },
      { id: 605, year: 1830, label: 'Liberty Leading the People / 自由引导人民', artist: 'Delacroix / 德拉克洛瓦', description: 'Revolutionary spirit. \n 法国大革命精神的象征。' },
      { id: 606, year: 1872, label: 'Impression, Sunrise / 印象·日出', artist: 'Monet / 莫奈', description: 'Birth of Impressionism. \n 印象派的命名之作。' },
      { id: 607, year: 1884, label: 'A Sunday on La Grande Jatte / 大碗岛星期天的下午', artist: 'Seurat / 修拉', description: 'Pointillism science. \n 点彩派（新印象主义）的科学色彩实验。' },
      { id: 608, year: 1889, label: 'The Starry Night / 星月夜', artist: 'Van Gogh / 梵高', description: 'Post-Impressionist emotion. \n 后印象派情感的爆发与扭曲。' }
    ]
  },
  {
    id: 'modern_era',
    title: 'Modernism / 现代主义',
    colorHeader: 'bg-orange-600',
    colorHex: PALETTE.MODERN,
    colorBackground: '#fff5f0',
    borderColor: 'border-orange-300',
    startYear: 1900,
    endYear: 1970,
    events: [
      { id: 701, year: 1907, label: 'Les Demoiselles d\'Avignon / 亚威农少女', artist: 'Picasso / 毕加索', description: 'Cubism begins. \n 立体主义的开山之作，打破传统透视。' },
      { id: 702, year: 1910, label: 'The Dance / 舞蹈', artist: 'Matisse / 马蒂斯', description: 'Fauvist joy. \n 野兽派色彩与线条的纯粹快乐。' },
      { id: 703, year: 1913, label: 'Composition VII / 构图七号', artist: 'Kandinsky / 康定斯基', description: 'Pure Abstraction. \n 纯粹抽象艺术的交响乐。' },
      { id: 704, year: 1917, label: 'Fountain / 泉', artist: 'Duchamp / 杜尚', description: 'Readymade Dada. \n 现成品艺术，达达主义对艺术定义的挑战。' },
      { id: 705, year: 1931, label: 'The Persistence of Memory / 记忆的永恒', artist: 'Dalí / 达利', description: 'Surrealist dream. \n 超现实主义的梦境与融化的时钟。' },
      { id: 706, year: 1937, label: 'Guernica / 格尔尼卡', artist: 'Picasso / 毕加索', description: 'Anti-war manifesto. \n 20世纪最伟大的反战宣言。' },
      { id: 707, year: 1950, label: 'Autumn Rhythm / 秋韵', artist: 'Pollock / 波洛克', description: 'Action Painting. \n 抽象表现主义的行动绘画。' },
      { id: 708, year: 1962, label: 'Campbell\'s Soup Cans / 金宝汤罐头', artist: 'Warhol / 沃霍尔', description: 'Pop Art icon. \n 波普艺术对消费文化的挪用。' }
    ]
  },
  {
    id: 'contemporary',
    title: 'Contemporary / 当代艺术',
    colorHeader: 'bg-pink-600',
    colorHex: PALETTE.CONTEMPORARY,
    colorBackground: '#fff0f5',
    borderColor: 'border-pink-300',
    startYear: 1970,
    endYear: 2025,
    events: [
      { id: 801, year: 1974, label: 'Rhythm 0 / 节奏0', artist: 'Abramović / 阿布拉莫维奇', description: 'Performance Art limits. \n 行为艺术对身体与观众关系的极限测试。' },
      { id: 802, year: 1982, label: 'Untitled / 无题', artist: 'Basquiat / 巴斯奎特', description: 'Neo-expressionism. \n 街头涂鸦与新表现主义的结合。' },
      { id: 803, year: 1991, label: 'The Physical Impossibility of Death... / 生者对死者无动于衷', artist: 'Damien Hirst / 赫斯特', description: 'YBA Shock Art. \n 英国青年艺术家的鲨鱼标本，探讨死亡。' },
      { id: 804, year: 2003, label: 'The Weather Project / 气候工程', artist: 'Olafur Eliasson / 埃利亚松', description: 'Installation Art. \n 泰特美术馆的沉浸式装置艺术。' },
      { id: 805, year: 2010, label: 'Sunflower Seeds / 葵花籽', artist: 'Ai Weiwei / 艾未未', description: 'Conceptual Porcelain. \n 观念艺术与传统工艺的结合。' }
    ]
  }
];

export const MOVEMENTS: ArtMovement[] = [
  // --- ANCIENT ---
  { id: 'm1', name: 'Sumerian / 苏美尔', startYear: -4000, endYear: -2000, color: PALETTE.ANCIENT_NEAR_EAST, lane: 0, eraId: 'pre_ancient' },
  { id: 'm2', name: 'Babylonian / 巴比伦', startYear: -1800, endYear: -539, color: PALETTE.ANCIENT_NEAR_EAST, lane: 1, eraId: 'pre_ancient' },
  { id: 'm3', name: 'Egyptian Old Kingdom / 古埃及古王国', startYear: -2686, endYear: -2181, color: PALETTE.EGYPT, lane: 2, eraId: 'pre_ancient' },
  { id: 'm4', name: 'Egyptian New Kingdom / 古埃及新王国', startYear: -1550, endYear: -1069, color: PALETTE.EGYPT, lane: 3, eraId: 'pre_ancient' },
  
  // --- CLASSICAL ---
  { id: 'm5', name: 'Archaic Greek / 希腊古风', startYear: -800, endYear: -480, color: PALETTE.GREEK, lane: 0, eraId: 'classical' },
  { id: 'm6', name: 'Classical Greek / 希腊古典', startYear: -480, endYear: -323, color: PALETTE.GREEK, lane: 1, eraId: 'classical' },
  { id: 'm7', name: 'Hellenistic / 希腊化', startYear: -323, endYear: -31, color: PALETTE.GREEK, lane: 2, eraId: 'classical' },
  { id: 'm8', name: 'Roman Republic / 罗马共和', startYear: -509, endYear: -27, color: PALETTE.ROMAN, lane: 3, eraId: 'classical' },
  { id: 'm9', name: 'Roman Empire / 罗马帝国', startYear: -27, endYear: 476, color: PALETTE.ROMAN, lane: 4, eraId: 'classical' },

  // --- MEDIEVAL ---
  { id: 'm10', name: 'Byzantine / 拜占庭', startYear: 330, endYear: 1453, color: PALETTE.BYZANTINE, lane: 0, eraId: 'medieval' },
  { id: 'm11', name: 'Romanesque / 罗马式', startYear: 1000, endYear: 1150, color: PALETTE.MEDIEVAL, lane: 1, eraId: 'medieval' },
  { id: 'm12', name: 'Gothic / 哥特式', startYear: 1150, endYear: 1400, color: PALETTE.MEDIEVAL, lane: 2, eraId: 'medieval' },

  // --- RENAISSANCE ---
  { id: 'm13', name: 'Early Renaissance / 早期文艺复兴', startYear: 1400, endYear: 1495, color: PALETTE.RENAISSANCE, lane: 0, eraId: 'renaissance' },
  { id: 'm14', name: 'High Renaissance / 盛期文艺复兴', startYear: 1495, endYear: 1520, color: PALETTE.RENAISSANCE, lane: 1, eraId: 'renaissance' },
  { id: 'm15', name: 'Mannerism / 矫饰主义', startYear: 1520, endYear: 1600, color: PALETTE.RENAISSANCE, lane: 2, eraId: 'renaissance' },
  { id: 'm16', name: 'Northern Renaissance / 北方文艺复兴', startYear: 1430, endYear: 1580, color: PALETTE.RENAISSANCE, lane: 3, eraId: 'renaissance' },

  // --- BAROQUE & ROCOCO ---
  { id: 'm17', name: 'Baroque / 巴洛克', startYear: 1600, endYear: 1750, color: PALETTE.BAROQUE, lane: 4, eraId: 'baroque_rococo' },
  { id: 'm18', name: 'Dutch Golden Age / 荷兰黄金时代', startYear: 1588, endYear: 1672, color: PALETTE.BAROQUE, lane: 5, eraId: 'baroque_rococo' },
  { id: 'm19', name: 'Rococo / 洛可可', startYear: 1730, endYear: 1780, color: PALETTE.BAROQUE, lane: 6, eraId: 'baroque_rococo' },

  // --- 19TH CENTURY ---
  { id: 'm20', name: 'Neoclassicism / 新古典主义', startYear: 1750, endYear: 1850, color: PALETTE.NEOCLASSICAL, lane: 0, eraId: 'neoclassic_romantic' },
  { id: 'm21', name: 'Romanticism / 浪漫主义', startYear: 1780, endYear: 1850, color: PALETTE.ROMANTICISM, lane: 1, eraId: 'neoclassic_romantic' },
  { id: 'm22', name: 'Realism / 现实主义', startYear: 1848, endYear: 1900, color: PALETTE.REALISM, lane: 2, eraId: 'neoclassic_romantic' },
  { id: 'm23', name: 'Pre-Raphaelites / 前拉斐尔派', startYear: 1848, endYear: 1900, color: PALETTE.ROMANTICISM, lane: 3, eraId: 'neoclassic_romantic' },
  { id: 'm24', name: 'Impressionism / 印象派', startYear: 1860, endYear: 1890, color: PALETTE.MODERN, lane: 4, eraId: 'neoclassic_romantic' },
  { id: 'm25', name: 'Post-Impressionism / 后印象派', startYear: 1886, endYear: 1905, color: PALETTE.MODERN, lane: 5, eraId: 'neoclassic_romantic' },
  { id: 'm26', name: 'Arts & Crafts / 工艺美术', startYear: 1880, endYear: 1920, color: PALETTE.REALISM, lane: 6, eraId: 'neoclassic_romantic' },
  { id: 'm27', name: 'Symbolism / 象征主义', startYear: 1880, endYear: 1910, color: PALETTE.MODERN, lane: 7, eraId: 'neoclassic_romantic' },
  { id: 'm28', name: 'Art Nouveau / 新艺术运动', startYear: 1890, endYear: 1910, color: PALETTE.MODERN, lane: 8, eraId: 'neoclassic_romantic' },

  // --- MODERNISM ---
  { id: 'm29', name: 'Fauvism / 野兽派', startYear: 1904, endYear: 1908, color: PALETTE.MODERN, lane: 0, eraId: 'modern_era' },
  { id: 'm30', name: 'Cubism / 立体主义', startYear: 1907, endYear: 1914, color: PALETTE.MODERN, lane: 1, eraId: 'modern_era' },
  { id: 'm31', name: 'Expressionism / 表现主义', startYear: 1905, endYear: 1933, color: PALETTE.MODERN, lane: 2, eraId: 'modern_era' },
  { id: 'm32', name: 'Futurism / 未来主义', startYear: 1909, endYear: 1944, color: PALETTE.MODERN, lane: 3, eraId: 'modern_era' },
  { id: 'm33', name: 'Suprematism / 至上主义', startYear: 1913, endYear: 1928, color: PALETTE.MODERN, lane: 4, eraId: 'modern_era' },
  { id: 'm34', name: 'Constructivism / 构成主义', startYear: 1915, endYear: 1940, color: PALETTE.MODERN, lane: 5, eraId: 'modern_era' },
  { id: 'm35', name: 'Dada / 达达主义', startYear: 1916, endYear: 1924, color: PALETTE.MODERN, lane: 6, eraId: 'modern_era' },
  { id: 'm36', name: 'De Stijl / 风格派', startYear: 1917, endYear: 1931, color: PALETTE.MODERN, lane: 7, eraId: 'modern_era' },
  { id: 'm37', name: 'Bauhaus / 包豪斯', startYear: 1919, endYear: 1933, color: PALETTE.MODERN, lane: 8, eraId: 'modern_era' },
  { id: 'm38', name: 'Surrealism / 超现实主义', startYear: 1924, endYear: 1966, color: PALETTE.MODERN, lane: 9, eraId: 'modern_era' },
  { id: 'm39', name: 'Art Deco / 装饰艺术', startYear: 1920, endYear: 1940, color: PALETTE.MODERN, lane: 10, eraId: 'modern_era' },

  // --- POST-WAR / CONTEMPORARY ---
  { id: 'm40', name: 'Abstract Exp. / 抽象表现主义', startYear: 1943, endYear: 1965, color: PALETTE.CONTEMPORARY, lane: 0, eraId: 'contemporary' },
  { id: 'm41', name: 'Pop Art / 波普艺术', startYear: 1955, endYear: 1970, color: PALETTE.CONTEMPORARY, lane: 1, eraId: 'contemporary' },
  { id: 'm42', name: 'Minimalism / 极简主义', startYear: 1960, endYear: 1975, color: PALETTE.CONTEMPORARY, lane: 2, eraId: 'contemporary' },
  { id: 'm43', name: 'Conceptual Art / 观念艺术', startYear: 1960, endYear: 1980, color: PALETTE.CONTEMPORARY, lane: 3, eraId: 'contemporary' },
  { id: 'm44', name: 'Land Art / 大地艺术', startYear: 1968, endYear: 1985, color: PALETTE.CONTEMPORARY, lane: 4, eraId: 'contemporary' },
  { id: 'm45', name: 'Neo-Expressionism / 新表现主义', startYear: 1978, endYear: 1995, color: PALETTE.CONTEMPORARY, lane: 5, eraId: 'contemporary' },
  { id: 'm46', name: 'YBA / 英国青年艺术家', startYear: 1988, endYear: 2000, color: PALETTE.CONTEMPORARY, lane: 6, eraId: 'contemporary' },
  { id: 'm47', name: 'Street Art / 街头艺术', startYear: 1980, endYear: 2024, color: PALETTE.CONTEMPORARY, lane: 7, eraId: 'contemporary' },
];