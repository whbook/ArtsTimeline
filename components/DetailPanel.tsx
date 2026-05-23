import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Viewport, TimelineEvent, Topic, Period, Swimlane, FuzzyDate } from '../types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BASE_COLUMN_WIDTH } from '../constants';
import { getDecimalYear, formatFuzzyDate } from '../utils';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import EventImage from './EventImage';
import DescriptionText from './DescriptionText';

interface DetailPanelProps {
  topic: Topic;
  periods: Period[];
  swimlanes: Swimlane[];
  events: TimelineEvent[];
  viewport: Viewport;
  scaleX: number;
  focusSection?: { id: string; ts: number } | null;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null) => void;
}

type SectionData = {
  id: string;
  type: 'period' | 'swimlane';
  nameEn: string;
  nameCn?: string;
  start: FuzzyDate;
  end: FuzzyDate;
  color: string;
  descriptionCn?: string;
  descriptionEn?: string;
};

type RenderedSection = SectionData & { state: 'entering' | 'entered' | 'exiting' };

const EventDetailPane: React.FC<{
  topic: Topic;
  events: TimelineEvent[];
}> = ({ topic, events }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (events.length > 0) {
      if (!activeId || !events.some(e => e.id === activeId)) {
        setActiveId(events[0].id);
      }
    } else {
      setActiveId(null);
    }
  }, [events, activeId]);

  if (events.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white/70 px-8 text-center shadow-inner">
        <div className="mb-3 font-serif text-2xl font-bold text-stone-700">作品详情</div>
        <p className="max-w-sm text-sm leading-relaxed text-stone-500">
          将时间线拖动到红色中心线附近，进入中心区域的作品会在这里显示与弹窗一致的详情信息。
        </p>
      </div>
    );
  }

  const activeEvent = events.find(e => e.id === activeId) || events[0];
  const event = activeEvent;

  const titleCn = event.titleCn?.trim();
  const titleEn = event.titleEn?.trim();
  const displayTitle = titleCn || titleEn || '';
  const subtitle = titleCn && titleEn && titleCn !== titleEn ? titleEn : null;
  const descEn = event.descriptionEn;
  const descCn = event.descriptionCn;
  const highlightedFieldKeys = ['dynasty', 'traditionalDate'];
  const getEventFieldValue = (key: string) => {
    const value = (event as any)[key] || (event.meta && event.meta[key]);
    return Array.isArray(value) ? value.join('、') : value;
  };
  const highlightedFields = highlightedFieldKeys
    .map(key => {
      const field = topic.eventFields.find(item => item.key === key);
      const value = getEventFieldValue(key);
      return field && value ? { field, value } : null;
    })
    .filter((item): item is { field: typeof topic.eventFields[number]; value: string | number } => !!item);
  const remainingFields = topic.eventFields.filter(field => !highlightedFieldKeys.includes(field.key));

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      {events.length > 1 && (
        <div className="flex items-center border-b border-stone-100 bg-stone-50/50 px-4 pt-2 gap-1 overflow-x-auto custom-scrollbar shrink-0">
          {events.map((evt, idx) => {
            const isSelected = evt.id === activeEvent.id;
            const title = evt.titleCn?.trim() || evt.titleEn?.trim() || `作品 ${idx + 1}`;
            return (
              <button
                key={evt.id}
                onClick={() => setActiveId(evt.id)}
                className={`px-4 py-2 text-xs font-serif font-bold transition-all rounded-t-md border-t border-x -mb-px shrink-0 select-none relative focus:outline-none ${
                  isSelected
                    ? 'bg-white border-stone-200 text-stone-950 shadow-sm'
                    : 'bg-transparent border-transparent text-stone-400 hover:text-stone-700 hover:bg-stone-100/50'
                }`}
              >
                <span className="truncate max-w-[120px] block">{title}</span>
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-800 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="border-b border-stone-100 bg-stone-50/80 p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-stone-400">
          Artwork Detail / 作品详情
        </div>
        <h2 className="font-serif text-2xl font-bold leading-tight text-stone-900">{displayTitle}</h2>
        {subtitle && <h3 className="mt-1 text-sm text-stone-500">{subtitle}</h3>}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-80 flex-none items-center justify-center overflow-hidden border-r border-stone-100 bg-white p-4">
          <EventImage
            src={event.imageUrl}
            alt={displayTitle}
            eager
            className="aspect-square h-full max-h-full max-w-full overflow-hidden rounded-md border border-stone-200 bg-stone-50 shadow-sm"
            imgClassName="object-cover object-center"
          />
        </div>

        <div className="section-scrollbar min-w-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 grid grid-cols-3 gap-2 border-b border-stone-100 pb-4">
            <div className="min-w-0 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Date / 时间</span>
              <p className="truncate text-lg font-bold text-stone-900">{formatFuzzyDate(event.date)}</p>
            </div>
            {highlightedFields.map(({ field, value }) => (
              <div key={field.key} className="min-w-0 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  {field.labelEn} / {field.labelCn}
                </span>
                <p className="truncate text-sm font-medium text-stone-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-stone-100 pb-4 lg:grid-cols-2">
            {remainingFields.map(field => {
              let value = (event as any)[field.key] || (event.meta && event.meta[field.key]);
              if (!value) return null;
              if (Array.isArray(value)) value = value.join('、');

              return (
                <div key={field.key} className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    {field.labelEn} / {field.labelCn}
                  </span>
                  <p className="truncate text-sm font-medium text-stone-900">{value}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-4">
            {descEn && (
              <div>
                <h4 className="mb-1 font-bold text-stone-800">Description</h4>
                <DescriptionText value={descEn} />
              </div>
            )}
            {descCn && (
              <div>
                <h4 className="mb-1 font-bold text-stone-800">简介</h4>
                <DescriptionText value={descCn} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

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
    estimateSize: () => 132, 
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
          {section.descriptionCn && topic.id !== 'chinese-calligraphy-history' && (
            <div className="mt-2 text-white/90 text-xs leading-relaxed max-h-32 overflow-y-auto custom-scrollbar pr-2 relative z-10">
              {section.descriptionCn}
            </div>
          )}
      </div>
      
      {/* Event List (Virtual) */}
      <div 
        ref={parentRef}
        className="p-4 overflow-y-auto flex-1 min-w-max section-scrollbar"
        style={{
          width: `${columnWidth}px`,
          '--section-color': section.color,
        } as React.CSSProperties}
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
              const titleCn = event.titleCn?.trim();
              const titleEn = event.titleEn?.trim();
              const displayTitle = titleCn || titleEn || '';
              const subtitle = titleCn && titleEn && titleCn !== titleEn ? titleEn : null;
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
                    
                    <div className="mb-2 flex gap-3">
                      <EventImage
                        src={event.imageUrl}
                        alt={displayTitle}
                        className="h-24 w-24 shrink-0 rounded-md border border-stone-200 shadow-sm"
                        imgClassName="group-hover:scale-105"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex justify-between items-baseline">
                            <h4 className="font-serif font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors leading-tight">
                                {displayTitle}
                            </h4>
                            <span className="text-[10px] font-mono text-gray-400 shrink-0 ml-2">
                               {formatFuzzyDate(event.date)}
                            </span>
                        </div>
                        {subtitle && <span className="text-xs text-gray-500 font-sans mt-0.5">{subtitle}</span>}
                        <div className="mt-2 space-y-1">
                          {/* Dynamic Fields based on topic config */}
                          {topic.eventFields.map(field => {
                            let value = (event as any)[field.key] || (event.meta && event.meta[field.key]);
                            if (!value) return null;
                            if (Array.isArray(value)) value = value.join('、');
                            
                            return (
                              <p key={field.key} className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 truncate">
                                 <span className="opacity-60 mr-1">{field.labelEn}:</span>
                                 {value}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    </div>
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

const DetailPanel: React.FC<DetailPanelProps> = ({ topic, periods, swimlanes, events, viewport, scaleX, focusSection, onEventClick, onEventHover }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag to scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [leftPaneMaxWidthPercent, setLeftPaneMaxWidthPercent] = useState(50);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
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

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const nextWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPaneMaxWidthPercent(Math.min(50, Math.max(24, nextWidth)));
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);
  
  const hasImageEvents = useMemo(() => events.some(event => !!event.imageUrl), [events]);
  const baseColumnWidth = hasImageEvents ? BASE_COLUMN_WIDTH + 120 : BASE_COLUMN_WIDTH;
  // Dynamically calculate column width based on screen scale; image-heavy exhibits need more room for metadata.
  const COLUMN_WIDTH = Math.max(baseColumnWidth, baseColumnWidth * Math.min(scaleX, 2.5));

  const range = viewport.endYear - viewport.startYear;
  const centerYear = viewport.startYear + range / 2;

  const centeredEvents = useMemo(() => {
    if (events.length === 0 || range <= 0) return [];

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const centerBandYears = (range / Math.max(viewportWidth, 1)) * 72;
    const minBandYears = range * 0.005;
    const thresholdYears = Math.max(centerBandYears, minBandYears);

    // 找出所有在阈值范围内的作品
    const matches = events
      .map(event => {
        const distance = Math.abs(getDecimalYear(event.date) - centerYear);
        return { event, distance };
      })
      .filter(item => item.distance <= thresholdYears)
      .sort((a, b) => a.distance - b.distance) // 按距离从小到大排序
      .map(item => item.event);

    return matches;
  }, [events, centerYear, range]);

  const [displayedEvents, setDisplayedEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    setDisplayedEvents(prev => {
      if (centeredEvents.length > 0) return centeredEvents;
      
      // 检查 prev 中的作品是否仍在当前的 events 列表中
      const validPrev = prev.filter(p => events.some(event => event.id === p.id));
      if (validPrev.length > 0) return validPrev;
      
      return [];
    });
  }, [centeredEvents, events]);

  // 动态计算当前红线位置激活的所有区块（仅限泳道 Swimlane，不再显示大期 Period）
  const activeSections = React.useMemo(() => {
    const active: SectionData[] = [];
    
    // 仅添加当前激活的泳道 (Swimlane)
    swimlanes.forEach(s => {
      const start = getDecimalYear(s.start);
      const end = getDecimalYear(s.end);
      if (centerYear >= start && centerYear <= end) {
        active.push({
          id: s.id,
          type: 'swimlane',
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

    // 排序：泳道按开始时间排序
    return active.sort((a, b) => {
      return getDecimalYear(a.start) - getDecimalYear(b.start);
    });
  }, [swimlanes, centerYear]);

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

  const autoLeftPaneWidth = useMemo(() => {
    const activeColumnCount = renderedSections.filter(section => section.state !== 'exiting').length;
    if (activeColumnCount === 0) return 0;

    const PADDING = 16 * 2;
    const GAP = 16;
    return PADDING + (activeColumnCount * COLUMN_WIDTH) + ((activeColumnCount - 1) * GAP);
  }, [renderedSections, COLUMN_WIDTH]);
  const hasLanePane = autoLeftPaneWidth > 0;

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

  useEffect(() => {
    const timer = window.setTimeout(checkScroll, 550);
    return () => window.clearTimeout(timer);
  }, [autoLeftPaneWidth, leftPaneMaxWidthPercent]);

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
    <div
      ref={splitContainerRef}
      className={`relative flex h-full w-full bg-[#f4f4f4] ${isResizing ? 'select-none' : ''}`}
    >
      {hasLanePane && (
        <div
          className="relative h-full min-w-0 transition-[width] duration-500 ease-in-out"
          style={{ width: `min(${leftPaneMaxWidthPercent}%, ${autoLeftPaneWidth}px)` }}
        >
          {/* Left Scroll Button */}
          {canScrollLeft && (
            <button
              onClick={(e) => { e.stopPropagation(); scrollByAmount('left'); }}
              className="absolute left-2 top-1/2 z-50 -translate-y-1/2 rounded-full border border-gray-200 bg-white/80 p-2 text-gray-800 shadow-md backdrop-blur-sm transition-all animate-in fade-in hover:bg-white"
              aria-label="Scroll left"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* Right Scroll Button */}
          {canScrollRight && (
            <button
              onClick={(e) => { e.stopPropagation(); scrollByAmount('right'); }}
              className="absolute right-2 top-1/2 z-50 -translate-y-1/2 rounded-full border border-gray-200 bg-white/80 p-2 text-gray-800 shadow-md backdrop-blur-sm transition-all animate-in fade-in hover:bg-white"
              aria-label="Scroll right"
            >
              <ChevronRight size={24} />
            </button>
          )}

          <div
            ref={containerRef}
            className={`h-full w-full flex overflow-x-auto custom-scrollbar bg-[#f8f8f5] p-4 gap-4 ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseLeave={() => { handleMouseLeave(); checkScroll(); }}
            onMouseUp={() => { handleMouseUp(); checkScroll(); }}
            onMouseMove={handleMouseMove}
            onScroll={checkScroll}
          >
            {renderedSections.map((section) => {
              // 过滤事件：只显示分配给该 Swimlane 的事件
              const sectionEvents = events.filter(e => e.swimlaneId === section.id);

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
      )}

      {hasLanePane && (
        <button
          type="button"
          className="group relative z-40 flex h-full w-2 flex-none cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-stone-200/40"
          onMouseDown={handleResizeStart}
          aria-label="Resize detail split"
        >
          <span className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 rounded-full bg-stone-300/70 transition-colors group-hover:bg-stone-500/80" />
          <span className="relative flex h-10 w-3 items-center justify-center rounded-full border border-stone-300/70 bg-[#f8f8f5]/90 text-stone-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <GripVertical size={12} strokeWidth={1.5} />
          </span>
        </button>
      )}

      <div className={`h-full min-w-0 flex-1 bg-[#f8f8f5] p-4 ${hasLanePane ? 'pl-0' : 'pl-4'}`}>
        <EventDetailPane topic={topic} events={displayedEvents} />
      </div>
    </div>
  );
};

export default DetailPanel;