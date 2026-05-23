import { FuzzyDate, Viewport } from './types';

export const MONTHS = [
  "Jan/1月", "Feb/2月", "Mar/3月", "Apr/4月", "May/5月", "Jun/6月", 
  "Jul/7月", "Aug/8月", "Sep/9月", "Oct/10月", "Nov/11月", "Dec/12月"
];

// Convert a FuzzyDate object to a precise decimal year for mathematical positioning
export const getDecimalYear = (fd: FuzzyDate): number => {
  let y = fd.year;
  if (fd.month) {
    // month is 1-indexed
    y += (fd.month - 1) / 12;
    if (fd.day) {
      // day is 1-indexed, approximate 30.44 days per month
      y += (fd.day - 1) / 365.25;
    }
  }
  return y;
};

export const getTimelineMaxEndDecimal = () => {
  return getDecimalYear({
    year: 2500,
    month: 12,
    day: 31,
  });
};

export const clampViewportToMaxEnd = (
  viewport: Viewport,
  maxEndYear: number = getTimelineMaxEndDecimal()
): Viewport => {
  if (viewport.endYear <= maxEndYear) return viewport;

  const range = viewport.endYear - viewport.startYear;
  return {
    startYear: maxEndYear - range,
    endYear: maxEndYear,
  };
};

// Format a FuzzyDate into a human-readable string with accuracy prefixes
export const formatFuzzyDate = (fd: FuzzyDate): string => {
  let base = '';
  if (fd.year < 0) {
    base = `公元前${Math.abs(fd.year)}年`;
  } else {
    base = `${fd.year}年`;
  }
  
  if (fd.month) {
    base += `${fd.month}月`;
    if (fd.day) {
      base += `${fd.day}日`;
    }
  }

  switch (fd.accuracy) {
    case 'approximate': 
      return `约 ${base}`;
    case 'not_before': 
      return `不早于 ${base}`;
    case 'not_after': 
      return `不晚于 ${base}`;
    case 'exact':
    default:
      return base;
  }
};

// Convert a decimal year (e.g. 2020.5) to { year, month, day }
// Assumptions: 1 year = 12 months, 1 month = ~30.44 days
export const decimalYearToDate = (decimalYear: number) => {
  const year = Math.floor(decimalYear);
  const fraction = decimalYear - year;
  
  // Handle BCE logic if needed, but mathematically:
  // -2000.5 is halfway through the year -2001 (going from -2001 to -2000)
  // For display, we usually treat the integer part as the year.
  
  const totalMonths = fraction * 12;
  const monthIndex = Math.floor(totalMonths);
  const monthFraction = totalMonths - monthIndex;
  
  const day = Math.floor(monthFraction * 30.44) + 1;

  return { year, monthIndex, day };
};

export const formatTimelineDate = (decimalYear: number, precision: 'year' | 'month' | 'day' = 'year') => {
  const { year, monthIndex, day } = decimalYearToDate(decimalYear);
  const absYear = Math.abs(year);
  
  // Ensure monthIndex is positive and within 0-11
  const safeMonthIndex = Math.abs(monthIndex) % 12;
  const month = safeMonthIndex + 1;
  const yearLabel = year < 0 ? `公元前${absYear}年` : `${absYear}年`;

  if (precision === 'day') {
    return `${yearLabel}${month}月${day}日`;
  }
  if (precision === 'month') {
    return `${yearLabel}${month}月`;
  }
  return yearLabel;
};