import React from 'react';
import { Viewport, Stream, TimelineEvent, Period } from '../types';

interface TimelineCanvasProps {
  viewport: Viewport;
  periods: Period[];
  streams: Stream[];
  events: TimelineEvent[];
  scaleX: number;
  scaleY: number;
  onEventClick: (event: TimelineEvent) => void;
  onMovementHover: (movement: Stream | null) => void;
  onEventHover: (event: TimelineEvent | null) => void;
}

const TimelineCanvas: React.FC<TimelineCanvasProps> = ({ 
    viewport, 
    periods,
    streams,
    events,
    scaleX,
    scaleY,
    onEventClick,
    onMovementHover,
    onEventHover 
}) => {
  const { startYear, endYear } = viewport;
  const range = endYear - startYear;

  const getPercentage = (year: number) => {
    return ((year - startYear) / range) * 100;
  };

  const getStyle = (movement: Stream) => {
    const startPerc = getPercentage(movement.startYear);
    const endPerc = getPercentage(movement.endYear);
    const durationPerc = endPerc - startPerc;
    
    // Ensure minimal visibility
    const finalWidth = Math.max(durationPerc, 0.2); 

    // Swimlane logic: 
    // Scale lane height based on screen height to utilize vertical space on large displays
    const laneHeight = 28 * Math.max(1, scaleY * 0.8);
    const topPadding = 30 * Math.max(1, scaleY);
    const topPos = topPadding + (movement.lane * laneHeight); 

    // Gradient Logic:
    // We use 8-digit Hex codes for transparency (supported in modern browsers).
    // Assumes movement.color is a 6-digit hex string (e.g. #FF0000).
    // 00 = 0% opacity, FF = 100% opacity.
    const c = movement.color;
    // Gradient: Transparent -> Solid (10%) -> Solid (90%) -> Transparent
    const background = `linear-gradient(90deg, ${c}00 0%, ${c}FF 10%, ${c}FF 90%, ${c}00 100%)`;

    return {
      left: 0,
      width: `${finalWidth}vw`,
      top: `${topPos}px`,
      height: '24px', 
      background: background,
      transform: `translate3d(${startPerc}vw, 0, 0)`,
      willChange: 'transform'
    };
  };

  return (
    <div className="absolute top-12 left-0 w-full h-[400px] overflow-hidden pointer-events-none z-10">
      
      {/* LAYER 1: Era Background Blocks */}
      <div className="absolute inset-0 w-full h-full flex pointer-events-none opacity-50">
        {periods.map((era) => {
            const startP = getPercentage(era.startYear);
            const endP = getPercentage(era.endYear);
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
                    <div className="absolute bottom-10 left-2 pointer-events-none opacity-10">
                         <div 
                            className="font-serif font-black text-black leading-none whitespace-nowrap"
                            style={{ fontSize: `${50 * Math.max(1, scaleX * 0.8)}px` }}
                         >
                            {era.nameEn}
                         </div>
                         <div 
                            className="font-serif font-bold text-black leading-none whitespace-nowrap mt-2"
                            style={{ fontSize: `${30 * Math.max(1, scaleX * 0.8)}px` }}
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
        if (movement.endYear < startYear || movement.startYear > endYear) return null;

        const style = getStyle(movement);
        const engName = movement.nameEn;
        const cnName = movement.nameCn;

        return (
          <div
            key={movement.id}
            onMouseEnter={() => onMovementHover(movement)}
            onMouseLeave={() => onMovementHover(null)}
            // Removed side borders (border-white/20) and replaced with border-y (top/bottom) only
            // Added 'justify-center' to center text
            className="absolute rounded-sm border-y border-white/20 flex items-center justify-center px-4 hover:scale-[1.02] hover:z-50 transition-all duration-200 cursor-help pointer-events-auto group overflow-hidden"
            style={style}
          >
            {/* Show label - Prioritize Chinese if space is tight? Or both separated */}
            <div className="flex items-center gap-1 text-[9px] font-bold text-white whitespace-nowrap drop-shadow-sm font-sans tracking-wide">
              <span>{engName}</span>
              {cnName && <span className="opacity-90 font-normal border-l border-white/30 pl-1">{cnName}</span>}
            </div>
            
            {/* Popover on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-xs p-3 rounded shadow-xl z-50 whitespace-nowrap">
              <strong className="font-serif text-sm block mb-1">{engName} {cnName}</strong>
              <span className="text-gray-300 font-mono text-[10px]">
                {movement.startYear < 0 ? `${Math.abs(movement.startYear)} BCE` : movement.startYear} — {movement.endYear}
              </span>
            </div>
          </div>
        );
      })}

      {/* LAYER 3: Specific Events Markers */}
      {events.map(event => {
        const pos = getPercentage(event.year);
        if (pos < -2 || pos > 102) return null;
        
        const engLabel = event.titleEn;
        const cnLabel = event.titleCn;
        const era = periods.find(p => p.id === event.periodId);
        const colorHex = era?.colorHex || '#999';

        return (
                <div 
                    key={`evt-${event.id}-${event.year}`}
                    onClick={() => onEventClick(event)}
                    onMouseEnter={() => onEventHover(event)}
                    onMouseLeave={() => onEventHover(null)}
                    className="absolute flex flex-col items-center group pointer-events-auto cursor-pointer z-20"
                    style={{ 
                        top: `calc(100% - ${60 * Math.max(1, scaleY)}px)`, // Position from bottom instead of fixed top
                        left: 0, 
                        transform: `translate3d(calc(${pos}vw - 50%), 0, 0)`,
                        willChange: 'transform'
                    }}
                >
                {/* The Dot */}
                <div 
                    className="w-3 h-3 rounded-full border-2 border-white shadow-md group-hover:scale-150 transition-transform group-hover:bg-white"
                    style={{ backgroundColor: colorHex }}
                ></div>
                
                {/* The Label */}
                <div className="mt-2 flex flex-col items-center opacity-70 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-1.5 py-1 rounded border border-gray-100 shadow-sm text-center">
                    <span className="text-[9px] font-bold text-gray-800 whitespace-nowrap block leading-tight">{engLabel}</span>
                    {cnLabel && <span className="text-[9px] font-medium text-gray-600 whitespace-nowrap block leading-tight scale-90">{cnLabel}</span>}
                    <span className="text-[8px] text-gray-400 font-mono block mt-0.5">{event.year}</span>
                </div>
            </div>
        )
      })}

    </div>
  );
};

export default TimelineCanvas;