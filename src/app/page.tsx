'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
} from '@fluentui/react-components';
import {
  ArrowRight16Regular,
  Desktop16Regular,
  ErrorCircle16Regular,
  Warning16Regular,
} from '@fluentui/react-icons';
import { KV, PageHeader, ScanResultBadge, Section, StatGrid, StatTile } from '@/components/ui';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import { toLesson } from '@/lib/engine/timetable-engine';
import { summariseLesson } from '@/lib/engine/attendance-engine';
import { getExpectedStudents } from '@/lib/engine/timetable-engine';

export default function DashboardPage() {
  const { state, data, activeBlocks, roomBlock, expectedLesson, teacherBlock } = useSim();

  /* ---- roll-up across every class running right now ---- */
  const now = useMemo(() => {
    let expected = 0;
    let present = 0;
    let late = 0;
    let absent = 0;
    let review = 0;

    for (const b of activeBlocks) {
      const students = getExpectedStudents(data, b.classId, state.week);
      const records = state.attendance.filter((r) => r.blockId === b.blockId);
      const s = summariseLesson(
        students.map((x) => x.studentId),
        records,
      );
      expected += s.expected;
      present += s.present;
      late += s.late;
      absent += s.absent;
      review += s.review;
    }
    return { expected, present, late, absent, review };
  }, [activeBlocks, data, state.attendance, state.week]);

  const terminals = state.terminals;
  const online = terminals.filter((t) => t.status === 'ONLINE').length;
  const offline = terminals.filter((t) => t.status === 'OFFLINE').length;
  const syncing = terminals.filter((t) => t.status === 'SYNCING').length;
  const queued = terminals.reduce((n, t) => n + t.queuedScans, 0);
  const activeEvents = state.events.filter((e) => e.active);

  const roomLesson = roomBlock ? toLesson(data, roomBlock) : null;
  const teacherLesson = teacherBlock ? toLesson(data, teacherBlock) : null;

  const recentScans = state.scans.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="System-wide attendance overview driven entirely by the simulation clock."
        actions={
          <>
            <Button as="a" href="/device" appearance="primary" icon={<ArrowRight16Regular />}>
              Open Device Simulator
            </Button>
            <Button as="a" href="/office" appearance="outline">
              Office view
            </Button>
          </>
        }
      />

      {/* Simulation clock banner */}
      <Card appearance="outline" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <Text
              size={200}
              weight="semibold"
              style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: 'normal' }}
            >
              Simulation clock
            </Text>
            <div
              style={{
                fontSize: 32,
                lineHeight: 38,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.01em',
              }}
            >
              {formatTime(state.time)}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--colorNeutralStroke2)' }} />
          <KV
            items={[
              ['Week / Day', `${state.week} / ${state.day}`],
              ['Date', state.date],
              ['Lessons in progress', String(activeBlocks.length)],
              [
                'Simulator room',
                roomLesson
                  ? `${roomLesson.room.roomName} — ${roomLesson.subject.name}`
                  : `${state.sim.roomId} — no lesson`,
              ],
            ]}
          />
        </div>
      </Card>

      {activeEvents.length > 0 && (
        <MessageBar intent="warning" style={{ marginBottom: 16 }}>
          <MessageBarBody>
            <MessageBarTitle>Event mode is active</MessageBarTitle>
            {activeEvents[0].eventName} — student movement is being recorded separately from
            lesson attendance.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Attendance roll-up */}
      <Section
        title="Attendance right now"
        description={`Aggregated across all ${activeBlocks.length} classes in progress`}
      >
        <StatGrid>
          <StatTile value={now.expected} label="Expected" />
          <StatTile value={now.present} label="Present" tone="success" />
          <StatTile value={now.late} label="Late" tone="warning" />
          <StatTile value={now.absent} label="Absent" tone="danger" />
          <StatTile value={now.review} label="Review required" tone="brand" />
        </StatGrid>
      </Section>

      {/* Terminals */}
      <Section
        title="Terminals"
        description="Simulated classroom devices"
        actions={
          <Button as="a" href="/office/terminals" appearance="subtle" size="small">
            Manage
          </Button>
        }
      >
        <StatGrid>
          <StatTile value={online} label="Online" tone="success" />
          <StatTile value={offline} label="Offline" tone="danger" />
          <StatTile value={syncing} label="Syncing" tone="warning" />
          <StatTile value={queued} label="Queued scans" tone={queued > 0 ? 'warning' : undefined} />
        </StatGrid>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Active lessons */}
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Text weight="semibold">Classes in progress</Text>
            <Text size={200} style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}>
              The central Year 10 timetable at {formatTime(state.time)}
            </Text>
          </div>
          <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 320 }}>
            <table className="scas-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Class</th>
                  <th>Lesson</th>
                  <th style={{ textAlign: 'right' }}>Expected</th>
                </tr>
              </thead>
              <tbody>
                {activeBlocks.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      No lessons are running at this time.
                    </td>
                  </tr>
                )}
                {activeBlocks.map((b) => {
                  const lesson = toLesson(data, b);
                  const count = getExpectedStudents(data, b.classId, state.week).length;
                  return (
                    <tr key={b.blockId}>
                      <td style={{ fontWeight: 600 }}>{lesson.room.roomName}</td>
                      <td>{lesson.class.classId}</td>
                      <td>
                        {lesson.subject.name}
                        <Text
                          size={200}
                          style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}
                        >
                          {formatTime(b.startTime)}–{formatTime(b.endTime)}
                        </Text>
                      </td>
                      <td className="num">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent scans */}
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Text weight="semibold">Recent scan activity</Text>
            <Text size={200} style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}>
              Newest first
            </Text>
          </div>
          <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 320 }}>
            <table className="scas-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Terminal</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      No scans yet. Use the Device Simulator to simulate an RFID tap.
                    </td>
                  </tr>
                )}
                {recentScans.map((s) => (
                  <tr key={s.scanId}>
                    <td className="scas-mono">{formatTime(s.timestamp)}</td>
                    <td>{s.terminalId.replace('T-', '')}</td>
                    <td>
                      <ScanResultBadge result={s.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Context cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          marginTop: 20,
        }}
      >
        <Card appearance="outline" style={{ padding: 16 }}>
          <Text weight="semibold" style={{ display: 'block', marginBottom: 8 }}>
            Simulator context
          </Text>
          <KV
            items={[
              ['Student', expectedLesson ? data.students.find((s) => s.studentId === state.sim.studentId)?.name ?? '—' : '—'],
              ['Card number', state.sim.typedStudentNumber],
              ['Terminal', state.sim.roomId],
              [
                'Expected now',
                expectedLesson
                  ? `${expectedLesson.subject.name} · ${expectedLesson.room.roomName}`
                  : 'Free period — no lesson',
              ],
            ]}
          />
          <Button
            as="a"
            href="/device"
            appearance="outline"
            style={{ marginTop: 12, width: '100%' }}
            icon={<Desktop16Regular />}
          >
            Change simulation inputs
          </Button>
        </Card>

        <Card appearance="outline" style={{ padding: 16 }}>
          <Text weight="semibold" style={{ display: 'block', marginBottom: 8 }}>
            Teacher context
          </Text>
          <KV
            items={[
              [
                'Signed in',
                data.teachers.find((t) => t.teacherId === state.currentTeacherId)?.name ?? '—',
              ],
              [
                'Teaching now',
                teacherLesson
                  ? `${teacherLesson.class.classId} · ${teacherLesson.subject.name} · ${teacherLesson.room.roomName}`
                  : 'No lesson at this time',
              ],
              ['Time', formatTime(state.time)],
            ]}
          />
          <Button
            as="a"
            href="/teacher"
            appearance="outline"
            style={{ marginTop: 12, width: '100%' }}
          >
            Open teacher dashboard
          </Button>
        </Card>
      </div>
    </>
  );
}
