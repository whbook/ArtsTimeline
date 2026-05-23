import React, { memo, useMemo } from 'react';
import { Viewport, Stream, TimelineEvent, Period } from '../types';
import { getDecimalYear, formatFuzzyDate } from '../utils';

interface TimelineCanvasProps {
  viewport: Viewport;
  periods: Period[];
  streams: Stream[];
  events: TimelineEvent[];
  scaleX: number;
  scaleY: number;
  onEventClick: (event: TimelineEvent) => void;
  onMovementHover: (movement: Stream | null) => void;
  onMovementClick: (movement: Stream) => void;
  onEventHover: (event: TimelineEvent | null) => void;
  onZoomRange?: (start: number, end: number) => void;
}

interface EventCluster {
  type: 'cluster';
  id: string;
  x: number;
  count: number;
  startYear: number;
  endYear: number;
  events: TimelineEvent[];
  colorHex: string;
}

interface ProcessedRenderItem {
  type: 'event' | 'cluster';
  id: string;
  x: number; // pixel coordinate
  event?: TimelineEvent;
  cluster?: EventCluster;
  stackLevel: number;
}

const stackEvents = (
  events: TimelineEvent[],
  range: number,
  W: number
) => {
  const sorted = [...events].sort((a, b) => getDecimalYear(a.date) - getDecimalYear(b.date));
  const stacked: { event: TimelineEvent; x: number; stackLevel: number }[] = [];
  const levelEnds: number[] = [];
  
  const LABEL_WIDTH_PX = 96; // 标签像素宽度
  const minYearGap = (LABEL_WIDTH_PX * range) / W; // 将物理像素转换为当前缩放下的年份差值，作为绝对堆叠阈值
  const MAX_STACK_LEVELS = 3;

  for (const event of sorted) {
    const year = getDecimalYear(event.date);
    
    let assignedLevel = -1;
    for (let level = 0; level < MAX_STACK_LEVELS; level++) {
      const lastEndYear = levelEnds[level] !== undefined ? levelEnds[level] : -Infinity;
      // 在绝对时间线上，如果当前事件年份与上一个事件在同层的结束年份间隔大于等于安全年份阈值，则不重叠
      if (year - minYearGap / 2 >= lastEndYear) {
        assignedLevel = level;
        break;
      }
    }

    if (assignedLevel === -1) {
      assignedLevel = 0; // 默认放到底部
    }

    levelEnds[assignedLevel] = year + minYearGap / 2;
    stacked.push({
      event,
      x: year, // 存储绝对年份
      stackLevel: assignedLevel
    });
  }

  return stacked;
};

const clusterEvents = (
  events: TimelineEvent[],
  periods: Period[],
  range: number
): ProcessedRenderItem[] => {
  // 根据视口的年份范围 range，动态计算在绝对年份轴上的分桶年份跨度
  // 视口中理想的分桶宽度为 12 个
  const bucketYearSpan = Math.max(0.001, range / 12);

  // 1. 将所有事件按绝对时间段分组，滚动时 bucketKey 绝对不变
  const groups: Record<number, TimelineEvent[]> = {};
  for (const event of events) {
    const year = getDecimalYear(event.date);
    const bucketKey = Math.floor(year / bucketYearSpan);
    if (!groups[bucketKey]) {
      groups[bucketKey] = [];
    }
    groups[bucketKey].push(event);
  }

  const result: ProcessedRenderItem[] = [];

  // 2. 遍历各区间，生成稳定位置的事件或聚类气泡
  for (const keyStr in groups) {
    const bucketIdx = parseInt(keyStr, 10);
    const bucketEvents = groups[bucketIdx];
    if (bucketEvents.length === 0) continue;

    const years = bucketEvents.map(e => getDecimalYear(e.date));
    const meanYear = years.reduce((sum, y) => sum + y, 0) / years.length;
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    if (bucketEvents.length === 1) {
      const event = bucketEvents[0];
      const eventYear = getDecimalYear(event.date);
      result.push({
        type: 'event',
        id: `evt-${event.id}`,
        x: eventYear, // 直接存储事件的绝对年份
        event,
        stackLevel: 0
      });
    } else {
      const dominantPeriodId = bucketEvents[0].periodId;
      const era = periods.find(p => p.id === dominantPeriodId);
      const colorHex = era?.colorHex || '#1F8A70';

      result.push({
        type: 'cluster',
        id: `cluster-${bucketIdx}-${bucketEvents.length}`,
        x: meanYear, // 存储聚类中心点的绝对年份
        stackLevel: 0,
        cluster: {
          type: 'cluster',
          id: `cluster-${bucketIdx}`,
          x: meanYear,
          count: bucketEvents.length,
          startYear: minYear,
          endYear: maxYear,
          events: bucketEvents,
          colorHex
        }
      });
    }
  }

  return result;
};

