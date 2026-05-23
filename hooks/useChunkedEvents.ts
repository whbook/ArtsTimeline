import { useState, useEffect, useRef } from 'react';
import { TimelineEvent, Viewport } from '../types';

interface ChunkInfo {
  start: number;
  end: number;
  file: string;
  count: number;
}

interface Manifest {
  topicId: string;
  chunks: ChunkInfo[];
}

const chunkCache = new Map<string, TimelineEvent[]>(); // key: `${topicId}:${file}`
const manifestCache = new Map<string, Manifest>(); // key: topicId
const inflightRequests = new Map<string, Promise<TimelineEvent[]>>(); // key: `${topicId}:${file}`

export function useChunkedEvents(
  topicId: string | null,
  enabled: boolean,
  viewport: Viewport | null
) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Track currently active topicId and loaded bounds to prevent redundant loads
  const activeTopicIdRef = useRef<string | null>(null);
  const loadedBoundsRef = useRef<{ start: number; end: number; topicId: string } | null>(null);

  useEffect(() => {
    activeTopicIdRef.current = topicId;
    if (!topicId || !enabled || !viewport) {
      setEvents([]);
      setLoading(false);
      setError(null);
      loadedBoundsRef.current = null;
      return;
    }

    let isCancelled = false;

    async function loadManifestAndChunks() {
      try {
        const start = viewport!.startYear;
        const end = viewport!.endYear;
        // 25% viewport buffer on each side for prefetching during panning
        const padding = Math.max(50, (end - start) * 0.25);
        const bufferedStart = start - padding;
        const bufferedEnd = end + padding;

        // Optimization: If we are still within the already loaded bounds for the same topic, skip refetching
        if (
          loadedBoundsRef.current &&
          loadedBoundsRef.current.topicId === topicId &&
          bufferedStart >= loadedBoundsRef.current.start &&
          bufferedEnd <= loadedBoundsRef.current.end
        ) {
          return;
        }

        setLoading(true);
        setError(null);

        // 1. Get or fetch manifest
        let manifest = manifestCache.get(topicId);
        if (!manifest) {
          const res = await fetch(`/data/${topicId}/manifest.json`);
          if (!res.ok) {
            throw new Error(`Failed to load manifest for topic ${topicId}`);
          }
          manifest = await res.json();
          manifestCache.set(topicId!, manifest!);
        }

        if (isCancelled || activeTopicIdRef.current !== topicId) return;

        // 2. Identify required chunks
        const neededChunks = manifest!.chunks.filter(
          chunk => chunk.start <= bufferedEnd && chunk.end >= bufferedStart
        );

        if (neededChunks.length === 0) {
          setEvents([]);
          setLoading(false);
          return;
        }

        // 3. Load needed chunks
        const fetchPromises = neededChunks.map(async chunk => {
          const cacheKey = `${topicId}:${chunk.file}`;
          
          // Check cache
          if (chunkCache.has(cacheKey)) {
            return chunkCache.get(cacheKey)!;
          }

          // Check inflight requests
          if (inflightRequests.has(cacheKey)) {
            return inflightRequests.get(cacheKey)!;
          }

          // Fetch chunk
          const fetchPromise = (async () => {
            const res = await fetch(`/data/${topicId}/${chunk.file}`);
            if (!res.ok) {
              throw new Error(`Failed to load chunk ${chunk.file}`);
            }
            const data: TimelineEvent[] = await res.json();
            chunkCache.set(cacheKey, data);
            inflightRequests.delete(cacheKey);
            return data;
          })();

          inflightRequests.set(cacheKey, fetchPromise);
          return fetchPromise;
        });

        const chunkDataArrays = await Promise.all(fetchPromises);

        if (isCancelled || activeTopicIdRef.current !== topicId) return;

        // 4. Combine and deduplicate events
        const combinedMap = new Map<string, TimelineEvent>();
        chunkDataArrays.forEach(arr => {
          arr.forEach(event => {
            combinedMap.set(event.id, event);
          });
        });

        const mergedEvents = Array.from(combinedMap.values()).sort(
          (a, b) => a.date.year - b.date.year
        );

        // Compute the actual covered bounds of all loaded chunks
        const minYearOfLoaded = Math.min(...neededChunks.map(c => c.start));
        const maxYearOfLoaded = Math.max(...neededChunks.map(c => c.end));
        
        loadedBoundsRef.current = {
          start: minYearOfLoaded,
          end: maxYearOfLoaded,
          topicId
        };

        setEvents(mergedEvents);
        setLoading(false);
      } catch (err) {
        if (!isCancelled && activeTopicIdRef.current === topicId) {
          console.error('Error loading chunked events:', err);
          setError(err as Error);
          setLoading(false);
        }
      }
    }

    loadManifestAndChunks();

    return () => {
      isCancelled = true;
    };
  }, [topicId, enabled, viewport?.startYear, viewport?.endYear]);

  return { events, loading, error };
}
