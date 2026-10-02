'use client';

/**
 * TERMINAL MANAGEMENT
 * ==================================================================
 * System-wide view of every simulated classroom device: online,
 * offline, syncing, event mode, and how many scans are queued.
 */

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
} from '@fluentui/react-components';
import { ArrowSync16Regular, ArrowClockwise16Regular } from '@fluentui/react-icons';
import { PageHeader, Section, StatGrid, StatTile, TerminalPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import { getBlockForRoom } from '@/lib/engine/timetable-engine';
import { syncOfflineScans } from '@/lib/engine/attendance-engine';
import type { TerminalStatus } from '@/lib/types';

export default function TerminalsPage() {
  const { state, dispatch, data } = useSim();
  const [filter, setFilter] = useState('ALL');
  const [lastSync, setLastSync] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      online: state.terminals.filter((t) => t.status === 'ONLINE').length,
      offline: state.terminals.filter((t) => t.status === 'OFFLINE').length,
      syncing: state.terminals.filter((t) => t.status === 'SYNCING').length,
      event: state.terminals.filter((t) => t.mode === 'EVENT').length,
      queued: state.terminals.reduce((n, t) => n + t.queuedScans, 0),
    }),
    [state.terminals],
  );

  const visible = useMemo(
    () =>
      state.terminals.filter((t) => {
        if (filter === 'ALL') return true;
        if (filter === 'EVENT') return t.mode === 'EVENT';
        return t.status === filter;
      }),
    [state.terminals, filter],
  );

  /** Bring every terminal back online and drain the local queues. */
  const syncAll = () => {
    const queuedIds = new Set(
      state.attendance.filter((r) => r.pendingSync).map((r) => r.attendanceId),
    );
    const queue = [...queuedIds].map((id) => ({
      id,
      timestamp: state.attendance.find((r) => r.attendanceId === id)?.entryTime ?? state.time,
    }));
    const { result, records } = syncOfflineScans(queue, state.attendance, state.time);
    // Write the cleaned records back through a no-op scan payload.
    dispatch({
      type: 'APPLY_SCAN',
      payload: {
        scan: {
          scanId: `SYNC-${Date.now().toString(36)}`,
          terminalId: 'T-SYSTEM',
          studentId: null,
          timestamp: state.time,
          week: state.week,
          day: state.day,
          result: 'ACCEPTED',
          verificationConfidence: null,
          message: result.message,
          synced: true,
        },
        attendance: records,
        terminals: state.terminals.map((t) => ({
          ...t,
          status: 'ONLINE' as const,
          queuedScans: 0,
        })),
        message: { tone: 'success', text: result.message },
      },
    });
    setLastSync(formatTime(state.time));
  };

  const setStatus = (id: string, status: TerminalStatus) =>
    dispatch({ type: 'SET_TERMINAL_STATUS', terminalId: id, status });

  return (
    <>
      <PageHeader
        title="Terminal Management"
        subtitle={`${state.terminals.length} classroom terminals across the Year 10 building`}
        actions={
          <Button
            appearance="outline"
            icon={<ArrowSync16Regular />}
            onClick={syncAll}
            disabled={counts.queued === 0}
          >
            Synchronise queued scans
          </Button>
        }
      />

      {lastSync && (
        <MessageBar intent="success" style={{ marginBottom: 16 }}>
          <MessageBarBody>
            Synchronisation completed at {lastSync}. Queued scans were written to the attendance
            records and the terminals returned to ONLINE.
          </MessageBarBody>
        </MessageBar>
      )}

      <Section title="Fleet status">
        <StatGrid>
          <StatTile value={counts.online} label="Online" tone="success" />
          <StatTile value={counts.offline} label="Offline" tone="danger" />
          <StatTile value={counts.syncing} label="Syncing" tone="warning" />
          <StatTile value={counts.event} label="Event mode" tone={counts.event ? 'danger' : undefined} />
          <StatTile value={counts.queued} label="Queued scans" tone={counts.queued ? 'warning' : undefined} />
        </StatGrid>
      </Section>

      <div className="scas-row" style={{ marginBottom: 12 }}>
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
          Filter
        </Text>
        <Select
          value={filter}
          options={[
            { key: 'ALL', text: 'All terminals' },
            { key: 'ONLINE', text: 'Online' },
            { key: 'OFFLINE', text: 'Offline' },
            { key: 'SYNCING', text: 'Syncing' },
            { key: 'EVENT', text: 'Event mode' },
          ]}
          onChange={(v) => setFilter(v)}
          style={{ minWidth: 160 }}
        />
        <span className="scas-spacer" />
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
          {visible.length} shown
        </Text>
      </div>

      <Card appearance="outline" style={{ padding: 0 }}>
        <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 620 }}>
          <table className="scas-table">
            <thead>
              <tr>
                <th>Terminal</th>
                <th>Room</th>
                <th>Lesson now</th>
                <th>Status</th>
                <th>Mode</th>
                <th style={{ textAlign: 'right' }}>Queued</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const block = getBlockForRoom(
                  data,
                  { week: state.week, day: state.day, time: state.time },
                  t.roomId,
                );
                const lesson = block
                  ? data.subjects.find(
                      (s) =>
                        s.subjectId ===
                        data.classes.find((c) => c.classId === block.classId)?.subjectId,
                    )
                  : null;
                return (
                  <tr key={t.terminalId}>
                    <td style={{ fontWeight: 500 }}>{t.label}</td>
                    <td className="scas-mono">{t.roomId}</td>
                    <td>
                      {block ? (
                        <>
                          {lesson?.abbreviation} · {block.classId}
                          <Text
                            size={100}
                            style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}
                          >
                            {formatTime(block.startTime)}–{formatTime(block.endTime)}
                          </Text>
                        </>
                      ) : (
                        <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                          no lesson
                        </Text>
                      )}
                    </td>
                    <td>
                      <TerminalPill status={t.status} />
                    </td>
                    <td>
                      {t.mode === 'EVENT' ? (
                        <Text size={200} style={{ color: 'var(--colorPaletteCrimsonForeground1)', fontWeight: 600 }}>
                          EVENT
                        </Text>
                      ) : (
                        <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                          NORMAL
                        </Text>
                      )}
                    </td>
                    <td className="num">
                      {t.queuedScans > 0 ? (
                        <Text size={200} style={{ color: 'var(--colorPaletteMarigoldForeground1)', fontWeight: 600 }}>
                          {t.queuedScans}
                        </Text>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {t.status === 'ONLINE' ? (
                        <Button
                          size="small"
                          appearance="subtle"
                          onClick={() => setStatus(t.terminalId, 'OFFLINE')}
                        >
                          Take offline
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<ArrowClockwise16Regular />}
                          onClick={() => setStatus(t.terminalId, 'ONLINE')}
                        >
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Section title="How offline synchronisation works">
        <Card appearance="outline" style={{ padding: 14 }}>
          <Text size={200} style={{ color: 'var(--colorNeutralForeground2)' }}>
            While a terminal is OFFLINE, scans are written to the attendance record with{' '}
            <b>pendingSync = true</b> and counted in the terminal&apos;s local queue. They appear
            immediately in the teacher review and audit views so nothing is lost. Choosing
            &ldquo;Synchronise queued scans&rdquo; drains the queue in timestamp order, clears the
            pending flag and returns the terminal to ONLINE.
          </Text>
        </Card>
      </Section>
    </>
  );
}
