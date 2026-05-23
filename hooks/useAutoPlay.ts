import { useState, useEffect, useRef } from 'react';
import { Viewport, TopicData } from '../types';
import { 
  AUTOPLAY_IDLE_TIMEOUT, 
  AUTOPLAY_BASE_SPEED, 
  AUTOPLAY_FAST_SPEED
} from '../constants';

import { clampViewportToMaxEnd, getTimelineMaxEndDecimal, getDecimalYear } from '../utils';

export function useAutoPlay(
  topicData: TopicData | null,
  onRequestSwitch: () => void,
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>,
  scaleX: number = 1
) {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const isSwitchingRef = useRef(false);
  const countdownStartRef = useRef<number>(0);
  const timelineMaxYearRef = useRef(getTimelineMaxEndDecimal());

  // 1. Idle Detection
  useEffect(() => {
    const resetIdleTimer = () => {
      setIsAutoPlaying(false);
      setCountdown(null);
      countdownRef.current = null;
      isSwitchingRef.current = false;
      
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        setIsAutoPlaying(true);
      }, AUTOPLAY_IDLE_TIMEOUT);
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('wheel', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    
    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('wheel', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // 2. Auto-play Loop
  useEffect(() => {
    if (!isAutoPlaying || !topicData) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      lastFrameTime.current = 0;
      return;
    }

    const loop = (time: number) => {
      if (!lastFrameTime.current) lastFrameTime.current = time;
      const dt = (time - lastFrameTime.current) / 1000;
      lastFrameTime.current = time;

      // Cap dt to avoid huge jumps if tab was inactive
      if (dt > 0.1) {
         animationRef.current = requestAnimationFrame(loop);
         return;
      }
      
      // Cap dt to avoid huge jumps or stuttering if frame drops
      const safeDt = Math.min(dt, 0.05);

      setViewport(prev => {
        const range = prev.endYear - prev.startYear;
        const events = topicData.events;
        
        let firstEventYear = prev.startYear;
        let lastEventYear = prev.endYear;

        if (events.length > 0) {
          firstEventYear = Math.min(...events.map(e => getDecimalYear(e.date)));
          lastEventYear = Math.max(...events.map(e => getDecimalYear(e.date)));
        }

        // Check if we reached the end of the topic (with some buffer)
        // If the last event has scrolled past the center of the screen
        const centerYear = prev.startYear + range / 2;
        if (centerYear > lastEventYear + range * 0.1) {
          if (!isSwitchingRef.current) {
            isSwitchingRef.current = true;
            countdownStartRef.current = time;
            countdownRef.current = 5;
            setCountdown(5);
          } else {
            const elapsed = (time - countdownStartRef.current) / 1000;
            const remaining = Math.ceil(5 - elapsed);
            if (remaining <= 0 && countdownRef.current !== 0) {
              countdownRef.current = 0;
              setCountdown(0);
              onRequestSwitch();
            } else if (remaining > 0 && remaining !== countdownRef.current) {
              countdownRef.current = remaining;
              setCountdown(remaining);
            }
          }
          // Do not return prev here immediately, allow very slow panning or stop completely
          // Returning prev stops panning entirely, which might feel abrupt.
          // For now, we return prev to stop it.
          return prev; 
        } else {
          if (isSwitchingRef.current) {
            isSwitchingRef.current = false;
            countdownRef.current = null;
            setCountdown(null);
          }
        }

        // Calculate speed
        const topicMultiplier = topicData.topic.playbackSpeed || 1;
        
        // 确保物理滑动速度（屏幕百分比/秒）保持恒定，与放大倍数（range的大小）完全无关！
        // 我们设定基准正常播放速度为：每秒平移当前视口范围（range）的 1.25%
        // 乘上用户配置的播放速度倍率 topicMultiplier 以及屏幕自适应系数 scaleX
        let speed = range * 0.0125 * topicMultiplier * scaleX;

        // Smart fast-forward if far from first event
        const distanceToFirstEvent = firstEventYear - prev.endYear;

        if (distanceToFirstEvent > range) {
          // 快进速度也应当与 range 成正比（每秒平移 1.2 个屏幕宽度），从而与放大倍率无关
          speed = range * 1.2 * scaleX; 
        } else if (distanceToFirstEvent > 0) {
          // 逼近首个事件时平滑减速：从快进速度（1.2屏/秒）平滑减速到正常播放速度
          const factor = distanceToFirstEvent / range;
          const fastSpeed = range * 1.2 * scaleX;
          speed = speed + (fastSpeed - speed) * factor;
        }

        // Auto-play must only move forward in time: earlier -> later.
        const delta = Math.max(0, speed * safeDt);
        if (delta === 0) return prev;

        return clampViewportToMaxEnd({
          startYear: prev.startYear + delta,
          endYear: prev.endYear + delta
        }, timelineMaxYearRef.current);
      });

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isAutoPlaying, topicData, onRequestSwitch, setViewport, scaleX]);

  return { isAutoPlaying, countdown };
}
