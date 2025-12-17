import React, { useMemo } from 'react';
import { Viewport, ArtMovement, TimelineEvent } from '../types';
import { decimalYearToDate, MONTHS, formatTimelineDate } from '../utils';

interface TimelineRulerProps {
  viewport: Viewport;
  hoveredMovement?: ArtMovement | null;
  hoveredEvent?: TimelineEvent | null;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({ viewport, hoveredMovement, hoveredEvent }) => {
  const { startYear, endYear } = viewport;
  const range = endYear - startYear;

  // Determine tick interval based on range (zoom level)
  const tickInterval = useMemo(() => {
    if (range > 10000) return 1000;
    if (range > 2000) return 500;
    if (range > 500) return 100;
    if (range > 100) return 20;
    if (range > 40) return 5;
    if (range > 10) return 1;
    // Sub-year intervals
    if (range > 2) return 0.25; // Quarter years (3 months)
    if (range > 0.5) return 1/12; // 1 month
    if (range > 0.1) return 1/52; // ~1 week
    return 1/365; // ~1 day
  }, [range]);

  // Generate ticks safer for floats
  const ticks = useMemo(() => {
    const ticksArr = [];
    const firstTick = Math.ceil(startYear / tickInterval) * tickInterval;
    // Limit number of ticks to prevent freezing if calculation goes wrong
    const count = Math.ceil((endYear - startYear) / tickInterval);
    const safeCount = Math.min(count, 500); 

    for (let i = 0; i <= safeCount; i++) {
        ticksArr.push(firstTick + i * tickInterval);
    }
    return ticksArr;
  }, [startYear, endYear, tickInterval]);

  // Helper to place tick on X axis (0-100%)
  const getX = (year: number) => {
    return ((year - startYear) / range) * 100;
  };

  const formatLabel = (tick: number) => {
    // Determine precision based on interval for cleaner labels on the ruler
    let precision: 'year' | 'month' | 'day' = 'year';
    if (tickInterval < 1/12 - 0.001) precision = 'day';
    else if (tickInterval < 1) precision = 'month';
    
    return formatTimelineDate(tick, precision);
  };

  // Logic for Movement Highlight
  const highlightStyle = useMemo(() => {
    if (!hoveredMovement) return null;
    const left = getX(hoveredMovement.startYear);
    const right = getX(hoveredMovement.endYear);
    const width = right - left;
    return {
        left: `${left}%`,
        width: `${Math.max(width, 0)}%`,
        backgroundColor: hoveredMovement.color,
    };
  }, [hoveredMovement, startYear, range]);

  // Logic for Event Marker
  const markerPosition = useMemo(() => {
      if (!hoveredEvent) return null;
      return getX(hoveredEvent.year);
  }, [hoveredEvent, startYear, range]);

  return (
    <div className="absolute top-0 left-0 w-full h-12 bg-gray-100 border-b border-gray-300 overflow-hidden select-none z-20 shadow-sm">
      
      {/* 1. Highlight Layer (Behind ticks) */}
      {highlightStyle && (
          <div 
            className="absolute top-0 h-full opacity-30 transition-all duration-200 pointer-events-none"
            style={highlightStyle}
          />
      )}

      {/* 2. Ticks Layer */}
      {ticks.map((tick) => {
        const xPos = getX(tick);
        // Only render if within view (with slight buffer)
        if (xPos < -5 || xPos > 105) return null;

        const isMajor = Math.abs(tick % 1) < 0.001 || (tickInterval < 1 && Math.abs((tick * 12) % 1) < 0.001); 
        const height = isMajor ? 'h-3' : 'h-2';
        const color = isMajor ? 'bg-gray-400' : 'bg-gray-300';
        
        return (
          <div
            key={tick}
            className="absolute bottom-0 flex flex-col items-center pointer-events-none"
            style={{ left: `${xPos}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-[9px] font-semibold text-gray-500 mb-1 whitespace-nowrap">
              {formatLabel(tick)}
            </span>
            <div className={`w-px ${height} ${color}`}></div>
          </div>
        );
      })}

      {/* 3. Event Marker Layer (On top of ticks) */}
      {markerPosition !== null && (
          <div 
            className="absolute bottom-0 w-[2px] h-[10px] bg-red-600 z-50 transition-all duration-75 pointer-events-none"
            style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }}
          >
              {/* Optional tiny triangle or dot at bottom to indicate precision */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-600 rounded-full -mt-1"></div>
          </div>
      )}
    </div>
  );
};

export default TimelineRuler;