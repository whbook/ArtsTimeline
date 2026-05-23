import React from 'react';
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
  if (!event) return null;

  const titleCn = event.titleCn?.trim();
  const titleEng = event.titleEn?.trim();
  const displayTitle = titleCn || titleEng || '';
  const subtitle = titleCn && titleEng && titleCn !== titleEng ? titleEng : null;
  const descEng = event.descriptionEn;
  const descCn = event.descriptionCn;
  const hasImage = !!event.imageUrl;

  const metadata = (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-gray-100 pb-5">
      {/* Dynamic Fields */}
      {topic.eventFields.map(field => {
          let value = (event as any)[field.key] || (event.meta && event.meta[field.key]);
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
              {formatFuzzyDate(event.date)}
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
    <div className="event-modal fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className={`bg-white w-full ${hasImage ? 'max-w-5xl' : 'max-w-2xl'} max-h-[76vh] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 font-sans`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-30 p-2 bg-black/40 hover:bg-black/70 text-white rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        {hasImage ? (
          <div className="grid max-h-[76vh] grid-cols-[42%_58%]">
            <div className="relative min-h-[420px] bg-stone-900">
              <EventImage
                src={event.imageUrl}
                alt={displayTitle}
                eager
                className="h-full w-full"
                imgClassName="object-contain"
              />
            </div>

            <div className="flex max-h-[76vh] flex-col">
              <div className="border-b border-gray-100 p-6 pb-4">
                <h2 className="text-3xl font-bold leading-tight text-gray-900">{displayTitle}</h2>
                {subtitle && <h3 className="mt-1 text-lg text-gray-500">{subtitle}</h3>}
              </div>
              <div className="section-scrollbar overflow-y-auto p-6">
                {metadata}
                <div className="mt-5">
                  {description}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-h-[76vh] overflow-y-auto p-6 section-scrollbar">
            <div className="mb-5 border-b border-gray-100 pb-4 pr-12">
              <h2 className="text-3xl font-bold leading-tight text-gray-900">{displayTitle}</h2>
              {subtitle && <h3 className="mt-1 text-lg text-gray-500">{subtitle}</h3>}
            </div>
            {metadata}
            <div className="mt-5">
              {description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventModal;