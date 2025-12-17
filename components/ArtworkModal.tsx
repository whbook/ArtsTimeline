import React from 'react';
import { X } from 'lucide-react';
import { TimelineEvent } from '../types';

interface ArtworkModalProps {
  event: TimelineEvent | null;
  onClose: () => void;
}

const ArtworkModal: React.FC<ArtworkModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const [titleEng, titleCn] = event.label.split('/').map(s => s.trim());
  const descriptionParts = event.description ? event.description.split('\n') : [];
  const descEng = descriptionParts[0];
  const descCn = descriptionParts[1];
  const artistParts = event.artist ? event.artist.split('/') : ['Unknown'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white w-full max-w-lg rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Image Placeholder */}
        <div className="h-48 bg-gray-200 w-full flex items-center justify-center relative overflow-hidden">
             {/* If we had real images, <img src={event.imageUrl} ... /> */}
             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
             <span className="text-6xl text-gray-300 font-serif opacity-20 select-none">ART</span>
             
             {/* Title Overlay */}
             <div className="absolute bottom-4 left-6 z-20 text-white">
                 <h2 className="text-2xl font-serif font-bold leading-none shadow-black drop-shadow-md">{titleEng}</h2>
                 <h3 className="text-lg font-serif italic opacity-90">{titleCn}</h3>
             </div>

             <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-30 p-2 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors"
             >
                <X size={20} />
             </button>
        </div>

        {/* Content */}
        <div className="p-6">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Artist / 艺术家</span>
                    <p className="text-lg font-medium text-gray-900">
                        {artistParts[0]} 
                        {artistParts[1] && <span className="text-gray-500 ml-2 text-base font-normal">{artistParts[1]}</span>}
                    </p>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Year / 年份</span>
                    <p className="text-xl font-serif font-bold text-gray-900">
                        {event.year < 0 ? `${Math.abs(event.year)} BCE` : event.year}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <h4 className="font-bold text-gray-800 mb-1">Description</h4>
                    <p className="text-gray-600 leading-relaxed text-sm">{descEng}</p>
                </div>
                {descCn && (
                    <div>
                        <h4 className="font-bold text-gray-800 mb-1">简介</h4>
                        <p className="text-gray-600 leading-relaxed text-sm font-sans">{descCn}</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ArtworkModal;