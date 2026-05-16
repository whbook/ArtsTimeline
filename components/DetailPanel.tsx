import React, { useRef, useEffect } from 'react';
import { Viewport, TimelineEvent, Topic, Period } from '../types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { BASE_COLUMN_WIDTH } from '../constants';

interface DetailPanelProps {
  topic: Topic;
  periods: Period[];
  events: TimelineEvent[];
  viewport: Viewport;
  scaleX: number;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null) => void;
}

// A sub-component for each period column to handle its own virtualization
const PeriodColumn: React.FC<{
  era: Period;
  topic: Topic;
  isActive: boolean;
  events: TimelineEvent[];
  columnWidth: number;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null) => void;
}> = ({ era, topic, isActive, events, columnWidth, onEventClick, onEventHover }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Increased estimated height to prevent overlap with dynamic fields
    overscan: 5,
  });

  return (
    <div 
      className={`flex-shrink-0 border-r border-gray-300 flex flex-col transition-all duration-300 bg-white`}
      style={{ width: `${columnWidth}px` }}
    >
      {/* Header: Filled Background Color */}
      <div 
          className="p-4 shadow-sm relative overflow-hidden"
          style={{ backgroundColor: era.colorHex }}
      >
          {/* Decorative Overlay */}
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <span className="text-6xl font-serif font-black text-white">{era.nameEn.charAt(0)}</span>
          </div>

          <h3 className="font-serif font-bold text-lg leading-tight text-white relative z-10 drop-shadow-md">
              {era.nameEn} {era.nameCn && <span className="text-sm ml-1 opacity-90">{era.nameCn}</span>}
          </h3>
          <div className="flex items-center gap-2 mt-2 relative z-10">
              <div className="px-2 py-0.5 rounded bg-white/20 text-white text-xs font-mono backdrop-blur-sm border border-white/10">
                  {era.startYear < 0 ? `${Math.abs(era.startYear)} BCE` : era.startYear} — {era.endYear < 0 ? `${Math.abs(era.endYear)} BCE` : era.endYear}
              </div>
          </div>
      </div>
      
      {/* Event List (Virtual) */}
      <div 
        ref={parentRef}
        className={`p-4 overflow-y-auto flex-1 ${isActive ? 'opacity-100' : 'opacity-60 grayscale-[0.5]'}`}
        style={{ contentVisibility: 'auto' }} // Performance optimization for off-screen columns
      >
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
                           {event.year}
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
      </div>
    </div>
  );
};

const DetailPanel: React.FC<DetailPanelProps> = ({ topic, periods, events, viewport, scaleX, onEventClick, onEventHover }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dynamically calculate column width based on screen scale
  // On a 5-monitor setup (e.g. scaleX = 5), columns will be wider
  const COLUMN_WIDTH = Math.max(BASE_COLUMN_WIDTH, BASE_COLUMN_WIDTH * Math.min(scaleX, 2.5));

  useEffect(() => {
    if (!containerRef.current || periods.length === 0) return;

    const range = viewport.endYear - viewport.startYear;
    const centerYear = viewport.startYear + range / 2;
    const screenWidth = window.innerWidth;

    let activeIndex = periods.findIndex(p => p.startYear <= centerYear && p.endYear > centerYear);
    if (activeIndex === -1) {
      if (centerYear < periods[0].startYear) activeIndex = 0;
      else activeIndex = periods.length - 1;
    }

    const activePeriod = periods[activeIndex];
    const pxToLeft = ((centerYear - activePeriod.startYear) / range) * screenWidth;
    const pxToRight = ((activePeriod.endYear - centerYear) / range) * screenWidth;

    let targetXCenter = activeIndex * COLUMN_WIDTH + (COLUMN_WIDTH / 2);

    if (pxToLeft < COLUMN_WIDTH / 2 && activeIndex > 0) {
      targetXCenter = activeIndex * COLUMN_WIDTH + pxToLeft;
    } else if (pxToRight < COLUMN_WIDTH / 2 && activeIndex < periods.length - 1) {
      targetXCenter = (activeIndex + 1) * COLUMN_WIDTH - pxToRight;
    }

    const targetScrollLeft = targetXCenter - (COLUMN_WIDTH / 2);
    containerRef.current.scrollLeft = targetScrollLeft;
  }, [viewport, periods]);

  const range = viewport.endYear - viewport.startYear;
  const centerYear = viewport.startYear + range / 2;
  let activeIndex = periods.findIndex(p => p.startYear <= centerYear && p.endYear > centerYear);
  if (activeIndex === -1 && periods.length > 0) {
    if (centerYear < periods[0].startYear) activeIndex = 0;
    else activeIndex = periods.length - 1;
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex overflow-x-auto custom-scrollbar bg-[#f8f8f5]"
      style={{ paddingLeft: `calc(50vw - ${COLUMN_WIDTH / 2}px)`, paddingRight: `calc(50vw - ${COLUMN_WIDTH / 2}px)` }}
    >
      {periods.map((era, index) => {
        const isActive = index === activeIndex;
        const eraEvents = events.filter(e => e.periodId === era.id);
        
        return (
          <PeriodColumn 
            key={era.id}
            era={era}
            topic={topic}
            isActive={isActive}
            events={eraEvents}
            columnWidth={COLUMN_WIDTH}
            onEventClick={onEventClick}
            onEventHover={onEventHover}
          />
        );
      })}
    </div>
  );
};

export default DetailPanel;