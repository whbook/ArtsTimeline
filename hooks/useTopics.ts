import { useState, useEffect } from 'react';
import { TopicEntry } from '../types';

export function useTopics() {
  const [topics, setTopics] = useState<TopicEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
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
  }, []);

  return { topics, loading, error };
}
