export const MONTHS = [
  "Jan/1月", "Feb/2月", "Mar/3月", "Apr/4月", "May/5月", "Jun/6月", 
  "Jul/7月", "Aug/8月", "Sep/9月", "Oct/10月", "Nov/11月", "Dec/12月"
];

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
  const suffix = year < 0 ? ' BCE/公元前' : '';
  const absYear = Math.abs(year);
  
  // Ensure monthIndex is positive and within 0-11
  const safeMonthIndex = Math.abs(monthIndex) % 12;
  const mStr = MONTHS[safeMonthIndex];

  if (precision === 'day') {
    return `${mStr}${day}, ${absYear}${suffix}`;
  }
  if (precision === 'month') {
    return `${mStr}, ${absYear}${suffix}`;
  }
  return `${absYear}${suffix}`;
};