// Utilities for parsing and formatting monetary values

// Format a number as Euro currency using Italian locale
export const eur = (v) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
    Number(v || 0)
  );

// Parse a Euro amount from strings with comma or dot as decimals, optional euro symbol,
// negative sign or parentheses to indicate negative numbers. Returns 0 if invalid.
export const parseEuro = (v) => {
  let s = String(v ?? '').replace(/[€\s]/g, '').trim();
  if (!s) return 0;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1);
    neg = true;
  }
  // Replace thousand separators and unify decimal separator
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
};