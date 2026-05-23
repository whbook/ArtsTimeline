// --- 主题目录条目 ---
export interface TopicEntry { 
  id: string; 
  titleEn: string; 
  titleCn: string; 
  color: string; 
}

// --- 主题完整配置 ---
export interface FieldDef {
  key: string; 
  labelEn: string; 
  labelCn: string;
  type: 'text' | 'year' | 'url' | 'tags';
}

export interface Topic extends TopicEntry {
  description?: string;
  defaultViewport?: { startYear: number; endYear: number };
  minZoomRange?: number; // Minimum years visible in viewport (e.g. 0.08 for 1 month)
  maxZoomRange?: number; // Maximum years visible in viewport
  playbackSpeed?: number; // Multiplier for auto-play speed / 自动播放速度倍率
  initialZoom?: number; // Initial zoom factor / 初始放大倍数
  eventFields: FieldDef[];
  chunked?: boolean;
}

// --- 时间精度与模糊日期 ---
export type DateAccuracy = 
  | 'exact'       // 精确 (默认)
  | 'approximate' // 大约 / 约 (circa)
  | 'not_before'  // 不早于 (TPQ)
  | 'not_after';  // 不晚于 (TAQ)

export interface FuzzyDate {
  year: number;
  month?: number;
  day?: number;
  accuracy?: DateAccuracy;
  orYear?: number;
  orMonth?: number;
  orDay?: number;
}

// --- 时代分期 ---
export interface Period {
  id: string; 
  nameEn: string; 
  nameCn?: string;
  start: FuzzyDate; 
  end: FuzzyDate;
  colorHex: string; 
  colorBackground: string; 
  description?: string;
}

// --- 泳道（可选层，无则 swimlanes 为 []）---
export interface Swimlane {
  id: string; 
  periodId?: string;
  nameEn: string; 
  nameCn?: string;
  start: FuzzyDate; 
  end: FuzzyDate;
  color: string; 
  lane: number;
  descriptionCn?: string; // 泳道详细介绍
  descriptionEn?: string;
}

// --- 事件/作品/人物 ---
export interface TimelineEvent {
  id: string; 
  periodId?: string; 
  swimlaneId?: string;
  titleEn: string; 
  titleCn?: string;
  date: FuzzyDate; 
  endDate?: FuzzyDate;
  creator?: string; 
  creatorCn?: string;
  location?: string; 
  imageUrl?: string;
  detailPageUrl?: string;
  highResImageUrl?: string;
  descriptionEn?: string; 
  descriptionCn?: string;
  importance?: number; // 1 (highest) to 5 (lowest). Defines zoom-level visibility. / 权重等级，决定在何种缩放比例下显示
  tags?: string[];
  meta?: Record<string, string | number | string[]>; // 主题扩展字段
}

// --- 一个主题的全部运行时数据 ---
export interface TopicData { 
  topic: Topic; 
  periods: Period[]; 
  swimlanes: Swimlane[]; 
  events: TimelineEvent[]; 
}

// --- 视口（保持不变）---
export interface Viewport { 
  startYear: number; 
  endYear: number; 
}
