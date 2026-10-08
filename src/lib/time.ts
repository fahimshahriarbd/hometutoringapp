/**
 * Time utility for Bangladesh Standard Time (BST, Asia/Dhaka GMT+6)
 */

export function getBangladeshTimeString(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).formatToParts(date);

    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = getPart('day');
    const month = getPart('month');
    const year = getPart('year');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');
    const dayPeriod = getPart('dayPeriod').toUpperCase();

    return `${day}-${month}-${year} ${hour}:${minute}:${second} ${dayPeriod}`;
  } catch {
    return date.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' });
  }
}

export function getBangladeshDateString(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Formats date strictly into: DD-Month name - Year (2026)
 * E.g. "08-October-2026"
 */
export function formatDayDate(dateStr: string): string {
  if (!dateStr) return '';
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    const monthIndex = parseInt(m, 10) - 1;
    const monthName = months[monthIndex] || m;
    const day = d.padStart(2, '0');
    return `${day}-${monthName}-${y}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const monthName = months[d.getMonth()] || '';
  return `${day}-${monthName}-${d.getFullYear()}`;
}
