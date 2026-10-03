'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Tab, TabList, Text } from '@fluentui/react-components';
import {
  CalendarLtr20Regular,
  PeopleTeam20Regular,
  ShieldTask20Regular,
  Desktop20Regular,
} from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatGrid, StatTile, TerminalPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import {
  getBlocksForDay,
  getCurrentTimetableBlock,
  getExpectedStudents,
  toLesson,
} from '@/lib/engine/timetable-engine';
import { summariseLesson } from '@/lib/engine/attendance-engine';
import { DAYS } from '@/lib/types';
import { getStudentGroup } from '@/lib/data/students';

export default function OfficeDashboardPage() {
  const { state, data, dispatch, setClock } = useSim();
  const [day, setDay] = useState(state.day);

  const dayBlocks = useMemo(
    () => getBlocksForDay(data, state.week, day),
    [data, state.week, day],
  );

  const active = useMemo(
    () => getCurrentTimetableBlock(data, { week: state.week, day: state.day, time: state.time }),
    [data, state.week, state.day, state.time],
  );

  const rollup = useMemo(() => {
    let e = 0, p = 0, l = 0, a = 0, r = 0;
    for (const b of active) {
      const exp = getExpectedStudents(data, b.classId, state.week).map((s) => s.studentId);
      const recs = state.attendance.filter((x) => x.blockId === b.blockId);
      const s = summariseLesson(exp, recs);
      e += s.expected; p += s.present; l += s.late; a += s.absent; r += s.review;
    }
    return { e, p, l, a, r };
  }, [active, data, state.attendance, state.week]);

  const rooms = useMemo(() => {
    const map = new Map<string, { room: string; cls: string; subject: string }>();
    active.forEach((b) => {
      const l = toLesson(data, b);
      map.set(b.roomId, {
        room: b.roomId,
        cls: l.class.classId,
        subject: l.subject.abbreviation,
      });
    });
    return [...map.values()].sort((x, y) => x.room.localeCompare(y.room));
  }, [active, data]);

  const online = state.terminals.filter((t) => t.status === 'ONLINE').length;
  const offline = state.terminals.filter((t) => t.status === 'OFFLINE').length;
  const activeEvents = state.events.filter((e) => e.active);

  return (
    <>
      <PageHeader
        title="Office Dashboard"
        subtitle="System-wide view across the Year 10 cohort, timetable, terminals and events."
        actions={
          <>
            <Button as="a" href="/office/timetable" appearance="outline" icon={<CalendarLtr20Regular />}>
              Central timetable
            </Button>
            <Button as="a" href="/office/students" appearance="outline" icon={<PeopleTeam20Regular />}>
              Students
            </Button>
            <Button as="a" href="/office/events" appearance="outline" icon={<ShieldTask20Regular />}>
              Events
            </Button>
            <Button as="a" href="/office/terminals" appearance="outline" icon={<Desktop20Regular />}>
              Terminals
            </Button>
          </>
        }
      />

      {/* Live roll-up */}
      <Section
        title="Live attendance"
        description={`${active.length} classes running at ${formatTime(state.time)} on ${state.day} (Week ${state.week})`}
      >
        <StatGrid>
          <StatTile value={active.length} label="Classes in progress" tone="brand" />
          <StatTile value={rollup.e} label="Expected" />
          <StatTile value={rollup.p} label="Present" tone="success" />
          <StatTile value={rollup.l} label="Late" tone="warning" />
          <StatTile value={rollup.a} label="Absent" tone="danger" />
          <StatTile value={rollup.r} label="Review" tone="brand" />
        </StatGrid>
      </Section>

      {activeEvents.length > 0 && (
        <Section title="Active event">
          <Card appearance="outline" style={{ padding: 16, borderColor: 'var(--colorPaletteCrimsonBorder1)' }}>
            <div className="scas-row">
              <Badge appearance="filled" color="danger">
                {activeEvents[0].eventType.replace(/_/g, ' ')}
              </Badge>
              <Text weight="semibold">{activeEvents[0].eventName}</Text>
              <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                started {formatTime(activeEvents[0].startTime)} · {activeEvents[0].terminalIds.length} terminals
              </Text>
              <span className="scas-spacer" />
              <Button as="a" href="/office/events" appearance="subtle" size="small">
                Manage
              </Button>
            </div>
          </Card>
        </Section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Day picker + schedule */}
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <div className="scas-row">
              <Text weight="semibold" size={200}>
                Day schedule
              </Text>
              <span className="scas-spacer" />
              <Select value={day} options={DAYS.map((d) => ({ key: d, text: d }))} onChange={(v) => setDay(v as any)} style={{ minWidth: 130 }} />
            </div>
          </div>
          <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 420 }}>
            <table className="scas-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Room</th>
                  <th>Class</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {dayBlocks.map((b) => {
                  const l = toLesson(data, b);
                  const isNow = day === state.day && state.time >= b.startTime && state.time < b.endTime;
                  return (
                    <tr
                      key={b.blockId}
                      data-selected={isNow}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setClock({ day });
                        dispatch({ type: 'SET_SIM', patch: { roomId: b.roomId } });
                      }}
                    >
                      <td className="scas-mono">
                        {formatTime(b.startTime)}–{formatTime(b.endTime)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{b.roomId}</td>
                      <td>{b.classId}</td>
                      <td>
                        {l.subject.name}
                        {b.classId.startsWith('HO-') && (
                          <Badge appearance="outline" size="small" style={{ marginLeft: 6 }}>
                            homeroom
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Room status */}
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Text weight="semibold" size={200}>
              Rooms in use right now
            </Text>
            <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
              Terminal health across the building
            </Text>
          </div>
          <div style={{ padding: 14, display: 'grid', gap: 14 }}>
            <StatGrid>
              <StatTile value={online} label="Online" tone="success" />
              <StatTile value={offline} label="Offline" tone="danger" />
              <StatTile
                value={state.terminals.reduce((n, t) => n + t.queuedScans, 0)}
                label="Queued scans"
                tone="warning"
              />
            </StatGrid>

            <div className="scas-table-scroll" style={{ maxHeight: 300 }}>
              <table className="scas-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Class</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => {
                    const t = state.terminals.find((x) => x.roomId === r.room);
                    return (
                      <tr key={r.room}>
                        <td style={{ fontWeight: 600 }}>{r.room}</td>
                        <td>
                          {r.cls} <span style={{ color: 'var(--colorNeutralForeground3)' }}>({r.subject})</span>
                        </td>
                        <td>
                          {t ? <TerminalPill status={t.status} mode={t.mode} /> : <Text size={100}>—</Text>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <Section title="Quick actions">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <QuickLink href="/office/timetable" title="Central timetable" detail="Week A / Week B grid" />
          <QuickLink href="/office/students" title="Students & enrolments" detail="Individual timetables" />
          <QuickLink href="/office/terminals" title="Terminal management" detail="Online / offline / sync" />
          <QuickLink href="/office/events" title="Emergency events" detail="Event mode activation" />
          <QuickLink href="/data" title="Attendance & audit data" detail="Raw records" />
        </div>
      </Section>
    </>
  );
}

function QuickLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Card
        appearance="outline"
        style={{
          padding: 14,
          height: '100%',
          cursor: 'pointer',
          transition: 'border-color 120ms ease-out',
        }}
      >
        <Text weight="semibold" style={{ display: 'block' }}>
          {title}
        </Text>
        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
          {detail}
        </Text>
      </Card>
    </Link>
  );
}
