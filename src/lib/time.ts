/**
 * TIME HELPERS
 * ------------------------------------------------------------------
 * All times are stored as "minutes since midnight" integers. This
 * keeps the attendance comparisons (requirement 15) trivial and
 * avoids timezone / locale issues entirely.
 */

import type { Minutes } from './types';

export function toMinutes(hhmm: string): Minutes {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(mins: Minutes): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDuration(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function isWithin(time: Minutes, start: Minutes, end: Minutes): boolean {
  return time >= start && time < end;
}
