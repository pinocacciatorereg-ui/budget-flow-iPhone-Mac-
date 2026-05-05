// Utility functions for working with dates in BudgetFlow

// Return today's date in ISO yyyy-mm-dd format
export const today = () => new Date().toISOString().slice(0, 10);

// Return a month key (yyyy-mm) given a Date or default to now
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

// Return the number of days in a month given a yyyy-mm string
export const daysInMonth = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();

// Return the current day of the month (1-31)
export const dayOfMonth = () => new Date().getDate();

// Get the key for the previous month given a month key (yyyy-mm)
export const prevMonth = (m) => {
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 2, 1);
  return monthKey(d);
};

// Italian month abbreviations for parsing
const MONTHS_IT = {
  gen: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  mag: '05',
  giu: '06',
  lug: '07',
  ago: '08',
  set: '09',
  ott: '10',
  nov: '11',
  dic: '12',
};

// Normalize a date string into yyyy-mm-dd. Supports ISO, dd/mm/yyyy, dd-mm-yyyy and Italian month names.
export const normDate = (v) => {
  const s = String(v ?? '').trim();
  // ISO format yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/mm/yyyy or dd-mm-yyyy
  let m = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  // Formats with month name (e.g. '5 mag 2026')
  m = s.match(/^(\d{1,2})\s*([A-Za-zÀ-ÿ]{3,})\s*(\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    let monthKeyStr = m[2].slice(0, 3);
    // Normalize accents
    monthKeyStr = monthKeyStr
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    let month = MONTHS_IT[monthKeyStr];
    if (!month) {
      try {
        const dt = new Date(`${m[2]} 1`);
        if (!Number.isNaN(dt)) {
          const mm = dt.getMonth() + 1;
          month = String(mm).padStart(2, '0');
        }
      } catch {}
    }
    const year = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${year}-${month || '01'}-${day}`;
  }
  const d = new Date(s);
  return Number.isNaN(d) ? today() : d.toISOString().slice(0, 10);
};