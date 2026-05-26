import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import TimelineRuler from './components/TimelineRuler';
import TimelineCanvas from './components/TimelineCanvas';
import DetailPanel from './components/DetailPanel';
import EventModal from './components/EventModal';
import TopicSelector from './components/TopicSelector';
import { MIN_ZOOM_RANGE, MAX_ZOOM_RANGE, AUTOPLAY_MODE, IMPORTANCE_THRESHOLDS } from './constants';
import { Viewport, TimelineEvent, Stream } from './types';
import { ZoomIn, ZoomOut, Loader2, Play } from 'lucide-react';
import { clampViewportToMaxEnd, formatTimelineDate, getTimelineMaxEndDecimal, getDecimalYear } from './utils';
import { useTopics } from './hooks/useTopics';
import { useTopicData } from './hooks/useTopicData';
import { useChunkedEvents } from './hooks/useChunkedEvents';
import { useAutoPlay } from './hooks/useAutoPlay';
import { useResponsiveScale } from './hooks/useResponsiveScale';

const App: React.FC = () => {
  const { topics, loading: topicsLoading } = useTopics();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Get responsive scale
  const scale = useResponsiveScale();
  const timelineMaxYear = useMemo(() => getTimelineMaxEndDecimal(), []);
  
  // Auto-select first topic when loaded
  useEffect(() => {
    if (topics.length > 0 && !activeTopicId) {
      setActiveTopicId(topics[0].id);
    }
  }, [topics, activeTopicId]);

  const { data: topicData, loading: dataLoading } = useTopicData(activeTopicId);

  const [viewport, setViewport] = useState<Viewport>({ startYear: 0, endYear: 100 });

  // Hook for lazy loading chunked events
  const isChunked = !!topicData?.topic?.chunked;
  const { events: chunkedEvents } = useChunkedEvents(
    activeTopicId,
    isChunked,
    viewport
  );

  // Determine active events source (either chunked or full in-memory)
  const activeEvents = useMemo(() => {
    if (isChunked) {
      return chunkedEvents;
    }
    return topicData?.events || [];
  }, [isChunked, chunkedEvents, topicData?.events]);

  // 智能计算时间轴的内容边界：最早年份、最晚年份和默认跨度范围
  const topicBoundaries = useMemo(() => {
    if (!topicData) return null;
    
    let earliestYear = 2050;
    let latestYear = -3000;
    let hasData = false;
    
    // 优先级 1：优先采用泳道 (swimlanes)。泳道是时间轴的核心视觉柱条，泳道的起始直接决定了最应该开始看的时间段
    if (topicData.swimlanes && topicData.swimlanes.length > 0) {
      const minSwimlaneYear = Math.min(...topicData.swimlanes.map(s => s.start.year).filter(y => y !== undefined && !isNaN(y)));
      const maxSwimlaneYear = Math.max(...topicData.swimlanes.map(s => s.end.year).filter(y => y !== undefined && !isNaN(y)));
      if (isFinite(minSwimlaneYear) && isFinite(maxSwimlaneYear)) {
        earliestYear = minSwimlaneYear;
        latestYear = maxSwimlaneYear;
        hasData = true;
      }
    }
    
    // 优先级 2：如果没有泳道，则使用具体的艺术作品/历史事件 (events)
    if (!hasData && topicData.events && topicData.events.length > 0) {
      const minEventYear = Math.min(...topicData.events.map(e => e.year).filter(y => y !== undefined && !isNaN(y)));
      const maxEventYear = Math.max(...topicData.events.map(e => e.year).filter(y => y !== undefined && !isNaN(y)));
      if (isFinite(minEventYear) && isFinite(maxEventYear)) {
        earliestYear = minEventYear;
        latestYear = maxEventYear;
        hasData = true;
      }
    }
    
    // 优先级 3：如果上述两项均空，则采用宏观历史分期 (periods)。
    // （注意：如果存在泳道/作品，我们不能将“史前与上古”的公元前4万年作为首屏和缩放基准，否则整个时间轴一加载将是 3 万多年的空虚空白，看不见任何泳道柱条！）
    if (!hasData && topicData.periods && topicData.periods.length > 0) {
      const minPeriodYear = Math.min(...topicData.periods.map(p => p.start.year).filter(y => y !== undefined && !isNaN(y)));
      const maxPeriodYear = Math.max(...topicData.periods.map(p => p.end.year).filter(y => y !== undefined && !isNaN(y)));
      if (isFinite(minPeriodYear) && isFinite(maxPeriodYear)) {
        earliestYear = minPeriodYear;
        latestYear = maxPeriodYear;
        hasData = true;
      }
    }

    if (!hasData) {
      // 没有任何内容时的安全保底
      earliestYear = -1000;
      latestYear = 2026;
    }

    let defaultRange = latestYear - earliestYear;
    if (defaultRange <= 0) {
      defaultRange = 100;
    }

    return { earliestYear, latestYear, defaultRange };
  }, [topicData]);
  
  // Reset viewport when topic changes
  useEffect(() => {
    if (topicData?.topic && topicBoundaries) {
      const { earliestYear, defaultRange } = topicBoundaries;
      const initialZoomFactor = topicData.topic.initialZoom || 6;
      const range = (defaultRange * scale.scaleX) / initialZoomFactor;
      
      // 将最早的有内容的年份置于中心红线的右侧（即红线正好指向 earliestYear，红线左侧为空白，最早的内容刚好在红线右侧开始展开）
      const startYear = earliestYear - range / 2;
      const endYear = earliestYear + range / 2;
      
      setViewport(clampViewportToMaxEnd({
        startYear,
        endYear
      }, timelineMaxYear));
    }
  }, [topicData?.topic, topicBoundaries, scale.scaleX, timelineMaxYear]);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  
  // Hover and Focus states for interactions
  const [hoveredMovement, setHoveredMovement] = useState<Stream | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [focusSection, setFocusSection] = useState<{id: string, ts: number} | null>(null);

  const handleMovementClick = useCallback((stream: Stream) => {
    const start = getDecimalYear(stream.start);
    const end = getDecimalYear(stream.end);
    
    setViewport(prev => {
      const range = prev.endYear - prev.startYear;
      const centerYear = prev.startYear + range / 2;
      
      // If the stream doesn't intersect the red line (centerYear), move the red line to the stream's center
      if (centerYear < start || centerYear > end) {
        const streamCenter = (start + end) / 2;
        return clampViewportToMaxEnd({
          startYear: streamCenter - range / 2,
          endYear: streamCenter + range / 2
        }, timelineMaxYear);
      }
      return prev;
    });

    // Send focus signal to DetailPanel
    setFocusSection({ id: stream.id, ts: Date.now() });
  }, [timelineMaxYear]);

  const handleZoomRange = useCallback((start: number, end: number) => {
    const range = end - start;
    // Add 15% padding on each side to give visual breathing room around the zoomed region
    const padding = Math.max(2, range * 0.15);
    setViewport(clampViewportToMaxEnd({
      startYear: start - padding,
      endYear: end + padding
    }, timelineMaxYear));
  }, [timelineMaxYear]);
  
  const handleRequestSwitch = useCallback(() => {
    setIsTransitioning(true);
    
    // Wait for fade out
    setTimeout(() => {
      const currentIndex = topics.findIndex(t => t.id === activeTopicId);
      let nextIndex = 0;
      if (AUTOPLAY_MODE === 'random') {
        nextIndex = Math.floor(Math.random() * topics.length);
      } else {
        nextIndex = (currentIndex + 1) % topics.length;
      }
      setActiveTopicId(topics[nextIndex].id);
      
      // Wait for data load and render, then fade in
      setTimeout(() => {
        setIsTransitioning(false);
      }, 100);
    }, 500);
  }, [topics, activeTopicId]);

  // Auto-play hook
  const { isAutoPlaying, countdown } = useAutoPlay(
    topicData, 
    handleRequestSwitch,
    setViewport,
    scale.scaleX // Pass scaleX to adjust playback speed
  );

  const lastPointerX = useRef<number>(0);
  const activePointerId = useRef<number | null>(null);
  const panMovedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const PAN_THRESHOLD_PX = 6;

  // --- Zoom Logic ---
  const handleWheel = (e: React.WheelEvent) => {
    if ((e.target as HTMLElement).closest('.detail-panel')) return;

    const container = containerRef.current;
    if (!container) return;

    const { width } = container.getBoundingClientRect();
    const currentRange = viewport.endYear - viewport.startYear;
    
    // Determine zoom factor
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9; // Zoom out vs Zoom in
    let newRange = currentRange * zoomFactor;

    // 智能自适应缩放钳制：
    // 最细放大极限：统一采用全局默认值 MIN_ZOOM_RANGE（允许精确到极细微观）
    const minZoom = MIN_ZOOM_RANGE;
    // 最宽缩小极限：动态自适应为该展览绝对内容总跨度的 1.2 倍（确保刚好能看完该展览全貌，又绝不会过度缩小导致两边出现大片无意义的灰色空白）
    const maxZoom = topicBoundaries ? topicBoundaries.defaultRange * 1.2 : MAX_ZOOM_RANGE;
    
    if (newRange < minZoom) newRange = minZoom;
    if (newRange > maxZoom) newRange = maxZoom;

    // Calculate mouse position relative to timeline (0 to 1)
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseRatio = mouseX / width;

    // Calculate cursor year
    const cursorYear = viewport.startYear + (currentRange * mouseRatio);

    // Calculate new start/end
    const newStart = cursorYear - (newRange * mouseRatio);
    const newEnd = newStart + newRange;

    setViewport(clampViewportToMaxEnd({
      startYear: newStart,
      endYear: newEnd
    }, timelineMaxYear));
  };

  // --- Pan Logic (pointer events for mouse + touch) ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.detail-panel, button, [data-timeline-interactive]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    setIsDragging(true);
    panMovedRef.current = false;
    lastPointerX.current = e.clientX;
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const rafRef = useRef<number | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || activePointerId.current !== e.pointerId) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const currentX = e.clientX;

    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const { width } = container.getBoundingClientRect();
      const deltaPixels = lastPointerX.current - currentX;
      if (Math.abs(deltaPixels) >= PAN_THRESHOLD_PX) {
        panMovedRef.current = true;
      }

      const currentRange = viewport.endYear - viewport.startYear;
      const yearsPerPixel = currentRange / width;
      const deltaYears = deltaPixels * yearsPerPixel;

      setViewport(prev => clampViewportToMaxEnd({
        startYear: prev.startYear + deltaYears,
        endYear: prev.endYear + deltaYears
      }, timelineMaxYear));

      lastPointerX.current = currentX;
    });
  };

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;

    setIsDragging(false);
    activePointerId.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // 拖动手势结束后短暂保留抑制，避免误触；交互元素会在 pointerdown 时自行清除
    if (panMovedRef.current) {
      window.setTimeout(() => {
        panMovedRef.current = false;
      }, 0);
    }
  };

  // --- Manual Controls ---
  const manualZoom = (direction: 'in' | 'out') => {
    const currentRange = viewport.endYear - viewport.startYear;
    const factor = direction === 'in' ? 0.8 : 1.25;
    let newRange = currentRange * factor;
    
    // 智能自适应缩放钳制：
    // 最细放大极限：统一采用全局默认值 MIN_ZOOM_RANGE（允许精确到极细微观）
    const minZoom = MIN_ZOOM_RANGE;
    // 最宽缩小极限：动态自适应为该展览绝对内容总跨度的 1.2 倍（确保刚好能看完该展览全貌，又绝不会过度缩小导致两边出现大片无意义的灰色空白）
    const maxZoom = topicBoundaries ? topicBoundaries.defaultRange * 1.2 : MAX_ZOOM_RANGE;
    
    if (newRange < minZoom) newRange = minZoom;
    if (newRange > maxZoom) newRange = maxZoom;

    const center = (viewport.startYear + viewport.endYear) / 2;
    const newStart = center - (newRange / 2);
    const newEnd = center + (newRange / 2);

    setViewport(clampViewportToMaxEnd({ startYear: newStart, endYear: newEnd }, timelineMaxYear));
  };

  // Prevent generic wheel scrolling on body
  useEffect(() => {
    const preventDefault = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.detail-panel, .event-modal')) return;
      e.preventDefault();
    };
    document.body.addEventListener('wheel', preventDefault, { passive: false });
    return () => document.body.removeEventListener('wheel', preventDefault);
  }, []);

  // Determine precision for display
  const range = viewport.endYear - viewport.startYear;
  const precision = range < 1 ? (range < 0.1 ? 'day' : 'month') : 'year';

  // Zoom factor relative to topic default viewport (1× = default span)
  const zoomBaselineRange = useMemo(() => {
    if (!topicData?.topic || !topicBoundaries) return null;
    return topicBoundaries.defaultRange * scale.scaleX;
  }, [topicData?.topic, topicBoundaries, scale.scaleX]);

  const zoomFactor = useMemo(() => {
    if (!zoomBaselineRange || range <= 0) return 1;
    return zoomBaselineRange / range;
  }, [zoomBaselineRange, range]);

  const zoomFactorLabel = useMemo(() => {
    if (zoomFactor >= 100) return `${Math.round(zoomFactor)}×`;
    if (zoomFactor >= 10) return `${zoomFactor.toFixed(1)}×`;
    if (zoomFactor >= 1) return `${zoomFactor.toFixed(1)}×`;
    return `${zoomFactor.toFixed(2)}×`;
  }, [zoomFactor]);

  // --- Level of Detail (LOD) Filtering ---
  const visibleEvents = useMemo(() => {
    if (!topicData) return [];
    // Normalize range based on screen width so LOD feels consistent across devices
    const normalizedRange = range / scale.scaleX;
    
    return activeEvents.filter(event => {
      const importance = event.importance || 1; // Default to 1 (always visible) if not specified
      const threshold = IMPORTANCE_THRESHOLDS[importance] || Infinity;
      return normalizedRange <= threshold;
    });
  }, [topicData, activeEvents, range, scale.scaleX]);

  if (topicsLoading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#f8f8f5]"><Loader2 className="animate-spin text-gray-400" size={32} /></div>;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f8f8f5] font-sans text-gray-900 overflow-hidden">
      
      {/* Header / Title Bar */}
      <header className="flex-none bg-[#1a1a1a] text-[#f0f0f0] flex flex-col shadow-md z-30 border-b border-[#333]">
        <div className="h-16 flex items-center justify-between px-6">
          <h1 className="text-xl md:text-2xl font-serif italic font-bold tracking-wide flex items-center gap-3">
            <div className="flex gap-1">
               <span className="w-1.5 h-6 bg-[#8B0000]"></span>
               <span className="w-1.5 h-6 bg-[#DAA520]"></span>
               <span className="w-1.5 h-6 bg-[#4682B4]"></span>
            </div>
            Universal History Timeline
          </h1>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-6 text-sm text-gray-400 font-serif">
               <span className="hidden md:inline opacity-80">
                 <span className="italic">Scroll to Zoom / Drag to Pan</span>
                 <span className="mx-2 text-gray-600 not-italic">·</span>
                 <span className="font-mono not-italic text-[#DAA520] tabular-nums" title="相对主题默认视口的缩放倍数">
                   {zoomFactorLabel}
                 </span>
               </span>
               <div className="flex gap-0 border border-gray-600 rounded overflow-hidden">
                 <button onClick={() => manualZoom('out')} className="p-2 bg-[#2a2a2a] hover:bg-[#333] hover:text-white transition border-r border-gray-600" title="Zoom Out"><ZoomOut size={18}/></button>
                 <button onClick={() => manualZoom('in')} className="p-2 bg-[#2a2a2a] hover:bg-[#333] hover:text-white transition" title="Zoom In"><ZoomIn size={18}/></button>
               </div>
            </div>
            {isAutoPlaying && (
              <div className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse pointer-events-none">
                <Play size={14} className="text-green-400 fill-green-400" />
                {countdown !== null
                  ? `Switching topic in ${countdown}...`
                  : 'Auto-Playing... (Interact to stop)'}
              </div>
            )}
          </div>
        </div>
        <TopicSelector topics={topics} activeTopicId={activeTopicId} onSelectTopic={setActiveTopicId} />
      </header>

      {dataLoading || !topicData ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      ) : (
        <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-500 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* Main Visualization Area (Top Half) */}
          <div 
            ref={containerRef}
            className={`flex-none relative w-full h-[55%] bg-[#fdfdfd] border-b-4 border-gray-800 shadow-xl overflow-hidden cursor-move touch-none select-none ${isDragging ? 'cursor-grabbing' : ''}`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
            {/* Center Red Triangle Indicator */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none h-full">
              <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-red-600 drop-shadow-md"></div>
              <div className="w-[2px] h-full bg-red-600/30"></div>
            </div>

            <TimelineRuler 
                viewport={viewport} 
                hoveredMovement={hoveredMovement}
                hoveredEvent={hoveredEvent}
            />
            <TimelineCanvas 
                viewport={viewport} 
                periods={topicData.periods}
                swimlanes={topicData.swimlanes}
                events={visibleEvents}
                scaleX={scale.scaleX}
                scaleY={scale.scaleY}
                onEventClick={setSelectedEvent}
                onMovementHover={setHoveredMovement}
                onMovementClick={handleMovementClick}
                onEventHover={setHoveredEvent}
                onZoomRange={handleZoomRange}
                suppressClickRef={panMovedRef}
            />
            
            {/* Floating current range indicator */}
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur border border-gray-300 px-4 py-2 text-sm font-serif shadow-lg pointer-events-none z-20 rounded flex items-center w-[480px]">
              <span className="text-gray-500 italic shrink-0 w-[150px]">Visible Era / 显示时间:</span>
              <div className="flex-1 flex items-center justify-center font-bold tabular-nums tracking-tight">
                <span className="w-[140px] text-right truncate">{formatTimelineDate(viewport.startYear, precision)}</span>
                <span className="mx-2 text-gray-400 font-normal shrink-0">—</span>
                <span className="w-[140px] text-left truncate">{formatTimelineDate(viewport.endYear, precision)}</span>
              </div>
            </div>
          </div>

          {/* Detail Columns (Bottom Half) */}
          <div className="flex-1 min-h-0 detail-panel relative bg-[#f4f4f4]">
            <DetailPanel 
                topic={topicData.topic}
                periods={topicData.periods}
                swimlanes={topicData.swimlanes}
                events={visibleEvents}
                viewport={viewport} 
                scaleX={scale.scaleX}
                focusSection={focusSection}
                onEventClick={setSelectedEvent}
                onEventHover={setHoveredEvent}
            />
            {/* Decorative shadow */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-b from-black/5 to-transparent pointer-events-none"></div>
          </div>

          {/* Artwork Modal */}
          <EventModal 
            topic={topicData.topic}
            event={selectedEvent} 
            onClose={() => setSelectedEvent(null)} 
          />
        </div>
      )}
    </div>
  );
};

export default App;