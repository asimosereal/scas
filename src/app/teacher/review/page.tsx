'use client';

/**
 * END-OF-DAY TEACHER REVIEW
 * ==================================================================
 * Suspicious scans, uncertain identity, manual entries, absent records
 * and anything awaiting confirmation. A teacher can CONFIRM or
 * OVERRIDE, and an override always demands a reason and always writes
 * an audit entry.
 */

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,

  Field,
  Option,
  Radio,
  RadioGroup,
  Tab,
  TabList,
  Text,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { ArrowClockwise16Regular } from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatGrid, StatTile, StatusPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatDuration, formatTime } from '@/lib/time';
import { OVERRIDE_REASONS } from '@/lib/engine/attendance-engine';
import { getStudentGroup } from '@/lib/data/students';

type ReviewTab = 'queue' | 'day' | 'audit';

export default function TeacherReviewPage() {
  const { state, data, dispatch } = useSim();
  const [tab, setTab] = useState<ReviewTab>('queue');
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'PRESENT' | 'LATE' | 'ABSENT' | 'REVIEW'>('PRESENT');
  const [reason, setReason] = useState<string>(OVERRIDE_REASONS[0]);
  const [error, setError] = useState('');

  const teacher = data.teachers.find((t) => t.teacherId === state.currentTeacherId);
  const dayRecords = useMemo(
    () => state.attendance.filter((r) => r.week === state.week && r.day === state.day),
    [state.attendance, state.week, state.day],
  );

  const queue = useMemo(
    () =>
      dayRecords.filter(
        (r) => r.reviewStatus === 'PENDING' || r.status === 'REVIEW' || r.status === 'ABSENT',
      ),
    [dayRecords],
  );

  const stats = useMemo(
    () => ({
      total: dayRecords.length,
      review: dayRecords.filter((r) => r.status === 'REVIEW').length,
      absent: dayRecords.filter((r) => r.status === 'ABSENT').length,
      manual: dayRecords.filter((r) => r.verificationMethod === 'MANUAL_ID_PIN').length,
      overrides: state.audit.filter((a) => a.action === 'ATTENDANCE_OVERRIDE').length,
    }),
    [dayRecords, state.audit],
  );

  const openOverride = (recordId: string) => {
    const rec = dayRecords.find((r) => r.attendanceId === recordId);
    setOverrideTarget(recordId);
    setNewStatus(rec?.status === 'ABSENT' ? 'PRESENT' : 'ABSENT');
    setReason(OVERRIDE_REASONS[0]);
    setError('');
  };

  const applyOverride = () => {
    if (!overrideTarget) return;
    if (!reason.trim()) {
      setError('A REASON IS REQUIRED FOR EVERY OVERRIDE');
      return;
    }
    dispatch({
      type: 'OVERRIDE',
      recordId: overrideTarget,
      newStatus,
      reason,
      teacherId: state.currentTeacherId,
    });
    setOverrideTarget(null);
  };

  const confirm = (recordId: string) => {
    dispatch({ type: 'REVIEW_CONFIRM', recordId, teacherId: state.currentTeacherId });
  };

  const onTab = (_e: SelectTabEvent, d: SelectTabData) => setTab(d.value as ReviewTab);

  const studentName = (id: string) => data.students.find((s) => s.studentId === id)?.name ?? id;
  const studentNum = (id: string) => data.students.find((s) => s.studentId === id)?.studentNumber ?? '';

  return (
    <>
      <PageHeader
        title="End-of-Day Review"
        subtitle={`${state.day} · Week ${state.week} — reviewing as ${teacher?.name ?? 'teacher'}`}
        actions={
          <Button
            appearance="outline"
            icon={<ArrowClockwise16Regular />}
            onClick={() => dispatch({ type: 'RESET_DAY' })}
          >
            Clear simulated day
          </Button>
        }
      />

      <Section title="Review summary" description="Everything generated during the simulated day">
        <StatGrid>
          <StatTile value={stats.total} label="Records" />
          <StatTile value={stats.review} label="Awaiting review" tone="brand" />
          <StatTile value={stats.absent} label="Absent" tone="danger" />
          <StatTile value={stats.manual} label="Manual (ID + PIN)" tone="warning" />
          <StatTile value={stats.overrides} label="Overrides logged" />
        </StatGrid>
      </Section>

      <TabList selectedValue={tab} onTabSelect={onTab} size="small">
        <Tab value="queue">Review queue ({queue.length})</Tab>
        <Tab value="day">All records ({dayRecords.length})</Tab>
        <Tab value="audit">Audit log ({state.audit.length})</Tab>
      </TabList>

      <div style={{ marginTop: 16 }}>
        {/* ---------------- Review queue ---------------- */}
        {tab === 'queue' && (
          <Card appearance="outline" style={{ padding: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
              <Text weight="semibold" size={200}>
                Records requiring attention
              </Text>
              <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                Uncertain identity, manual verification and absences
              </Text>
            </div>
            <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 560 }}>
              <table className="scas-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>ID</th>
                    <th>Class</th>
                    <th>Room</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Verification</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        Nothing to review. Simulate some scans from the Device Simulator, then return
                        here.
                      </td>
                    </tr>
                  )}
                  {queue.map((r) => (
                    <tr key={r.attendanceId}>
                      <td style={{ fontWeight: 500 }}>{studentName(r.studentId)}</td>
                      <td className="scas-mono">{studentNum(r.studentId)}</td>
                      <td>{r.classId}</td>
                      <td>{r.roomId}</td>
                      <td className="scas-mono">
                        {r.entryTime !== null ? formatTime(r.entryTime) : '—'}
                      </td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        {r.verificationMethod}
                        {r.verificationConfidence !== null && (
                          <Text
                            size={100}
                            style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}
                          >
                            {r.verificationConfidence}%
                          </Text>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {r.reviewStatus === 'PENDING' || r.status === 'REVIEW' ? (
                          <>
                            <Button
                              size="small"
                              appearance="primary"
                              onClick={() => confirm(r.attendanceId)}
                              style={{ marginRight: 6 }}
                            >
                              Confirm
                            </Button>
                            <Button size="small" appearance="outline" onClick={() => openOverride(r.attendanceId)}>
                              Override
                            </Button>
                          </>
                        ) : (
                          <Button size="small" appearance="subtle" onClick={() => openOverride(r.attendanceId)}>
                            Override
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ---------------- All records ---------------- */}
        {tab === 'day' && (
          <Card appearance="outline" style={{ padding: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
              <Text weight="semibold" size={200}>
                Every attendance record generated today
              </Text>
            </div>
            <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 560 }}>
              <table className="scas-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Group</th>
                    <th>Class</th>
                    <th>Room</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Status</th>
                    <th>Late</th>
                    <th>Break</th>
                    <th>Method</th>
                    <th>Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRecords.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        No attendance records for {state.day}, Week {state.week}.
                      </td>
                    </tr>
                  )}
                  {dayRecords.map((r) => (
                    <tr key={r.attendanceId}>
                      <td style={{ fontWeight: 500 }}>{studentName(r.studentId)}</td>
                      <td>{getStudentGroup(r.studentId)}</td>
                      <td>{r.classId}</td>
                      <td>{r.roomId}</td>
                      <td className="scas-mono">{r.entryTime !== null ? formatTime(r.entryTime) : '—'}</td>
                      <td className="scas-mono">{r.exitTime !== null ? formatTime(r.exitTime) : '—'}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td className="num scas-mono">
                        {r.lateMinutes > 0 ? formatDuration(r.lateMinutes) : '—'}
                      </td>
                      <td className="num scas-mono">
                        {r.breakMinutes > 0 ? formatDuration(r.breakMinutes) : '—'}
                      </td>
                      <td>{r.verificationMethod}</td>
                      <td>
                        {r.pendingSync ? (
                          <Badge appearance="tint" color="warning" size="small">
                            QUEUED
                          </Badge>
                        ) : (
                          <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                            synced
                          </Text>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ---------------- Audit ---------------- */}
        {tab === 'audit' && (
          <Card appearance="outline" style={{ padding: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
              <Text weight="semibold" size={200}>
                Audit log — every change is recorded
              </Text>
              <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                Attendance is never modified silently
              </Text>
            </div>
            <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 560 }}>
              <table className="scas-table">
                <thead>
                  <tr>
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
                      <td colSpan={8} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        The audit log is empty. Overriding a record or raising a room exception writes
                        an entry here.
                      </td>
                    </tr>
                  )}
                  {state.audit.map((a) => (
                    <tr key={a.auditId}>
                      <td className="scas-mono">{formatTime(a.timestamp)}</td>
                      <td>{a.userId}</td>
                      <td>{a.userRole}</td>
                      <td>
                        <Badge appearance="outline" size="small">
                          {a.action}
                        </Badge>
                      </td>
                      <td className="scas-mono" style={{ fontSize: 11 }}>
                        {a.recordId.slice(0, 34)}
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
      </div>

      {/* ---------------- Override dialog ---------------- */}
      <Dialog
        open={overrideTarget !== null}
        onOpenChange={(_, d) => !d.open && setOverrideTarget(null)}
        modalType="modal"
      >
        <DialogSurface aria-label="Override attendance record">
          <DialogBody>
            <DialogTitle>Override attendance record</DialogTitle>
            <DialogContent>
              {overrideTarget && (
                <>
                  <Card
                    appearance="outline"
                    style={{ padding: 12, marginBottom: 14, background: 'var(--colorNeutralBackground2)' }}
                  >
                    <KV
                      items={[
                        [
                          'Student',
                          `${studentName(
                            dayRecords.find((r) => r.attendanceId === overrideTarget)?.studentId ?? '',
                          )} (${studentNum(
                            dayRecords.find((r) => r.attendanceId === overrideTarget)?.studentId ?? '',
                          )})`,
                        ],
                        [
                          'Record',
                          `${dayRecords.find((r) => r.attendanceId === overrideTarget)?.classId} · ${
                            dayRecords.find((r) => r.attendanceId === overrideTarget)?.roomId
                          }`,
                        ],
                        [
                          'Current status',
                          <StatusPill
                            status={dayRecords.find((r) => r.attendanceId === overrideTarget)?.status ?? 'NEUTRAL'}
                            key="st"
                          />,
                        ],
                      ]}
                    />
                  </Card>

                  <Field label="New status" style={{ marginBottom: 12 }}>
                    <RadioGroup
                      layout="horizontal"
                      value={newStatus}
                      onChange={(_, d) => setNewStatus(d.value as typeof newStatus)}
                    >
                      <Radio value="PRESENT" label="Present" />
                      <Radio value="LATE" label="Late" />
                      <Radio value="ABSENT" label="Absent" />
                      <Radio value="REVIEW" label="Review" />
                    </RadioGroup>
                  </Field>

                  <Field
                    label="Reason (mandatory)"
                    validationState={error ? 'error' : 'none'}
                    validationMessage={error || undefined}
                  >
                    <Select
                      value={reason}
                      options={OVERRIDE_REASONS.map((r) => ({ key: r, text: r }))}
                      onChange={(v) => {
                        setReason(v);
                        setError('');
                      }}
                    />
                  </Field>

                  <Text
                    size={100}
                    style={{ display: 'block', marginTop: 10, color: 'var(--colorNeutralForeground3)' }}
                  >
                    The original status, new status, your name, the timestamp and this reason are
                    written to the audit log. Attendance records are never changed silently.
                  </Text>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setOverrideTarget(null)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={applyOverride}>
                Apply override
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
