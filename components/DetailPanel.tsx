import React from 'react';
import { ERAS } from '../constants';
import { Viewport, TimelineEvent } from '../types';

interface DetailPanelProps {
  viewport: Viewport;
  onEventClick: (event: TimelineEvent) => void;
  onEventHover: (event: TimelineEvent | null) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ viewport, onEventClick, onEventHover }) => {
  return (
    <div className="w-full h-full flex overflow-x-auto custom-scrollbar bg-[#f8f8f5]">
      {ERAS.map((era) => {
        const isActive = 
            (era.startYear >= viewport.startYear && era.startYear <= viewport.endYear) ||
            (era.endYear >= viewport.startYear && era.endYear <= viewport.endYear) ||
            (era.startYear < viewport.startYear && era.endYear > viewport.endYear);
        
        return (
          <div 
            key={era.id} 
            className={`flex-shrink-0 w-80 border-r border-gray-300 flex flex-col transition-all duration-300 bg-white`}
          >
            {/* Header: Filled Background Color */}
            <div 
                className="p-4 shadow-sm relative overflow-hidden"
                style={{ backgroundColor: era.colorHex }}
            >
                {/* Decorative Overlay */}
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <span className="text-6xl font-serif font-black text-white">{era.title.charAt(0)}</span>
                </div>

                <h3 className="font-serif font-bold text-lg leading-tight text-white relative z-10 drop-shadow-md">
                    {era.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 relative z-10">
                    <div className="px-2 py-0.5 rounded bg-white/20 text-white text-xs font-mono backdrop-blur-sm border border-white/10">
                        {era.startYear < 0 ? `${Math.abs(era.startYear)} BCE` : era.startYear} — {era.endYear < 0 ? `${Math.abs(era.endYear)} BCE` : era.endYear}
                    </div>
                </div>
            </div>
            
            {/* Event List */}
            <div className={`p-4 space-y-4 overflow-y-auto flex-1 ${isActive ? 'opacity-100' : 'opacity-60 grayscale-[0.5]'}`}>
              {era.events.map((event) => {
                  const [title, cnTitle] = event.label.split('/').map(s => s.trim());
                  return (
                    <div 
                        key={event.id} 
                        onClick={() => onEventClick(event)}
                        onMouseEnter={() => onEventHover(event)}
                        onMouseLeave={() => onEventHover(null)}
                        className="relative pl-4 border-l-2 border-gray-200 hover:border-gray-500 transition-all group cursor-pointer"
                    >
                      <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-gray-300 group-hover:bg-gray-800 transition-colors"></div>
                      
                      <div className="flex flex-col mb-1">
                        <div className="flex justify-between items-baseline">
                            <h4 className="font-serif font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors leading-tight">
                                {title}
                            </h4>
                            <span className="text-[10px] font-mono text-gray-400 shrink-0 ml-2">
                               {event.year}
                            </span>
                        </div>
                        {cnTitle && <span className="text-xs text-gray-500 font-sans mt-0.5">{cnTitle}</span>}
                      </div>
                      
                      {event.artist && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700">
                             {event.artist.split('/')[0]}
                          </p>
                      )}
                    </div>
                  );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DetailPanel;