export const INITIAL_VIEWPORT = {
  startYear: -4000, 
  endYear: 2050
};

// Allow zooming down to ~1 day (1/365 ≈ 0.0027)
export const MIN_ZOOM_RANGE = 0.003; 
export const MAX_ZOOM_RANGE = 50000; 

// --- Auto-play Configurations / 自动播放配置 ---
export const AUTOPLAY_IDLE_TIMEOUT = 10000; // 无人操作多少毫秒后进入自动播放 (10秒)
export const AUTOPLAY_MODE: 'sequential' | 'random' = 'sequential'; // 播放模式：'sequential' (顺序) 或 'random' (随机)
export const AUTOPLAY_BASE_SPEED = 10; // 基础滑动速度：每秒滑动多少年 (基于基准屏幕)
export const AUTOPLAY_FAST_SPEED = 500; // 快进滑动速度：当距离第一个事件很远时，每秒滑动多少年

// --- Responsive Base Configurations / 响应式基准配置 ---
// 我们以标准的 1080p 屏幕作为设计基准
export const BASE_SCREEN_WIDTH = 1920;
export const BASE_SCREEN_HEIGHT = 1080;
// 底部面板的基准列宽
export const BASE_COLUMN_WIDTH = 320;

// --- Level of Detail (LOD) / 语义缩放配置 ---
// 映射事件的 importance 等级 (1-5) 到它能保持可见的【最大标准化时间跨度】(年)
// 例如：等级 3 的事件，只有当屏幕上显示的时间跨度小于 1500 年时才会出现
export const IMPORTANCE_THRESHOLDS: Record<number, number> = {
  1: Infinity, // 等级 1: 国家/全球级，永远可见
  2: 5000,     // 等级 2: 省级/大时代级，跨度 <= 5000年可见
  3: 1500,     // 等级 3: 市级/重要流派级，跨度 <= 1500年可见
  4: 400,      // 等级 4: 区级/普通事件级，跨度 <= 400年可见
  5: 100       // 等级 5: 街道级/细节事件级，跨度 <= 100年可见
};
