'use client';

/**
 * CENTRAL TIMETABLE
 * ==================================================================
 * A real timetable grid: rows are rooms, columns are time blocks.
 * Multiple classes run in parallel — that is exactly what the central
 * Year 10 timetable represents. Clicking a block opens its details.
 *
 * This view is the CENTRAL timetable, not any individual student's.
 */

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,

  Tab,
  TabList,
  Text,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { ArrowSync16Regular } from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatusPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import {
  getBlocksForDay,
  getExpectedStudents,
  toLesson,
} from '@/lib/engine/timetable-engine';
import { DAY_PATTERNS } from '@/lib/data/timetable';
import { summariseLesson } from '@/lib/engine/attendance-engine';
import { DAYS, type Day, type TimetableBlock } from '@/lib/types';

export default function CentralTimetablePage() {
  const { state, data, dispatch, setClock } = useSim();
  const [day, setDay] = useState<Day>(state.day);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [selected, setSelected] = useState<TimetableBlock | null>(null);

  const pattern = DAY_PATTERNS[day];
  const blocks = useMemo(
    () => getBlocksForDay(data, state.week, day),
    [data, state.week, day],
  );

  /* Rooms that actually host a lesson on this day, in stable order. */
  const rooms = useMemo(() => {
    const set = new Set(blocks.map((b) => b.roomId));
    return [...set].sort();
  }, [blocks]);

  /* Time columns: homeroom + teaching blocks, with real start/end. */
  const columns = useMemo(() => {
    const cols: { label: string; start: number; end: number; kind: 'homeroom' | 'lesson' }[] = [];
    cols.push({
      label: 'Homeroom',
      start: toMin(pattern.homeroom[0]),
      end: toMin(pattern.homeroom[1]),
      kind: 'homeroom',
    });
    pattern.periods.forEach(([s, e]) => {
      cols.push({
        label: formatTime(toMin(s)),
        start: toMin(s),
        end: toMin(e),
        kind: 'lesson',
      });
    });
    return cols;
  }, [pattern]);

  const visibleRooms = useMemo(
    () =>
      groupFilter === 'ALL'
        ? rooms
        : rooms.filter((r) =>
            blocks.some((b) => b.roomId === r && b.classId.endsWith(groupFilter)),
          ),
    [rooms, groupFilter, blocks],
  );

  const lesson = selected ? toLesson(data, selected) : null;

  const onTab = (_e: SelectTabEvent, d: SelectTabData) =>
    setClock({ week: d.value as 'A' | 'B' });

  return (
    <>
      <PageHeader
        title="Central Timetable"
        subtitle="Every class running in the Year 10 timetable. This is the school-wide view, not one student's schedule."
        actions={
          <Select value={day} options={DAYS.map((d) => ({ key: d, text: d }))} onChange={(v) => setDay(v as any)} style={{ minWidth: 140 }} />
        }
      />

      <div className="scas-row" style={{ marginBottom: 14 }}>
        <TabList selectedValue={state.week} onTabSelect={onTab} size="small">
          <Tab value="A">Week A</Tab>
          <Tab value="B">Week B</Tab>
        </TabList>

        <div style={{ width: 1, height: 20, background: 'var(--colorNeutralStroke2)' }} />

        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
          Teaching group
        </Text>
        <Select
          value={groupFilter}
          options={[
            { key: 'ALL', text: 'All groups' },
            { key: '10A', text: '10A only' },
            { key: '10B', text: '10B only' },
            { key: '10C', text: '10C only' },
          ]}
          onChange={(v) => setGroupFilter(v)}
          style={{ minWidth: 130 }}
        />

        <span className="scas-spacer" />

        <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
          {day} · {blocks.length} blocks · {rooms.length} rooms
        </Text>
      </div>

      {/* ---------------- Grid ---------------- */}
      <div className="scas-grid-scroll">
        <table className="scas-tt">
          <thead>
            <tr>
              <th className="tt-time-col">Room</th>
              {columns.map((c) => (
                <th key={`${c.start}-${c.kind}`}>
                  <div style={{ fontVariantNumeric: 'tabular-nums' }}>{c.label}</div>
                  <div
                    style={{
                      fontWeight: 400,
                      fontSize: 10,
                      color: 'var(--colorNeutralForeground3)',
                    }}
                  >
                    {formatTime(c.end)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRooms.map((roomId) => (
              <tr key={roomId}>
                <td className="tt-time-col">
                  <div style={{ fontWeight: 600 }}>{roomId}</div>
                </td>
                {columns.map((c) => {
                  const b = blocks.find(
                    (x) => x.roomId === roomId && x.startTime === c.start,
                  );
                  if (!b) {
                    return (
                      <td key={`${roomId}-${c.start}`}>
                        <div className="scas-tt-cell is-empty" />
                      </td>
                    );
                  }
                  const l = toLesson(data, b);
                  const isActive =
                    day === state.day &&
                    state.time >= b.startTime &&
                    state.time < b.endTime;
                  return (
                    <td key={b.blockId}>
                      <div
                        className={`scas-tt-cell is-clickable${isActive ? ' is-active' : ''}`}
                        onClick={() => setSelected(b)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setSelected(b);
                        }}
                      >
                        <span className="tt-code">{b.classId}</span>
                        <span className="tt-meta">
                          {l.subject.abbreviation} · {l.class.classId}
                        </span>
                        <span className="tt-meta">
                          {b.startTime === c.start ? formatTime(b.startTime) : ''}
                          {c.kind === 'homeroom' ? 'form' : ''}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------- Legend ---------------- */}
      <Section title="How to read this grid">
        <Card appearance="outline" style={{ padding: 14 }}>
          <Text size={200} style={{ color: 'var(--colorNeutralForeground2)' }}>
            Rows are rooms, columns are time blocks with real start and end times. Friday blocks are
            shorter than Monday–Thursday, so Friday has fewer columns — the engine looks lessons up by{' '}
            <b>week + day + current time</b>, never by a hard-coded period number. The highlighted cell
            is the lesson running at the current simulation time. Select any cell to inspect the
            subject, room, teacher, group, expected students and time.
          </Text>
        </Card>
      </Section>

      {/* ---------------- Block detail dialog ---------------- */}
      <Dialog
        open={selected !== null}
        onOpenChange={(_, d) => !d.open && setSelected(null)}
        modalType="modal"
      >
        <DialogSurface aria-label="Timetable block detail">
          <DialogBody>
            <DialogTitle>{selected?.classId ?? ''}</DialogTitle>
            <DialogContent>
              {selected && lesson && (
                <div style={{ display: 'grid', gap: 14 }}>
                  <KV
                    items={[
                      ['Subject', lesson.subject.name],
                      ['Class', lesson.class.classId],
                      ['Room', lesson.room.roomName],
                      ['Teacher', lesson.teacher.name],
                      ['Week / Day', `${selected.week} / ${selected.day}`],
                      [
                        'Time',
                        `${formatTime(selected.startTime)} – ${formatTime(selected.endTime)} (${selected.endTime - selected.startTime} min)`,
                      ],
                      ['Block ID', <code key="id" style={{ fontSize: 11 }}>{selected.blockId}</code>],
                    ]}
                  />

                  <AttendanceSnapshot block={selected} />
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="outline"
                icon={<ArrowSync16Regular />}
                onClick={() => {
                  if (selected) {
                    setClock({ day: selected.day, time: selected.startTime + 5 });
                    dispatch({ type: 'SET_SIM', patch: { roomId: selected.roomId } });
                  }
                  setSelected(null);
                }}
              >
                Set simulation here
              </Button>
              <Button appearance="primary" onClick={() => setSelected(null)}>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}

function AttendanceSnapshot({ block }: { block: TimetableBlock }) {
  const { state, data } = useSim();
  const expected = getExpectedStudents(data, block.classId, block.week);
  const records = state.attendance.filter((r) => r.blockId === block.blockId);
  const s = summariseLesson(
    expected.map((x) => x.studentId),
    records,
  );

  return (
    <Card appearance="outline" style={{ padding: 12, background: 'var(--colorNeutralBackground2)' }}>
      <Text weight="semibold" size={200} style={{ display: 'block', marginBottom: 8 }}>
        Attendance for this lesson
      </Text>
      <div className="scas-row" style={{ gap: 16 }}>
        <span>
          <Text size={300} weight="semibold">
            {s.expected}
          </Text>{' '}
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            expected
          </Text>
        </span>
        <span>
          <Text size={300} weight="semibold" style={{ color: 'var(--colorPaletteGreenForeground1)' }}>
            {s.present}
          </Text>{' '}
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            present
          </Text>
        </span>
        <span>
          <Text size={300} weight="semibold" style={{ color: 'var(--colorPaletteMarigoldForeground1)' }}>
            {s.late}
          </Text>{' '}
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            late
          </Text>
        </span>
        <span>
          <Text size={300} weight="semibold" style={{ color: 'var(--colorPaletteRedForeground1)' }}>
            {s.absent}
          </Text>{' '}
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            absent
          </Text>
        </span>
        <span>
          <Text size={300} weight="semibold">
            {s.review}
          </Text>{' '}
          <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
            review
          </Text>
        </span>
      </div>
    </Card>
  );
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
