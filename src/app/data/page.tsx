'use client';

/**
 * ATTENDANCE & AUDIT DATA
 * ==================================================================
 * The raw record view — every attendance record, scan event and audit
 * entry, filterable. This is the evidence layer behind the dashboards.
 */

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Tab,
  TabList,
  Text,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { KV, PageHeader, ScanResultBadge, Section, StatGrid, StatTile, StatusPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatDuration, formatTime } from '@/lib/time';
import { getStudentGroup } from '@/lib/data/students';
import { DAYS } from '@/lib/types';

type Tab = 'attendance' | 'scans' | 'audit';
type DateTab = 'today' | 'all';

export default function DataPage() {
  const { state, data } = useSim();
  const [tab, setTab] = useState<Tab>('attendance');
  const [scope, setScope] = useState<DateTab>('today');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const inScope = useMemo(
    () => (r: { week: string; day: string }) =>
      scope === 'all' ? true : r.week === state.week && r.day === state.day,
    [scope, state.week, state.day],
  );

  const attendance = useMemo(
    () =>
      state.attendance
        .filter(inScope)
        .filter((r) => statusFilter === 'ALL' || r.status === statusFilter),
    [state.attendance, inScope, statusFilter],
  );

  const scans = useMemo(() => state.scans.filter(inScope), [state.scans, inScope]);

  const stats = useMemo(
    () => ({
      total: attendance.length,
      present: attendance.filter((r) => r.status === 'PRESENT').length,
      late: attendance.filter((r) => r.status === 'LATE').length,
      absent: attendance.filter((r) => r.status === 'ABSENT').length,
      review: attendance.filter((r) => r.status === 'REVIEW').length,
    }),
    [attendance],
  );

  const studentName = (id: string) => data.students.find((s) => s.studentId === id)?.name ?? id;
  const studentNum = (id: string) => data.students.find((s) => s.studentId === id)?.studentNumber ?? '';

  const onTab = (_e: SelectTabEvent, d: SelectTabData) => setTab(d.value as Tab);

  const exportCsv = () => {
    const rows = [
      ['attendance_id', 'student', 'student_number', 'class', 'room', 'week', 'day', 'entry', 'exit', 'status', 'late_min', 'method', 'confidence', 'review', 'pending_sync'],
      ...attendance.map((r) => [
        r.attendanceId, studentName(r.studentId), studentNum(r.studentId), r.classId, r.roomId,
        r.week, r.day,
        r.entryTime !== null ? formatTime(r.entryTime) : '',
        r.exitTime !== null ? formatTime(r.exitTime) : '',
        r.status, String(r.lateMinutes), r.verificationMethod,
        r.verificationConfidence !== null ? String(r.verificationConfidence) : '',
        r.reviewStatus, String(r.pendingSync),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scas-attendance-${state.week}-${state.day}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Attendance & Audit Data"
        subtitle="Raw records produced by the attendance engine. Nothing here is derived on the fly."
        actions={
          <Button appearance="outline" onClick={exportCsv} disabled={attendance.length === 0}>
            Export CSV
          </Button>
        }
      />

      <div className="scas-row" style={{ marginBottom: 16 }}>
        <TabList selectedValue={tab} onTabSelect={onTab} size="small">
          <Tab value="attendance">Attendance ({state.attendance.length})</Tab>
          <Tab value="scans">Scan events ({state.scans.length})</Tab>
          <Tab value="audit">Audit log ({state.audit.length})</Tab>
        </TabList>
        <span className="scas-spacer" />
        <Select
          value={scope}
          options={[
            { key: 'today', text: `Today — ${state.day} (Week ${state.week})` },
            { key: 'all', text: 'All simulated records' },
          ]}
          onChange={(v) => setScope(v as DateTab)}
          style={{ minWidth: 220 }}
        />
        {tab === 'attendance' && (
          <Select
            value={statusFilter}
            options={[
              { key: 'ALL', text: 'All statuses' },
              { key: 'PRESENT', text: 'Present' },
              { key: 'LATE', text: 'Late' },
              { key: 'ABSENT', text: 'Absent' },
              { key: 'REVIEW', text: 'Review' },
            ]}
            onChange={(v) => setStatusFilter(v)}
            style={{ minWidth: 150 }}
          />
        )}
      </div>

      {tab === 'attendance' && (
        <>
          <Section title="Record totals">
            <StatGrid>
              <StatTile value={stats.total} label="Records" />
              <StatTile value={stats.present} label="Present" tone="success" />
              <StatTile value={stats.late} label="Late" tone="warning" />
              <StatTile value={stats.absent} label="Absent" tone="danger" />
              <StatTile value={stats.review} label="Review" tone="brand" />
            </StatGrid>
          </Section>

          <Card appearance="outline" style={{ padding: 0 }}>
            <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 620 }}>
              <table className="scas-table">
                <thead>
                  <tr>
                    <th>Attendance ID</th>
                    <th>Student</th>
                    <th>ID</th>
                    <th>Grp</th>
                    <th>Class</th>
                    <th>Room</th>
                    <th>Day</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Status</th>
                    <th>Late</th>
                    <th>Method</th>
                    <th>Conf.</th>
                    <th>Review</th>
                    <th>Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={15} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        No attendance records yet. Simulate some taps from the Device Simulator.
                      </td>
                    </tr>
                  )}
                  {attendance.map((r) => (
                    <tr key={r.attendanceId}>
                      <td className="scas-mono" style={{ fontSize: 11 }}>
                        {r.attendanceId}
                      </td>
                      <td style={{ fontWeight: 500 }}>{studentName(r.studentId)}</td>
                      <td className="scas-mono">{studentNum(r.studentId)}</td>
                      <td>{getStudentGroup(r.studentId)}</td>
                      <td>{r.classId}</td>
                      <td>{r.roomId}</td>
                      <td>
                        {r.day.slice(0, 3)} · {r.week}
                      </td>
                      <td className="scas-mono">{r.entryTime !== null ? formatTime(r.entryTime) : '—'}</td>
                      <td className="scas-mono">{r.exitTime !== null ? formatTime(r.exitTime) : '—'}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td className="num scas-mono">
                        {r.lateMinutes > 0 ? formatDuration(r.lateMinutes) : '—'}
                      </td>
                      <td>{r.verificationMethod}</td>
                      <td className="num scas-mono">
                        {r.verificationConfidence !== null ? `${r.verificationConfidence}%` : '—'}
                      </td>
                      <td>{r.reviewStatus}</td>
                      <td>
                        {r.pendingSync ? (
                          <Text size={100} style={{ color: 'var(--colorPaletteMarigoldForeground1)', fontWeight: 600 }}>
                            QUEUED
                          </Text>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'scans' && (
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Text weight="semibold" size={200}>
              Terminal scan events
            </Text>
            <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
              Every RFID tap processed by the engine, newest first
            </Text>
          </div>
          <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 620 }}>
            <table className="scas-table">
              <thead>
                <tr>
                  <th>Scan ID</th>
                  <th>Time</th>
                  <th>Terminal</th>
                  <th>Student</th>
                  <th>Result</th>
                  <th>Conf.</th>
                  <th>Synced</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      No scan events recorded.
                    </td>
                  </tr>
                )}
                {scans.map((s) => (
                  <tr key={s.scanId}>
                    <td className="scas-mono" style={{ fontSize: 11 }}>
                      {s.scanId}
                    </td>
                    <td className="scas-mono">
                      {formatTime(s.timestamp)} · {s.day.slice(0, 3)} · {s.week}
                    </td>
                    <td>{s.terminalId.replace('T-', '')}</td>
                    <td>
                      {s.studentId ? `${studentName(s.studentId)} (${studentNum(s.studentId)})` : '—'}
                    </td>
                    <td>
                      <ScanResultBadge result={s.result} />
                    </td>
                    <td className="num scas-mono">
                      {s.verificationConfidence !== null ? `${s.verificationConfidence}%` : '—'}
                    </td>
                    <td>{s.synced ? 'yes' : 'pending'}</td>
                    <td style={{ color: 'var(--colorNeutralForeground2)' }}>{s.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'audit' && (
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Text weight="semibold" size={200}>
              Audit log
            </Text>
            <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
              Every manual change and raised exception
            </Text>
          </div>
          <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 620 }}>
            <table className="scas-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Old</th>
                  <th>New</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {state.audit.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      The audit log is empty.
                    </td>
                  </tr>
                )}
                {state.audit.map((a) => (
                  <tr key={a.auditId}>
                    <td className="scas-mono" style={{ fontSize: 11 }}>
                      {a.auditId}
                    </td>
                    <td className="scas-mono">
                      {formatTime(a.timestamp)} · {a.day.slice(0, 3)} · {a.week}
                    </td>
                    <td>{a.userId}</td>
                    <td>{a.userRole}</td>
                    <td style={{ fontWeight: 600 }}>{a.action}</td>
                    <td className="scas-mono" style={{ fontSize: 11 }}>
                      {a.recordId}
                    </td>
                    <td>{a.oldValue}</td>
                    <td>{a.newValue}</td>
                    <td style={{ color: 'var(--colorNeutralForeground2)' }}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Section title="Schema reference">
        <Card appearance="outline" style={{ padding: 14 }}>
          <KV
            items={[
              ['ATTENDANCE', 'student_id, class_id, room_id, entry_time, exit_time, status, late_minutes, verification_method, review_status, override_reason'],
              ['SCAN_EVENTS', 'terminal_id, student_id, timestamp, result, verification_confidence'],
              ['AUDIT_LOG', 'user_id, action, record_id, old_value, new_value, reason, timestamp'],
              [
                'Note',
                'Times are stored as minutes since midnight and represent SIMULATION time, not wall-clock time.',
              ],
            ]}
          />
        </Card>
      </Section>
    </>
  );
}