const TimelineCanvas: React.FC<TimelineCanvasProps> = memo(({ 
    viewport, 
    periods,
    streams,
    events,
    scaleX,
    scaleY,
    onEventClick,
    onMovementHover,
    onMovementClick,
    onEventHover,
    onZoomRange
}) => {
  const { startYear, endYear } = viewport;
  const range = endYear - startYear;

  const getPercentage = (year: number) => {
    return ((year - startYear) / range) * 100;
  };

  // Pre-calculate scaled values
  const laneHeight = 28 * Math.max(1, scaleY * 0.8);
  const topPadding = 30 * Math.max(1, scaleY);
  const eraLabelEnSize = 50 * Math.max(1, scaleX * 0.8);
  const eraLabelCnSize = 30 * Math.max(1, scaleX * 0.8);

  const getStyle = (movement: Stream) => {
    const startYear = getDecimalYear(movement.start);
    const endYear = getDecimalYear(movement.end);
    const startPerc = getPercentage(startYear);
    const endPerc = getPercentage(endYear);
    const durationPerc = endPerc - startPerc;
    
    // Ensure minimal visibility
    const finalWidth = Math.max(durationPerc, 0.2); 

    // Swimlane logic: 
    const topPos = topPadding + (movement.lane * laneHeight); 

    // Visual styles based on accuracy
    const isStartApprox = movement.start.accuracy === 'approximate';
    const isEndApprox = movement.end.accuracy === 'approximate';
    const isStartNB = movement.start.accuracy === 'not_before';
    const isEndNA = movement.end.accuracy === 'not_after';

    let maskImage = 'none';
    if (isStartApprox && isEndApprox) {
        maskImage = 'linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)';
    } else if (isStartApprox) {
        maskImage = 'linear-gradient(90deg, transparent 0%, black 10%, black 100%)';
    } else if (isEndApprox) {
        maskImage = 'linear-gradient(90deg, black 0%, black 90%, transparent 100%)';
    }

    let borderLeft = 'none';
    if (isStartNB) borderLeft = '2px dashed rgba(255,255,255,0.8)';
    else if (!isStartApprox) borderLeft = '2px solid rgba(255,255,255,0.8)';

    let borderRight = 'none';
    if (isEndNA) borderRight = '2px dashed rgba(255,255,255,0.8)';
    else if (!isEndApprox) borderRight = '2px solid rgba(255,255,255,0.8)';

    return {
      left: 0,
      width: `${finalWidth}vw`,
      top: `${topPos}px`,
      height: '24px', 
      backgroundColor: movement.color,
      borderLeft,
      borderRight,
      maskImage,
      WebkitMaskImage: maskImage,
      transform: `translate3d(${startPerc}vw, 0, 0)`,
      willChange: 'transform'
    };
  };

  // Find current screen width for responsive stacking & clustering
  const W = typeof window !== 'undefined' ? window.innerWidth : 1200;

  // 2. Compute processed layout items (hybrid of stacking or clustering)
  // 此 useMemo 剔除了 startYear，因此在拖拽或自动滚动平移时完全不需要重新执行计算
  const processedItems = useMemo(() => {
    if (events.length === 0) return [];

    // 基于当前缩放倍率（range）在总时间跨度上的占比，科学、稳定地估算屏幕上的事件密度，避免跳变
    let isDense = false;
    const years = events.map(e => getDecimalYear(e.date));
    if (years.length > 0) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const totalSpan = maxYear - minYear || 1;
      const estimatedVisibleCount = events.length * (range / totalSpan);
      isDense = estimatedVisibleCount > 35;
    }

    if (isDense) {
      return clusterEvents(events, periods, range);
    } else {
      const stacked = stackEvents(events, range, W);
      return stacked.map((s, idx) => ({
        type: 'event' as const,
        id: `evt-${s.event.id}-${idx}`,
        x: s.x,
        event: s.event,
        stackLevel: s.stackLevel
      }));
    }
  }, [events, range, W, periods]);

  return (
    <div className="absolute top-12 left-0 w-full h-[400px] overflow-visible pointer-events-none z-10">
      
      {/* LAYER 1: Era Background Blocks */}
      <div className="absolute inset-0 w-full h-full flex pointer-events-none opacity-50">
        {periods.map((era) => {
            const startYear = getDecimalYear(era.start);
            const endYear = getDecimalYear(era.end);
            const startP = getPercentage(startYear);
            const endP = getPercentage(endYear);
            const widthP = endP - startP;

            // Don't render if out of view
            if (widthP + startP < 0 || startP > 100) return null;

            return (
                <div 
                    key={`bg-${era.id}`}
                    className="absolute h-full border-l border-r border-dashed border-gray-300/50 flex flex-col justify-end pb-4"
                    style={{
                        left: 0,
                        width: `${widthP}vw`,
                        transform: `translate3d(${startP}vw, 0, 0)`,
                        backgroundColor: era.colorBackground,
                        willChange: 'transform'
                    }}
                >
                    {/* Era Label on the canvas background - Split English/Chinese for styling */}
                    <div 
                      className="absolute bottom-10 left-2 pointer-events-none opacity-10 overflow-hidden"
                      style={{ 
                        width: 'calc(100% - 16px)', // Leave a little margin on the right
                        maskImage: 'linear-gradient(to right, black 60%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, black 60%, transparent 100%)'
                      }}
                    >
                         <div 
                            className="font-serif font-black text-black leading-none whitespace-nowrap"
                            style={{ fontSize: `${eraLabelEnSize}px` }}
                         >
                            {era.nameEn}
                         </div>
                         <div 
                            className="font-serif font-bold text-black leading-none whitespace-nowrap mt-2"
                            style={{ fontSize: `${eraLabelCnSize}px` }}
                         >
                            {era.nameCn}
                         </div>
                    </div>
                </div>
            )
        })}
      </div>

      {/* Grid Lines */}
      <div className="w-full h-full absolute top-0 left-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none"></div>

      {/* LAYER 2: Movement Swimlanes */}
      {streams.map((movement) => {
        const startYear = getDecimalYear(movement.start);
        const endYear = getDecimalYear(movement.end);
        if (endYear < viewport.startYear || startYear > viewport.endYear) return null;

        const style = getStyle(movement);
        const engName = movement.nameEn;
        const cnName = movement.nameCn;

        // Calculate the visible center of the stream to position labels and tooltips
        const visibleStart = Math.max(startYear, viewport.startYear);
        const visibleEnd = Math.min(endYear, viewport.endYear);
        const visibleCenterYear = (visibleStart + visibleEnd) / 2;
        const duration = endYear - startYear;
        const visibleCenterPercent = duration > 0 ? ((visibleCenterYear - startYear) / duration) * 100 : 50;

        return (
          <div
            key={movement.id}
            onMouseEnter={() => onMovementHover(movement)}
            onMouseLeave={() => onMovementHover(null)}
            onClick={(e) => { e.stopPropagation(); onMovementClick(movement); }}
            className="absolute rounded-sm hover:scale-[1.02] hover:z-50 transition-shadow duration-200 cursor-pointer pointer-events-auto group overflow-visible"
            style={style}
          >
            {/* Sticky Label centered on the visible portion */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center gap-1 text-[9px] font-bold text-white whitespace-nowrap drop-shadow-sm font-sans tracking-wide"
              style={{ left: `${visibleCenterPercent}%` }}
            >
              <span>{engName}</span>
              {cnName && <span className="opacity-90 font-normal border-l border-white/30 pl-1">{cnName}</span>}
            </div>
            
            {/* Popover on hover, also centered on the visible portion */}
            <div 
              className="absolute bottom-full -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs p-3 rounded shadow-xl z-50 w-64 pointer-events-none"
              style={{ left: `${visibleCenterPercent}%` }}
            >
              <strong className="font-serif text-sm block mb-1">{engName} {cnName}</strong>
              <span className="text-gray-300 font-mono text-[10px] block mb-2">
                {formatFuzzyDate(movement.start)} — {formatFuzzyDate(movement.end)}
              </span>
              {movement.descriptionCn && (
                <p className="text-gray-200 text-xs leading-relaxed whitespace-normal border-t border-gray-700 pt-2 mt-2">
                  {movement.descriptionCn}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* LAYER 3: Specific Events Markers (Clustered or Stacked) */}
      {processedItems.map(item => {
        // 动态计算该绝对年份在此视口下的 vw 百分比位置
        const leftPercent = ((item.x - startYear) / range) * 100;
        
        // 渲染视口裁剪过滤：如果完全偏离屏幕范围（留 15% 缓冲区保证滑入边缘也顺畅，不产生截断），则直接不渲染
        if (leftPercent < -15 || leftPercent > 115) return null;

        // --- 1. RENDER CLUSTER ---
        if (item.type === 'cluster') {
          const cluster = item.cluster!;
          const count = cluster.count;
          const color = cluster.colorHex;

          const hoverTooltip = (
            <div className="absolute bottom-full mb-3 hidden group-hover:block bg-gray-900/95 backdrop-blur-md text-white text-xs p-3.5 rounded-lg shadow-2xl z-50 w-72 pointer-events-none text-left border border-gray-700">
              <strong className="font-serif text-sm block mb-2 pb-1.5 border-b border-gray-700/80 text-[#DAA520] flex justify-between">
                <span>{count} 个艺术事件</span>
                <span className="font-mono text-xs text-gray-400 font-normal">
                  {formatFuzzyDate({ year: Math.round(cluster.startYear) })} - {formatFuzzyDate({ year: Math.round(cluster.endYear) })}
                </span>
              </strong>
              <ul className="space-y-2 max-h-52 overflow-hidden">
                {cluster.events.slice(0, 5).map(e => {
                  const title = e.titleCn || e.titleEn;
                  const yearStr = formatFuzzyDate(e.date);
                  return (
                    <li key={e.id} className="text-[11px] leading-relaxed flex items-start gap-1">
                      <span className="text-[#DAA520]/85 font-mono shrink-0 select-none">[{yearStr}]</span>
                      <span className="text-gray-200 truncate font-sans">{title}</span>
                    </li>
                  );
                })}
              </ul>
              {count > 5 && (
                <div className="text-gray-400 text-[10px] mt-2 pt-2 border-t border-gray-800/80 text-center italic">
                  还有 {count - 5} 个事件... 点击区域放大查看
                </div>
              )}
            </div>
          );

          return (
            <div 
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                onZoomRange?.(cluster.startYear, cluster.endYear);
              }}
              className="absolute flex flex-col items-center group pointer-events-auto cursor-zoom-in z-25"
              style={{ 
                top: `calc(100% - ${60 * Math.max(1, scaleY)}px)`, // Position at base events baseline
                left: 0, 
                transform: `translate3d(${leftPercent}vw, 0, 0)`,
                willChange: 'transform'
              }}
            >
              {/* Cluster Bubble Representation */}
              <div className="relative flex items-center justify-center">
                {/* Outer ring */}
                <div 
                  className="absolute inset-0 rounded-full bg-current opacity-30 animate-pulse scale-125"
                  style={{ color }}
                ></div>
                
                {/* Inner bubble */}
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-[11px] text-white z-10 transition-transform group-hover:scale-115"
                  style={{ backgroundColor: color }}
                >
                  {count}
                </div>
              </div>

              {hoverTooltip}
            </div>
          );
        }

        // --- 2. RENDER INDIVIDUAL EVENT (Stacked) ---
        const event = item.event!;
        
        const cnLabel = event.titleCn?.trim();
        const engLabel = event.titleEn?.trim();
        const primaryLabel = cnLabel || engLabel || '';
        const secondaryLabel = cnLabel && engLabel && cnLabel !== engLabel ? engLabel : null;
        const era = periods.find(p => p.id === event.periodId);
        const colorHex = era?.colorHex || '#999';

        const importance = event.importance || 1;
        const accuracy = event.date.accuracy || 'exact';
        
        // Calculate dot size based on importance (1 is biggest, 5 is smallest)
        const sizeClass = 
          importance === 1 ? 'w-4 h-4 border-[3px]' : // 16px
          importance === 2 ? 'w-3.5 h-3.5 border-[2.5px]' : // 14px
          importance === 3 ? 'w-3 h-3 border-2' : // 12px (default)
          importance === 4 ? 'w-2.5 h-2.5 border-[1.5px]' : // 10px
          'w-2 h-2 border-[1px]'; // 8px

        // Y positioning: Base baseline + stacking offset upwards
        const verticalOffset = item.stackLevel * 55;
        const topPos = `calc(100% - ${60 * Math.max(1, scaleY)}px - ${verticalOffset}px)`;

        return (
            <div 
                key={item.id}
                onClick={() => onEventClick(event)}
                onMouseEnter={() => onEventHover(event)}
                onMouseLeave={() => onEventHover(null)}
                className="absolute flex flex-col items-center group pointer-events-auto cursor-pointer z-20"
                style={{ 
                    top: topPos,
                    left: 0, 
                    transform: `translate3d(${leftPercent}vw, 0, 0)`,
                    willChange: 'transform'
                }}
            >
                {/* Vertical Connector Line (draws down to baseline) */}
                {item.stackLevel > 0 && (
                  <div 
                    className="absolute bottom-0 w-[1px] border-l border-dashed border-gray-400/80 pointer-events-none"
                    style={{ 
                      height: `${verticalOffset}px`,
                      transform: 'translateY(100%)',
                      zIndex: -1
                    }}
                  ></div>
                )}

                {/* The Dot Wrapper */}
                <div className="relative flex items-center justify-center">
                    {/* Prefix for not_before */}
                    {accuracy === 'not_before' && (
                        <span className="absolute right-full mr-0.5 text-gray-500 font-bold text-[10px] leading-none">[</span>
                    )}

                    {/* Halo for approximate */}
                    {accuracy === 'approximate' && (
                        <div className="absolute inset-0 rounded-full bg-current opacity-40 blur-[2px] scale-150 pointer-events-none" style={{ color: colorHex }}></div>
                    )}

                    {/* The Dot */}
                    <div 
                        className={`${sizeClass} rounded-full border-white shadow-md group-hover:scale-150 transition-transform group-hover:bg-white relative z-10`}
                        style={{ backgroundColor: colorHex }}
                    ></div>

                    {/* Suffix for not_after */}
                    {accuracy === 'not_after' && (
                        <span className="absolute left-full ml-0.5 text-gray-500 font-bold text-[10px] leading-none">]</span>
                    )}
                </div>
                
                {/* The Label */}
                <div className="mt-2 flex flex-col items-center opacity-75 group-hover:opacity-100 transition-opacity bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md border border-gray-200 shadow-md text-center max-w-[120px]">
                    <span className="text-[9px] font-bold text-gray-800 leading-tight block truncate w-full">{primaryLabel}</span>
                    {secondaryLabel && <span className="text-[8px] font-medium text-gray-500 leading-tight block truncate w-full mt-0.5">{secondaryLabel}</span>}
                    <span className="text-[8px] text-gray-400 font-mono block mt-0.5">{formatFuzzyDate(event.date)}</span>
                </div>
            </div>
        )
      })}

    </div>
  );
});

export default TimelineCanvas;
