import { useState, useEffect } from 'react';
import { TopicData } from '../types';

// Simple in-memory cache
const topicCache = new Map<string, TopicData>();

export function useTopicData(topicId: string | null) {
  const [data, setData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!topicId) {
      setData(null);
      return;
    }

    if (topicCache.has(topicId)) {
      setData(topicCache.get(topicId)!);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/data/${topicId}/topic.json`).then(r => r.json()),
      fetch(`/data/${topicId}/periods.json`).then(r => r.json()),
      fetch(`/data/${topicId}/streams.json`).then(r => r.ok ? r.json() : []), // streams are optional
      fetch(`/data/${topicId}/events.json`).then(r => r.json())
    ])
      .then(([topic, periods, streams, events]) => {
        const topicData: TopicData = { topic, periods, streams, events };
        topicCache.set(topicId, topicData);
        setData(topicData);
      })
      .catch(err => {
        console.error(`Failed to load data for topic ${topicId}:`, err);
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [topicId]);

  return { data, loading, error };
}
