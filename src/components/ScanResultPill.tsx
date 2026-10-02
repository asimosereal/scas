'use client';

/**
 * SCAN RESULT BADGE
 * Small shared pill used in the dashboard, device simulator and data
 * views. Split out of the dashboard because Next.js route files may
 * only export a default component.
 */

import type { ScanResult } from '@/lib/types';

const MAP: Record<string, { c: string; t: string }> = {
  ACCEPTED: { c: 'Green', t: 'ACCEPTED' },
  DUPLICATE_IGNORED: { c: 'Marigold', t: 'DUPLICATE' },
  NOT_EXPECTED: { c: 'Red', t: 'NOT EXPECTED' },
  FACE_REVIEW: { c: 'Blue', t: 'REVIEW' },
  INVALID_CARD: { c: 'Red', t: 'INVALID CARD' },
  TERMINAL_OFFLINE_QUEUED: { c: 'Marigold', t: 'QUEUED' },
  EVENT_MODE_QUEUED: { c: 'Marigold', t: 'EVENT LOG' },
};

export function ScanResultPill({ result }: { result: ScanResult | string }) {
  const s = MAP[result] ?? { c: 'Neutral', t: result };
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        padding: '2px 6px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        color: `var(--colorPalette${s.c}Foreground1)`,
        background: `var(--colorPalette${s.c}Background1)`,
      }}
    >
      {s.t}
    </span>
  );
}
