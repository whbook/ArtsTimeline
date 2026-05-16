import React, { memo } from 'react';
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
}

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
    onEventHover 
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
            className="absolute rounded-sm hover:scale-[1.02] hover:z-50 transition-all duration-200 cursor-pointer pointer-events-auto group overflow-visible"
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

      {/* LAYER 3: Specific Events Markers */}
      {events.map(event => {
        const eventYear = getDecimalYear(event.date);
        const pos = getPercentage(eventYear);
        if (pos < -2 || pos > 102) return null;
        
        const engLabel = event.titleEn;
        const cnLabel = event.titleCn;
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

        const topPos = `calc(100% - ${60 * Math.max(1, scaleY)}px)`;

        return (
            <div 
                key={`evt-${event.id}-${eventYear}`}
                onClick={() => onEventClick(event)}
                onMouseEnter={() => onEventHover(event)}
                onMouseLeave={() => onEventHover(null)}
                className="absolute flex flex-col items-center group pointer-events-auto cursor-pointer z-20"
                style={{ 
                    top: topPos, // Position from bottom instead of fixed top
                    left: 0, 
                    transform: `translate3d(calc(${pos}vw - 50%), 0, 0)`,
                    willChange: 'transform'
                }}
            >
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
                <div className="mt-2 flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-1.5 py-1 rounded border border-gray-100 shadow-sm text-center">
                    <span className="text-[9px] font-bold text-gray-800 whitespace-nowrap block leading-tight">{engLabel}</span>
                    {cnLabel && <span className="text-[9px] font-medium text-gray-600 whitespace-nowrap block leading-tight scale-90">{cnLabel}</span>}
                    <span className="text-[8px] text-gray-400 font-mono block mt-0.5">{formatFuzzyDate(event.date)}</span>
                </div>
            </div>
        )
      })}

    </div>
  );
});

export default TimelineCanvas;