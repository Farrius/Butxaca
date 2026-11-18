// Period navigation (Day / Week / Month / Year / All), Monefy-style.
// Dates are handled as local YYYY-MM-DD strings to avoid timezone drift.

export const PERIODS = ['day', 'week', 'month', 'year', 'all'];

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Returns { start, end } as inclusive YYYY-MM-DD strings (null for 'all'). */
export function rangeFor(period, anchor) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  switch (period) {
    case 'day':
      return { start: toISODate(a), end: toISODate(a) };
    case 'week': {
      const dow = (a.getDay() + 6) % 7; // Monday = 0
      const s = new Date(a); s.setDate(a.getDate() - dow);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return { start: toISODate(s), end: toISODate(e) };
    }
    case 'month':
      return {
        start: toISODate(new Date(a.getFullYear(), a.getMonth(), 1)),
        end: toISODate(new Date(a.getFullYear(), a.getMonth() + 1, 0)),
      };
    case 'year':
      return { start: `${a.getFullYear()}-01-01`, end: `${a.getFullYear()}-12-31` };
    default:
      return { start: null, end: null };
  }
}

export function shift(period, anchor, dir) {
  const d = new Date(anchor);
  if (period === 'day') d.setDate(d.getDate() + dir);
  else if (period === 'week') d.setDate(d.getDate() + 7 * dir);
  else if (period === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir); }
  else if (period === 'year') d.setFullYear(d.getFullYear() + dir);
  return d;
}

export function inRange(dateStr, { start, end }) {
  if (!start) return true;
  return dateStr >= start && dateStr <= end;
}

export function labelFor(period, anchor) {
  const { start, end } = rangeFor(period, anchor);
  const fmt = (s, opts) => parseISODate(s).toLocaleDateString(undefined, opts);
  switch (period) {
    case 'day': return fmt(start, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    case 'week': return `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    case 'month': return fmt(start, { month: 'long', year: 'numeric' });
    case 'year': return String(anchor.getFullYear());
    default: return 'All time';
  }
}
