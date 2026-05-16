import React from 'react';
import { TopicEntry } from '../types';

interface TopicSelectorProps {
  topics: TopicEntry[];
  activeTopicId: string | null;
  onSelectTopic: (id: string) => void;
}

const TopicSelector: React.FC<TopicSelectorProps> = ({ topics, activeTopicId, onSelectTopic }) => {
  if (!topics || topics.length === 0) return null;

  return (
    <div className="flex space-x-1 overflow-x-auto custom-scrollbar px-2">
      {topics.map(topic => {
        const isActive = topic.id === activeTopicId;
        return (
          <button
            key={topic.id}
            onClick={() => onSelectTopic(topic.id)}
            className={`px-4 py-1.5 rounded-t-md text-sm font-medium transition-colors whitespace-nowrap border-t-2 border-x border-b-0 ${
              isActive 
                ? 'bg-[#fdfdfd] text-gray-900 border-gray-800' 
                : 'bg-[#2a2a2a] text-gray-400 border-transparent hover:bg-[#333] hover:text-gray-200'
            }`}
            style={isActive ? { borderTopColor: topic.color } : {}}
          >
            {topic.titleCn}
          </button>
        );
      })}
    </div>
  );
};

export default TopicSelector;
