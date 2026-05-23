import { useState, useEffect } from 'react';
import { TopicData } from '../types';
import { getApiBaseUrl } from '../utils';

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

    const apiBase = getApiBaseUrl();
    const fetchTopic = () => {
      return fetch(`${apiBase}/api/public/exhibitions/${topicId}/topic`)
        .then(r => {
          if (!r.ok) throw new Error('API topic load failed');
          return r.json();
        })
        .catch(apiErr => {
          console.warn(`Failed to load topic ${topicId} from API, falling back to static topic.json:`, apiErr);
          return fetch(`/data/${topicId}/topic.json`).then(r => {
            if (!r.ok) throw new Error(`Failed to load topic ${topicId}`);
            return r.json();
          });
        });
    };

    fetchTopic()
      .then(topic => Promise.all([
        Promise.resolve(topic),
        fetch(`${apiBase}/api/public/exhibitions/${topicId}/periods`)
          .then(r => {
            if (!r.ok) throw new Error('API periods load failed');
            return r.json();
          })
          .catch(() => fetch(`/data/${topicId}/periods.json`).then(r => r.json())),
        fetch(`${apiBase}/api/public/exhibitions/${topicId}/streams`)
          .then(r => {
            if (!r.ok) throw new Error('API streams load failed');
            return r.json();
          })
          .catch(() => fetch(`/data/${topicId}/streams.json`).then(r => r.ok ? r.json() : [])),
        topic.chunked
          ? Promise.resolve([])
          : fetch(`${apiBase}/api/public/exhibitions/${topicId}/events`)
              .then(r => {
                if (!r.ok) throw new Error('API events load failed');
                return r.json();
              })
              .catch(() => fetch(`/data/${topicId}/events.json`).then(r => r.json()))
      ]))
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
