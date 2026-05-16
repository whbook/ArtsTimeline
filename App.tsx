import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import TimelineRuler from './components/TimelineRuler';
import TimelineCanvas from './components/TimelineCanvas';
import DetailPanel from './components/DetailPanel';
import EventModal from './components/EventModal';
import TopicSelector from './components/TopicSelector';
import { MIN_ZOOM_RANGE, MAX_ZOOM_RANGE, AUTOPLAY_MODE, IMPORTANCE_THRESHOLDS } from './constants';
import { Viewport, TimelineEvent, Stream } from './types';
import { ZoomIn, ZoomOut, Loader2, Play } from 'lucide-react';
import { formatTimelineDate, getDecimalYear } from './utils';
import { useTopics } from './hooks/useTopics';
import { useTopicData } from './hooks/useTopicData';
import { useAutoPlay } from './hooks/useAutoPlay';
import { useResponsiveScale } from './hooks/useResponsiveScale';

const App: React.FC = () => {
  const { topics, loading: topicsLoading } = useTopics();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Get responsive scale
  const scale = useResponsiveScale();
  
  // Auto-select first topic when loaded
  useEffect(() => {
    if (topics.length > 0 && !activeTopicId) {
      setActiveTopicId(topics[0].id);
    }
  }, [topics, activeTopicId]);

  const { data: topicData, loading: dataLoading } = useTopicData(activeTopicId);

  const [viewport, setViewport] = useState<Viewport>({ startYear: 0, endYear: 100 });
  
  // Reset viewport when topic changes
  useEffect(() => {
    if (topicData?.topic) {
      // Adjust default viewport based on screen width scale
      // A wider screen can show more years by default
      const defaultRange = topicData.topic.defaultViewport.endYear - topicData.topic.defaultViewport.startYear;
      const scaledRange = defaultRange * scale.scaleX;
      
      const center = (topicData.topic.defaultViewport.startYear + topicData.topic.defaultViewport.endYear) / 2;
      
      setViewport({
        startYear: center - (scaledRange / 2),
        endYear: center + (scaledRange / 2)
      });
    }
  }, [topicData?.topic, scale.scaleX]);

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
        return { startYear: streamCenter - range / 2, endYear: streamCenter + range / 2 };
      }
      return prev;
    });

    // Send focus signal to DetailPanel
    setFocusSection({ id: stream.id, ts: Date.now() });
  }, []);
  
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

  const lastMouseX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Clamp zoom
    const minZoom = topicData?.topic?.minZoomRange || MIN_ZOOM_RANGE;
    const maxZoom = topicData?.topic?.maxZoomRange || MAX_ZOOM_RANGE;
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

    setViewport({
      startYear: newStart,
      endYear: newEnd
    });
  };

  // --- Pan Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.detail-panel')) return;
    setIsDragging(true);
    lastMouseX.current = e.clientX;
  };

  const rafRef = useRef<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const currentX = e.clientX;
    
    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const { width } = container.getBoundingClientRect();
      const deltaPixels = lastMouseX.current - currentX;
      
      // Convert pixels to years
      const currentRange = viewport.endYear - viewport.startYear;
      const yearsPerPixel = currentRange / width;
      const deltaYears = deltaPixels * yearsPerPixel;

      setViewport(prev => ({
        startYear: prev.startYear + deltaYears,
        endYear: prev.endYear + deltaYears
      }));

      lastMouseX.current = currentX;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // --- Manual Controls ---
  const manualZoom = (direction: 'in' | 'out') => {
    const currentRange = viewport.endYear - viewport.startYear;
    const factor = direction === 'in' ? 0.8 : 1.25;
    let newRange = currentRange * factor;
    
    // Clamp zoom
    const minZoom = topicData?.topic?.minZoomRange || MIN_ZOOM_RANGE;
    const maxZoom = topicData?.topic?.maxZoomRange || MAX_ZOOM_RANGE;
    if (newRange < minZoom) newRange = minZoom;
    if (newRange > maxZoom) newRange = maxZoom;

    const center = (viewport.startYear + viewport.endYear) / 2;
    const newStart = center - (newRange / 2);
    const newEnd = center + (newRange / 2);

    setViewport({ startYear: newStart, endYear: newEnd });
  };

  // Prevent generic wheel scrolling on body
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.body.addEventListener('wheel', preventDefault, { passive: false });
    return () => document.body.removeEventListener('wheel', preventDefault);
  }, []);

  // Determine precision for display
  const range = viewport.endYear - viewport.startYear;
  const precision = range < 1 ? (range < 0.1 ? 'day' : 'month') : 'year';

  // --- Level of Detail (LOD) Filtering ---
  const visibleEvents = useMemo(() => {
    if (!topicData) return [];
    // Normalize range based on screen width so LOD feels consistent across devices
    const normalizedRange = range / scale.scaleX;
    
    return topicData.events.filter(event => {
      const importance = event.importance || 1; // Default to 1 (always visible) if not specified
      const threshold = IMPORTANCE_THRESHOLDS[importance] || Infinity;
      return normalizedRange <= threshold;
    });
  }, [topicData, range, scale.scaleX]);

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
          <div className="flex items-center gap-6 text-sm text-gray-400 font-serif">
             <span className="hidden md:inline italic opacity-80">Scroll to Zoom / Drag to Pan (滚动缩放 / 拖动平移)</span>
             <div className="flex gap-0 border border-gray-600 rounded overflow-hidden">
               <button onClick={() => manualZoom('out')} className="p-2 bg-[#2a2a2a] hover:bg-[#333] hover:text-white transition border-r border-gray-600" title="Zoom Out"><ZoomOut size={18}/></button>
               <button onClick={() => manualZoom('in')} className="p-2 bg-[#2a2a2a] hover:bg-[#333] hover:text-white transition" title="Zoom In"><ZoomIn size={18}/></button>
             </div>
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
          {/* Auto-play Indicator */}
          {isAutoPlaying && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 z-50 animate-pulse pointer-events-none">
              <Play size={16} className="text-green-400 fill-green-400" />
              {countdown !== null 
                ? `Switching topic in ${countdown}...` 
                : 'Auto-Playing... (Interact to stop)'}
            </div>
          )}

          {/* Main Visualization Area (Top Half) */}
          <div 
            ref={containerRef}
            className={`flex-none relative w-full h-[55%] bg-[#fdfdfd] border-b-4 border-gray-800 shadow-xl overflow-hidden cursor-move ${isDragging ? 'cursor-grabbing' : ''}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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
                streams={topicData.streams}
                events={visibleEvents}
                scaleX={scale.scaleX}
                scaleY={scale.scaleY}
                onEventClick={setSelectedEvent}
                onMovementHover={setHoveredMovement}
                onMovementClick={handleMovementClick}
                onEventHover={setHoveredEvent}
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
                streams={topicData.streams}
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