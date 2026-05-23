import { useState, useEffect } from 'react';
import { TopicEntry } from '../types';
import { getApiBaseUrl } from '../utils';

export function useTopics() {
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/public/exhibitions`)
      .then(res => {
        if (!res.ok) throw new Error('API request failed');
        return res.json();
      })
      .then(data => {
        setTopics(data);
        setLoading(false);
      })
      .catch(apiErr => {
        console.warn('Failed to load topics from API, falling back to static index.json:', apiErr);
        fetch('/data/index.json')
          .then(res => {
            if (!res.ok) throw new Error('Failed to load topics directory');
            return res.json();
          })
          .then(data => {
            setTopics(data);
            setLoading(false);
          })
          .catch(err => {
            setError(err);
            setLoading(false);
          });
      });
  }, []);

  return { topics, loading, error };
}
