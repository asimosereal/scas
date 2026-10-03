'use client';

/**
 * TEACHER DASHBOARD
 * ==================================================================
 * Class-specific by design. The lesson shown is derived from
 * teacher + simulation time + room. Move the clock and the roster,
 * the counters and the lesson header all follow automatically.
 *
 * The teacher observes the automatically resolved class — they do not
 * pick rooms to figure out what they are teaching. Room and "simulate
 * tap" are simulation controls, kept in a separate dialog.
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
  Input,
  Tab,
  TabList,
  Text,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { Search16Regular, Play20Filled } from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatGrid, StatTile, StatusPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatDuration, formatTime } from '@/lib/time';
import {
  getCurrentTeacherBlock,
  getExpectedStudents,
  getTeacherClasses,
  toLesson,
} from '@/lib/engine/timetable-engine';
import { summariseLesson } from '@/lib/engine/attendance-engine';
import { getStudentGroup } from '@/lib/data/students';

export default function TeacherDashboardPage() {
  const { state, data, dispatch, runScan } = useSim();
  const [tab, setTab] = useState<'roster' | 'timeline'>('roster');
  const [filter, setFilter] = useState('');
  const [simOpen, setSimOpen] = useState(false);

  const teacher = data.teachers.find((t) => t.teacherId === state.currentTeacherId);
  const myClasses = useMemo(
    () => getTeacherClasses(data, state.currentTeacherId),
    [data, state.currentTeacherId],
  );

  /* The block this teacher is running RIGHT NOW, honouring the
     currently selected room. Falls back to any of the teacher's
     concurrent blocks. */
  const block = useMemo(
    () =>
      getCurrentTeacherBlock(
        data,
        state.currentTeacherId,
        { week: state.week, day: state.day, time: state.time },
        state.sim.roomId,
      ),
    [data, state.currentTeacherId, state.week, state.day, state.time, state.sim.roomId],
  );

  /* Also offer the teacher's full day so the view is useful outside
     lesson time. */
  const dayBlocks = useMemo(
    () =>
      data.timetableBlocks
        .filter(
          (b) =>
            b.week === state.week &&
            b.day === state.day &&
            myClasses.some((m) => m.cls.classId === b.classId),
        )
        .sort((a, b) => a.startTime - b.startTime),
    [data, state.week, state.day, myClasses],
  );

  const lesson = block ? toLesson(data, block) : null;
  const expected = useMemo(
    () => (lesson ? getExpectedStudents(data, lesson.class.classId, state.week) : []),
    [data, lesson, state.week],
  );
  const records = useMemo(
    () => (block ? state.attendance.filter((r) => r.blockId === block.blockId) : []),
    [state.attendance, block],
  );
  const summary = useMemo(
    () => summariseLesson(expected.map((s) => s.studentId), records),
    [expected, records],
  );

  const onTabSelect = (_e: SelectTabEvent, d: SelectTabData) =>
    setTab(d.value as 'roster' | 'timeline');

  const visible = expected.filter((s) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.studentNumber.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        title="Teacher view"
        subtitle={`${teacher?.name ?? 'Teacher'} — ${myClasses.length} class${myClasses.length === 1 ? '' : 'es'} in the Year 10 timetable`}
        actions={
          <Button appearance="outline" onClick={() => setSimOpen(true)}>
            Simulation controls
          </Button>
        }
      />

      {/* ---------------- Current lesson header ---------------- */}
      <Card appearance="outline" style={{ padding: 0, marginBottom: 20 }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--colorNeutralStroke2)',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="scas-caption" style={{ marginBottom: 2 }}>
              Current time
            </div>
            <Text
              size={700}
              weight="semibold"
              style={{ fontVariantNumeric: 'tabular-nums', lineHeight: '36px' }}
            >
              {formatTime(state.time)}
            </Text>
          </div>

          {lesson ? (
            <>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--colorNeutralStroke2)' }} />
              <div>
                <div className="scas-caption" style={{ marginBottom: 2 }}>
                  Lesson
                </div>
                <Text size={400} weight="semibold" style={{ display: 'block' }}>
                  {lesson.subject.name} · {lesson.class.classId}
                </Text>
                <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {formatTime(lesson.block.startTime)} – {formatTime(lesson.block.endTime)} · Room{' '}
                  {lesson.room.roomName}
                </Text>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--colorNeutralStroke2)' }} />
              <div>
                <div className="scas-caption" style={{ marginBottom: 2 }}>
                  Class ID
                </div>
                <Text size={300} weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {lesson.class.classId}
                </Text>
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--colorNeutralStroke2)' }} />
              <div>
                <div className="scas-caption" style={{ marginBottom: 2 }}>
                  No active lesson
                </div>
                <Text size={300} weight="semibold">
                  This teacher has no class running at {formatTime(state.time)} on {state.day} (Week{' '}
                  {state.week}).
                </Text>
              </div>
            </>
          )}
        </div>

        {lesson && (
          <div style={{ padding: 14 }}>
            <StatGrid>
              <StatTile value={summary.expected} label="Expected" />
              <StatTile value={summary.present} label="Present" tone="success" />
              <StatTile value={summary.late} label="Late" tone="warning" />
              <StatTile value={summary.absent} label="Absent" tone="danger" />
              <StatTile value={summary.review} label="Review required" tone="brand" />
              <StatTile
                value={`${Math.round((summary.present / Math.max(1, summary.expected)) * 100)}%`}
                label="Attendance"
              />
            </StatGrid>
          </div>
        )}
      </Card>

      {/* ---------------- Tabs ---------------- */}
      <TabList selectedValue={tab} onTabSelect={onTabSelect} size="small">
        <Tab value="roster">Expected student list</Tab>
        <Tab value="timeline">My teaching day</Tab>
      </TabList>

      <div style={{ marginTop: 16 }}>
        {tab === 'roster' && (
          <Card appearance="outline" style={{ padding: 0 }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--colorNeutralStroke2)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text weight="semibold" size={200}>
                {lesson
                  ? `${lesson.class.classId} · ${lesson.subject.name} · ${lesson.room.roomName}`
                  : 'No active lesson'}
              </Text>
              <span className="scas-spacer" />
              <Field style={{ margin: 0 }}>
                <Input
                  contentBefore={<Search16Regular />}
                  value={filter}
                  onChange={(_, d) => setFilter(d.value)}
                  placeholder="Filter by name or ID"
                  style={{ width: 240 }}
                />
              </Field>
            </div>

            <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 520 }}>
              <table className="scas-table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>#</th>
                    <th>Student</th>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Scan time</th>
                    <th>Late</th>
                    <th>Verification</th>
                    <th>Confidence</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        {lesson
                          ? 'No students match the filter.'
                          : 'There is no active lesson, so no expected student list is available.'}
                      </td>
                    </tr>
                  )}
                  {visible.map((s, i) => {
                    const rec = records.find((r) => r.studentId === s.studentId);
                    return (
                      <tr key={s.studentId}>
                        <td className="num" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          {i + 1}
                        </td>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td className="scas-mono">{s.studentNumber}</td>
                        <td>
                          <StatusPill status={rec?.status ?? 'NEUTRAL'} />
                        </td>
                        <td className="scas-mono">
                          {rec?.entryTime !== null && rec?.entryTime !== undefined
                            ? formatTime(rec.entryTime)
                            : '—'}
                        </td>
                        <td className="num scas-mono">
                          {rec && rec.lateMinutes > 0 ? formatDuration(rec.lateMinutes) : '—'}
                        </td>
                        <td>{rec ? rec.verificationMethod : '—'}</td>
                        <td className="num scas-mono">
                          {rec?.verificationConfidence !== null &&
                          rec?.verificationConfidence !== undefined
                            ? `${rec.verificationConfidence}%`
                            : '—'}
                        </td>
                        <td>
                          {rec?.reviewStatus === 'PENDING' ? (
                            <Badge appearance="tint" color="informative" size="small">
                              Yes
                            </Badge>
                          ) : rec?.reviewStatus === 'OVERRIDDEN' ? (
                            <Badge appearance="tint" color="brand" size="small">
                              Overridden
                            </Badge>
                          ) : rec?.reviewStatus === 'CONFIRMED' ? (
                            <Badge appearance="tint" color="success" size="small">
                              Confirmed
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'timeline' && (
          <Card appearance="outline" style={{ padding: 0 }}>
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--colorNeutralStroke2)',
              }}
            >
              <Text weight="semibold" size={200}>
                {state.day} · Week {state.week}
              </Text>
            </div>
            <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0 }}>
              <table className="scas-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Room</th>
                    <th>Group</th>
                    <th style={{ textAlign: 'right' }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {dayBlocks.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        No lessons timetabled for this teacher on {state.day}.
                      </td>
                    </tr>
                  )}
                  {dayBlocks.map((b) => {
                    const l = toLesson(data, b);
                    const isNow = state.time >= b.startTime && state.time < b.endTime;
                    const exp = getExpectedStudents(data, b.classId, state.week);
                    const recs = state.attendance.filter((r) => r.blockId === b.blockId);
                    const sum = summariseLesson(exp.map((x) => x.studentId), recs);
                    return (
                      <tr
                        key={b.blockId}
                        data-selected={isNow}
                        onClick={() => dispatch({ type: 'SET_SIM', patch: { roomId: b.roomId } })}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="scas-mono">
                          {formatTime(b.startTime)}–{formatTime(b.endTime)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{b.classId}</td>
                        <td>{l.subject.name}</td>
                        <td>{b.roomId}</td>
                        <td>{l.class.classId}</td>
                        <td className="num">
                          {sum.present + sum.late} / {sum.expected}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Section title="Role note">
        <Card appearance="outline" style={{ padding: 14 }}>
          <Text size={200} style={{ color: 'var(--colorNeutralForeground2)' }}>
            This dashboard is class-scoped: the roster is generated from the students enrolled in{' '}
            {lesson ? lesson.class.classId : 'the active class'} for Week {state.week}, never from
            the whole year group. Change the simulation time and the active lesson, roster and
            counters update automatically.
          </Text>
        </Card>
      </Section>

      {/* ---------------- Simulation controls dialog ---------------- */}
      <Dialog
        open={simOpen}
        onOpenChange={(_, d) => setSimOpen(d.open)}
        modalType="modal"
      >
        <DialogSurface aria-label="Simulation controls">
          <DialogBody>
            <DialogTitle>Simulation controls</DialogTitle>
            <DialogContent>
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Room" style={{ display: 'grid', gap: 4 }}>
                  <Select
                    value={state.sim.roomId}
                    options={data.rooms.map((r) => ({ key: r.roomId, text: r.roomName }))}
                    onChange={(v) => dispatch({ type: 'SET_SIM', patch: { roomId: v } })}
                  />
                </Field>
                <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                  The room selector is a simulation aid. In normal use the lesson is resolved from the
                  timetable and the clock — the teacher does not choose rooms.
                </Text>
                <Button
                  appearance="primary"
                  icon={<Play20Filled />}
                  onClick={() => {
                    runScan();
                    setSimOpen(false);
                  }}
                >
                  Simulate tap as selected student
                </Button>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setSimOpen(false)}>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
