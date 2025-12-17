import React, { useState, useRef, useEffect } from 'react';
import TimelineRuler from './components/TimelineRuler';
import TimelineCanvas from './components/TimelineCanvas';
import DetailPanel from './components/DetailPanel';
import ArtworkModal from './components/ArtworkModal';
import { INITIAL_VIEWPORT, MIN_ZOOM_RANGE, MAX_ZOOM_RANGE } from './constants';
import { Viewport, TimelineEvent, ArtMovement } from './types';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { formatTimelineDate } from './utils';

const App: React.FC = () => {
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  
  // Hover states for interactions
  const [hoveredMovement, setHoveredMovement] = useState<ArtMovement | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  
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
    if (newRange < MIN_ZOOM_RANGE) newRange = MIN_ZOOM_RANGE;
    if (newRange > MAX_ZOOM_RANGE) newRange = MAX_ZOOM_RANGE;

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const container = containerRef.current;
    if (!container) return;

    const { width } = container.getBoundingClientRect();
    const deltaPixels = lastMouseX.current - e.clientX;
    
    // Convert pixels to years
    const currentRange = viewport.endYear - viewport.startYear;
    const yearsPerPixel = currentRange / width;
    const deltaYears = deltaPixels * yearsPerPixel;

    setViewport(prev => ({
      startYear: prev.startYear + deltaYears,
      endYear: prev.endYear + deltaYears
    }));

    lastMouseX.current = e.clientX;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // --- Manual Controls ---
  const manualZoom = (direction: 'in' | 'out') => {
    const currentRange = viewport.endYear - viewport.startYear;
    const factor = direction === 'in' ? 0.8 : 1.25;
    let newRange = currentRange * factor;
    
    // Clamp
    if (newRange < MIN_ZOOM_RANGE) newRange = MIN_ZOOM_RANGE;
    if (newRange > MAX_ZOOM_RANGE) newRange = MAX_ZOOM_RANGE;

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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f8f8f5] font-sans text-gray-900 overflow-hidden">
      
      {/* Header / Title Bar */}
      <header className="flex-none h-16 bg-[#1a1a1a] text-[#f0f0f0] flex items-center justify-between px-6 shadow-md z-30 border-b border-[#333]">
        <h1 className="text-xl md:text-2xl font-serif italic font-bold tracking-wide flex items-center gap-3">
          <div className="flex gap-1">
             <span className="w-1.5 h-6 bg-[#8B0000]"></span>
             <span className="w-1.5 h-6 bg-[#DAA520]"></span>
             <span className="w-1.5 h-6 bg-[#4682B4]"></span>
          </div>
          Timeline of Western Art / 西方艺术史
        </h1>
        <div className="flex items-center gap-6 text-sm text-gray-400 font-serif">
           <span className="hidden md:inline italic opacity-80">Scroll to Zoom / Drag to Pan (滚动缩放 / 拖动平移)</span>
           <div className="flex gap-0 border border-gray-600 rounded overflow-hidden">
             <button onClick={() => manualZoom('out')} className="p-2 bg-[#2a2a2a] hover:bg-[#333] hover:text-white transition border-r border-gray-600" title="Zoom Out"><ZoomOut size={18}/></button>
             <button onClick={() => manualZoom('in')} className="p-2 bg-[#2a2a2a] hover:bg-[#333] hover:text-white transition" title="Zoom In"><ZoomIn size={18}/></button>
           </div>
        </div>
      </header>

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
        <TimelineRuler 
            viewport={viewport} 
            hoveredMovement={hoveredMovement}
            hoveredEvent={hoveredEvent}
        />
        <TimelineCanvas 
            viewport={viewport} 
            onEventClick={setSelectedEvent}
            onMovementHover={setHoveredMovement}
            onEventHover={setHoveredEvent}
        />
        
        {/* Floating current range indicator */}
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur border border-gray-300 px-4 py-2 text-sm font-serif shadow-lg pointer-events-none z-20 rounded">
          <span className="text-gray-500 italic mr-2">Visible Era / 显示时间:</span>
          <strong>{formatTimelineDate(viewport.startYear, precision)}</strong> — <strong>{formatTimelineDate(viewport.endYear, precision)}</strong>
        </div>
      </div>

      {/* Detail Columns (Bottom Half) */}
      <div className="flex-1 min-h-0 detail-panel relative bg-[#f4f4f4]">
        <DetailPanel 
            viewport={viewport} 
            onEventClick={setSelectedEvent}
            onEventHover={setHoveredEvent}
        />
        {/* Decorative shadow */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-b from-black/5 to-transparent pointer-events-none"></div>
      </div>

      {/* Artwork Modal */}
      <ArtworkModal 
        event={selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
      />

    </div>
  );
};

export default App;