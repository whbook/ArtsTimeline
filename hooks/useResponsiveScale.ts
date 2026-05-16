import { useState, useEffect } from 'react';
import { BASE_SCREEN_WIDTH, BASE_SCREEN_HEIGHT } from '../constants';

export interface ResponsiveScale {
  scaleX: number;
  scaleY: number;
  scaleMin: number;
  scaleMax: number;
  screenWidth: number;
  screenHeight: number;
}

export function useResponsiveScale(): ResponsiveScale {
  const [scale, setScale] = useState<ResponsiveScale>({
    scaleX: 1,
    scaleY: 1,
    scaleMin: 1,
    scaleMax: 1,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : BASE_SCREEN_WIDTH,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : BASE_SCREEN_HEIGHT,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const scaleX = width / BASE_SCREEN_WIDTH;
      const scaleY = height / BASE_SCREEN_HEIGHT;
      
      setScale({
        scaleX,
        scaleY,
        scaleMin: Math.min(scaleX, scaleY),
        scaleMax: Math.max(scaleX, scaleY),
        screenWidth: width,
        screenHeight: height
      });
    };

    // Initial calculation
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return scale;
}
