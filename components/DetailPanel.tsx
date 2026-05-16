import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Viewport, TimelineEvent, Topic, Period, Stream, FuzzyDate } from '../types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BASE_COLUMN_WIDTH } from '../constants';
import { getDecimalYear, formatFuzzyDate } from '../utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DetailPanelProps {
  topic: Topic;
  periods: Period[];
  streams: Stream[];
  events: TimelineEvent[];
  viewport: Viewport;
  scaleX: number;
  focusSection?: { id: string; ts: number } | null;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null) => void;
}

type SectionData = {
  id: string;
  type: 'period' | 'stream';
  nameEn: string;
  nameCn?: string;
  start: FuzzyDate;
  end: FuzzyDate;
  color: string;
  descriptionCn?: string;
  descriptionEn?: string;
};

type RenderedSection = SectionData & { state: 'entering' | 'entered' | 'exiting' };

// A sub-component for each active section column
const SectionColumn: React.FC<{
  section: RenderedSection;
  topic: Topic;
  events: TimelineEvent[];
  columnWidth: number;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null) => void;
  onRemove: (id: string) => void;
}> = ({ section, topic, events, columnWidth, onEventClick, onEventHover, onRemove }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, 
    overscan: 5,
  });

  return (
    <div 
      className={`flex-shrink-0 border-gray-300 flex flex-col bg-white transition-all duration-700 ease-in-out transform origin-bottom overflow-hidden ${
        section.state === 'entered' ? 'scale-100 translate-y-0 border-r' : 'scale-95 translate-y-8 pointer-events-none border-r-0'
      }`}
      style={{ 
        width: section.state === 'exiting' ? '0px' : `${columnWidth}px`,
        minWidth: section.state === 'exiting' ? '0px' : undefined,
        opacity: section.state === 'entered' ? 1 : 0,
        marginRight: section.state === 'exiting' ? '0px' : undefined
      }}
      onTransitionEnd={(e) => {
        // Wait for the width transition to finish before removing from DOM
        if (e.propertyName === 'width' && section.state === 'exiting') {
          onRemove(section.id);
        }
      }}
    >
      {/* Header: Filled Background Color */}
      <div 
          className="p-4 shadow-sm relative flex flex-col gap-2 min-w-max"
          style={{ backgroundColor: section.color, width: `${columnWidth}px` }}
      >
          {/* Decorative Overlay */}
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <span className="text-6xl font-serif font-black text-white">{section.nameEn.charAt(0)}</span>
          </div>

          <h3 className="font-serif font-bold text-lg leading-tight text-white relative z-10 drop-shadow-md">
              {section.nameEn} {section.nameCn && <span className="text-sm ml-1 opacity-90">{section.nameCn}</span>}
          </h3>
          <div className="flex items-center gap-2 relative z-10">
              <div className="px-2 py-0.5 rounded bg-white/20 text-white text-xs font-mono backdrop-blur-sm border border-white/10">
                  {formatFuzzyDate(section.start)} — {formatFuzzyDate(section.end)}
              </div>
          </div>
          
          {/* Description for Streams */}
          {section.descriptionCn && (
            <div className="mt-2 text-white/90 text-xs leading-relaxed max-h-32 overflow-y-auto custom-scrollbar pr-2 relative z-10">
              {section.descriptionCn}
            </div>
          )}
      </div>
      
      {/* Event List (Virtual) */}
      <div 
        ref={parentRef}
        className="p-4 overflow-y-auto flex-1 min-w-max"
        style={{ width: `${columnWidth}px` }}
      >
        {events.length === 0 ? (
          <div className="text-gray-400 text-sm italic text-center mt-10">
            暂无具体事件记录 / No specific events recorded.
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const event = events[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '16px' // Spacing between cards
                  }}
                >
                  <div 
                      onClick={() => onEventClick(event)}
                      onMouseEnter={() => onEventHover(event)}
                      onMouseLeave={() => onEventHover(null)}
                      className="relative pl-4 border-l-2 border-gray-200 hover:border-gray-500 transition-all group cursor-pointer h-full"
                  >
                    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-gray-300 group-hover:bg-gray-800 transition-colors"></div>
                    
                    <div className="flex flex-col mb-1">
                      <div className="flex justify-between items-baseline">
                          <h4 className="font-serif font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors leading-tight">
                              {event.titleEn}
                          </h4>
                          <span className="text-[10px] font-mono text-gray-400 shrink-0 ml-2">
                             {formatFuzzyDate(event.date)}
                          </span>
                      </div>
                      {event.titleCn && <span className="text-xs text-gray-500 font-sans mt-0.5">{event.titleCn}</span>}
                    </div>
                    
                    {/* Dynamic Fields based on topic config */}
                    {topic.eventFields.map(field => {
                      let value = (event as any)[field.key] || (event.meta && event.meta[field.key]);
                      if (!value) return null;
                      
                      return (
                        <p key={field.key} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 mt-1 truncate">
                           <span className="opacity-60 mr-1">{field.labelEn}:</span>
                           {value}
                        </p>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const DetailPanel: React.FC<DetailPanelProps> = ({ topic, periods, streams, events, viewport, scaleX, focusSection, onEventClick, onEventHover }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag to scroll state
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault(); // Prevent text selection while dragging
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };
  
  // Dynamically calculate column width based on screen scale
  const COLUMN_WIDTH = Math.max(BASE_COLUMN_WIDTH, BASE_COLUMN_WIDTH * Math.min(scaleX, 2.5));

  const range = viewport.endYear - viewport.startYear;
  const centerYear = viewport.startYear + range / 2;

  // 动态计算当前红线位置激活的所有区块（仅限流派 Stream，不再显示大时代 Period）
  const activeSections = React.useMemo(() => {
    const active: SectionData[] = [];
    
    // 仅添加当前激活的流派 (Stream)
    streams.forEach(s => {
      const start = getDecimalYear(s.start);
      const end = getDecimalYear(s.end);
      if (centerYear >= start && centerYear <= end) {
        active.push({
          id: s.id,
          type: 'stream',
          nameEn: s.nameEn,
          nameCn: s.nameCn,
          start: s.start,
          end: s.end,
          color: s.color,
          descriptionCn: s.descriptionCn,
          descriptionEn: s.descriptionEn
        });
      }
    });

    // 排序：流派按开始时间排序
    return active.sort((a, b) => {
      return getDecimalYear(a.start) - getDecimalYear(b.start);
    });
  }, [streams, centerYear]);

  const [renderedSections, setRenderedSections] = useState<RenderedSection[]>([]);

  useEffect(() => {
    setRenderedSections(prev => {
      const next = [...prev];
      let changed = false;

      // Mark removed as exiting
      next.forEach(item => {
        if (!activeSections.find(a => a.id === item.id) && item.state !== 'exiting') {
          item.state = 'exiting';
          changed = true;
        }
      });

      // Add new ones or cancel exit
      activeSections.forEach(active => {
        const existing = next.find(n => n.id === active.id);
        if (existing) {
          if (existing.state === 'exiting') {
            existing.state = 'entering'; // Cancel exit
            changed = true;
          }
          // Update data just in case
          existing.start = active.start;
          existing.end = active.end;
        } else {
          next.push({ ...active, state: 'entering' });
          changed = true;
        }
      });

      if (!changed) return prev;
      
      // Sort them based on start year to maintain order even during exit
      return next.sort((a, b) => getDecimalYear(a.start) - getDecimalYear(b.start));
    });
  }, [activeSections]);

  // To trigger the 'entered' state after 'entering' mounts
  useEffect(() => {
    const enteringSections = renderedSections.filter(s => s.state === 'entering');
    if (enteringSections.length > 0) {
      const timer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRenderedSections(prev => prev.map(s => s.state === 'entering' ? { ...s, state: 'entered' } : s));
        });
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [renderedSections]);

  const handleRemove = (id: string) => {
    setRenderedSections(prev => prev.filter(s => !(s.id === id && s.state === 'exiting')));
  };

  // --- Focus Section Logic ---
  const lastFocusTs = useRef<number>(0);

  useEffect(() => {
    if (focusSection && focusSection.ts !== lastFocusTs.current && containerRef.current) {
      // Find the index of the focused section in the currently rendered sections
      const index = renderedSections.findIndex(s => s.id === focusSection.id);
      
      if (index !== -1) {
        const containerWidth = containerRef.current.clientWidth;
        // Calculate scroll position to center the column
        // The container has p-4 (16px padding) and gap-4 (16px gap between columns)
        const PADDING = 16;
        const GAP = 16;
        const itemOffsetLeft = PADDING + index * (COLUMN_WIDTH + GAP);
        const itemCenter = itemOffsetLeft + (COLUMN_WIDTH / 2);
        const targetScrollLeft = itemCenter - (containerWidth / 2);
        
        containerRef.current.scrollTo({ 
          left: targetScrollLeft, 
          behavior: 'smooth' 
        });
        
        lastFocusTs.current = focusSection.ts;
      }
    }
  }, [focusSection, renderedSections, COLUMN_WIDTH]);

  // --- Scroll Buttons Logic ---
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [activeSections]); // Re-check when content changes

  const scrollByAmount = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      const amount = containerRef.current.clientWidth * 0.8; // Scroll by 80% of container width
      containerRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth'
      });
      // checkScroll will be called by the onScroll event
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Left Scroll Button */}
      {canScrollLeft && (
        <button 
          onClick={(e) => { e.stopPropagation(); scrollByAmount('left'); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-50 p-2 bg-white/80 hover:bg-white text-gray-800 shadow-md border border-gray-200 rounded-full backdrop-blur-sm transition-all animate-in fade-in"
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Right Scroll Button */}
      {canScrollRight && (
        <button 
          onClick={(e) => { e.stopPropagation(); scrollByAmount('right'); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-50 p-2 bg-white/80 hover:bg-white text-gray-800 shadow-md border border-gray-200 rounded-full backdrop-blur-sm transition-all animate-in fade-in"
          aria-label="Scroll right"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <div 
        ref={containerRef}
        className={`w-full h-full flex overflow-x-auto custom-scrollbar bg-[#f8f8f5] p-4 gap-4 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={() => { handleMouseLeave(); checkScroll(); }}
        onMouseUp={() => { handleMouseUp(); checkScroll(); }}
        onMouseMove={handleMouseMove}
        onScroll={checkScroll}
      >
        {renderedSections.map((section) => {
        // 过滤事件：只显示分配给该 Stream 的事件
        const sectionEvents = events.filter(e => e.streamId === section.id);
        
        return (
          <SectionColumn 
            key={`stream-${section.id}`}
            section={section}
            topic={topic}
            events={sectionEvents}
            columnWidth={COLUMN_WIDTH}
            onEventClick={onEventClick}
            onEventHover={onEventHover}
            onRemove={handleRemove}
          />
        );
      })}
      </div>
    </div>
  );
};

export default DetailPanel;