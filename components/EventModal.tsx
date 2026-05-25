import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TimelineEvent, Topic } from '../types';
import { formatFuzzyDate } from '../utils';
import EventImage from './EventImage';
import DescriptionText from './DescriptionText';

interface EventModalProps {
  topic: Topic;
  event: TimelineEvent | null;
  onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({ topic, event, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [internalEvent, setInternalEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    if (event) {
      setInternalEvent(event);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setInternalEvent(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [event]);

  if (!internalEvent) return null;

  const titleCn = internalEvent.titleCn?.trim();
  const titleEng = internalEvent.titleEn?.trim();
  const displayTitle = titleCn || titleEng || '';
  const subtitle = titleCn && titleEng && titleCn !== titleEng ? titleEng : null;
  const descEng = internalEvent.descriptionEn;
  const descCn = internalEvent.descriptionCn;
  const hasImage = !!internalEvent.imageUrl;

  const metadata = (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-gray-100 pb-5">
      {/* Dynamic Fields */}
      {topic.eventFields.map(field => {
          let value = (internalEvent as any)[field.key] || (internalEvent.meta && internalEvent.meta[field.key]);
          if (!value) return null;
          if (Array.isArray(value)) value = value.join('、');
          
          return (
              <div key={field.key} className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{field.labelEn} / {field.labelCn}</span>
                  <p className="text-base font-medium text-gray-900 truncate">
                      {value}
                  </p>
              </div>
          );
      })}
      
      <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Date / 时间</span>
          <p className="text-xl font-bold text-gray-900">
              {formatFuzzyDate(internalEvent.date)}
          </p>
      </div>
    </div>
  );

  const description = (
    <div className="space-y-4">
        {descEng && (
          <div>
              <h4 className="font-bold text-gray-800 mb-1">Description</h4>
              <DescriptionText value={descEng} className="text-gray-600" />
          </div>
        )}
        {descCn && (
            <div>
                <h4 className="font-bold text-gray-800 mb-1">简介</h4>
                <DescriptionText value={descCn} className="text-gray-600" />
            </div>
        )}
    </div>
  );

  return (
    <div 
      className={`event-modal fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
      onClick={onClose}
    >
      <div 
        className={`relative bg-white w-full ${hasImage ? 'max-w-5xl' : 'max-w-2xl'} max-h-[85vh] md:max-h-[76vh] rounded-lg shadow-2xl overflow-hidden font-sans transition-all duration-300 ease-in-out transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 z-30 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 bg-white/50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        {hasImage ? (
          <div className="flex flex-col md:grid h-full max-h-[85vh] md:max-h-[76vh] md:grid-cols-[42%_58%] overflow-y-auto md:overflow-hidden">
            <div className="relative aspect-square md:aspect-auto md:min-h-[420px] bg-stone-900 shrink-0">
              <EventImage
                src={internalEvent.imageUrl}
                alt={displayTitle}
                eager
                className="absolute inset-0 h-full w-full"
                imgClassName="object-contain"
              />
            </div>

            <div className="flex flex-col md:max-h-[76vh]">
              <div className="border-b border-gray-100 p-5 md:p-6 pb-4">
                <h2 className="text-2xl md:text-3xl font-bold leading-tight text-gray-900 pr-8 md:pr-0">{displayTitle}</h2>
                {subtitle && <h3 className="mt-1 text-base md:text-lg text-gray-500">{subtitle}</h3>}
              </div>
              <div className="section-scrollbar md:overflow-y-auto p-5 md:p-6">
                {metadata}
                <div className="mt-4 md:mt-5">
                  {description}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[85vh] md:max-h-[76vh] overflow-y-auto p-5 md:p-6 section-scrollbar">
            <div className="mb-4 md:mb-5 border-b border-gray-100 pb-4 pr-8 md:pr-12">
              <h2 className="text-2xl md:text-3xl font-bold leading-tight text-gray-900">{displayTitle}</h2>
              {subtitle && <h3 className="mt-1 text-base md:text-lg text-gray-500">{subtitle}</h3>}
            </div>
            {metadata}
            <div className="mt-4 md:mt-5">
              {description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventModal;