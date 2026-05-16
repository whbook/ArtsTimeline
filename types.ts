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
  defaultViewport: { startYear: number; endYear: number };
  minZoomRange?: number; // Minimum years visible in viewport (e.g. 0.08 for 1 month)
  maxZoomRange?: number; // Maximum years visible in viewport
  playbackSpeed?: number; // Multiplier for auto-play speed / 自动播放速度倍率
  eventFields: FieldDef[];
}

// --- 时代分期 ---
export interface Period {
  id: string; 
  nameEn: string; 
  nameCn?: string;
  startYear: number; 
  endYear: number;
  colorHex: string; 
  colorBackground: string; 
  description?: string;
}

// --- 流派/运动（可选层，无则 streams.json 为 []）---
export interface Stream {
  id: string; 
  periodId?: string;
  nameEn: string; 
  nameCn?: string;
  startYear: number; 
  endYear: number;
  color: string; 
  lane: number;
}

// --- 事件/作品/人物 ---
export interface TimelineEvent {
  id: string; 
  periodId?: string; 
  streamId?: string;
  titleEn: string; 
  titleCn?: string;
  year: number; 
  endYear?: number;
  creator?: string; 
  creatorCn?: string;
  location?: string; 
  imageUrl?: string;
  descriptionEn?: string; 
  descriptionCn?: string;
  tags?: string[];
  meta?: Record<string, string | number | string[]>; // 主题扩展字段
}

// --- 一个主题的全部运行时数据 ---
export interface TopicData { 
  topic: Topic; 
  periods: Period[]; 
  streams: Stream[]; 
  events: TimelineEvent[]; 
}

// --- 视口（保持不变）---
export interface Viewport { 
  startYear: number; 
  endYear: number; 
}
