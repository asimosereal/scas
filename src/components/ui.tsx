'use client';

/**
 * SHARED PRESENTATION PRIMITIVES
 * Small Fluent 2 building blocks reused across screens so the visual
 * language stays consistent.
 */

import React from 'react';
import { Badge, Text, Title3, Subtitle2 } from '@fluentui/react-components';
import type { AttendanceStatus, TerminalStatus } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="scas-page-header">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <Title3 className="scas-page-title">{title}</Title3>
          {subtitle && (
            <Text
              size={300}
              style={{ color: 'var(--colorNeutralForeground3)', display: 'block' }}
            >
              {subtitle}
            </Text>
          )}
        </div>
        {actions && <div className="scas-row">{actions}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status pills                                                        */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<
  AttendanceStatus | 'NEUTRAL',
  { color: 'brand' | 'success' | 'warning' | 'danger' | 'informative' | 'subtle'; label: string }
> = {
  PRESENT: { color: 'success', label: 'PRESENT' },
  LATE: { color: 'warning', label: 'LATE' },
  ABSENT: { color: 'danger', label: 'ABSENT' },
  REVIEW: { color: 'informative', label: 'REVIEW' },
  PENDING_SYNC: { color: 'subtle', label: 'QUEUED' },
  NEUTRAL: { color: 'subtle', label: '—' },
};

export function StatusPill({ status }: { status: AttendanceStatus | 'NEUTRAL' }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.NEUTRAL;
  return (
    <Badge
      appearance="tint"
      color={s.color}
      size="small"
      style={{ fontVariantNumeric: 'tabular-nums', minWidth: 68, justifyContent: 'center' }}
    >
      {s.label}
    </Badge>
  );
}

export function TerminalPill({ status, mode }: { status: TerminalStatus; mode?: string }) {
  const isEvent = mode === 'EVENT';
  const color =
    isEvent ? 'danger' : status === 'ONLINE' ? 'success' : status === 'SYNCING' ? 'warning' : 'subtle';
  return (
    <Badge appearance="tint" color={color} size="small">
      {isEvent ? 'EVENT MODE' : status}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="scas-section">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <Subtitle2>{title}</Subtitle2>
        {description && (
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            {description}
          </Text>
        )}
        <span className="scas-spacer" />
        {actions}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tiles                                                          */
/* ------------------------------------------------------------------ */

export function StatTile({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'var(--colorPaletteGreenForeground1)'
      : tone === 'warning'
        ? 'var(--colorPaletteMarigoldForeground1)'
        : tone === 'danger'
          ? 'var(--colorPaletteRedForeground1)'
          : tone === 'brand'
            ? 'var(--colorBrandForeground1)'
            : 'var(--colorNeutralForeground1)';

  return (
    <div className="scas-stat">
      <span className="stat-value" style={{ color }}>
        {value}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="scas-stats">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Definition list                                                     */
/* ------------------------------------------------------------------ */

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="scas-kv">
      {items.map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
