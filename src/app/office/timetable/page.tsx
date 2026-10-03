'use client';

/**
 * CENTRAL TIMETABLE — scheduling workspace
 * ==================================================================
 * A real timetable grid: rows are rooms, columns are time blocks.
 * Multiple classes run in parallel. Clicking a cell inspects it; each
 * cell also has a context menu (Edit / Duplicate / Delete / View
 * attendance). The "[+ Add class]" action creates a new block.
 *
 * Editing is layered on top of the seeded timetable through component
 * state (added / edited / removed) so the engine's source data is not
 * mutated — the workspace is fully interactive for demonstration.
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
  Field,
  Input,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tab,
  TabList,
  Text,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import {
  Add20Regular,
  ArrowSync16Regular,
  Copy20Regular,
  Delete20Regular,
  Edit20Regular,
  MoreHorizontal20Regular,
} from '@fluentui/react-icons';
import { KV, PageHeader, Section } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import { getBlocksForDay, getExpectedStudents, toLesson } from '@/lib/engine/timetable-engine';
import { summariseLesson } from '@/lib/engine/attendance-engine';
import { DAY_PATTERNS } from '@/lib/data/timetable';
import { DAYS, type Day, type TimetableBlock, type Week } from '@/lib/types';

interface Draft {
  id: string | null; // null = new block
  classId: string;
  roomId: string;
  week: Week;
  day: Day;
  start: string; // HH:MM
  end: string; // HH:MM
}

export default function CentralTimetablePage() {
  const { state, data, dispatch, setClock } = useSim();
  const [day, setDay] = useState<Day>(state.day);
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [selected, setSelected] = useState<TimetableBlock | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  /* Editable overlay (prototype layer). */
  const [added, setAdded] = useState<TimetableBlock[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [edited, setEdited] = useState<Record<string, Partial<TimetableBlock>>>({});

  const pattern = DAY_PATTERNS[day];

  /* Seeded blocks for the day, with removals + edits applied, then the
     locally added blocks for the same week/day. */
  const blocks = useMemo(() => {
    const base = getBlocksForDay(data, state.week, day)
      .filter((b) => !removed.includes(b.blockId))
      .map((b) => ({ ...b, ...(edited[b.blockId] ?? {}) }));
    const local = added.filter((a) => a.week === state.week && a.day === day);
    return [...base, ...local] as TimetableBlock[];
  }, [data, state.week, day, removed, edited, added]);

  const rooms = useMemo(() => {
    const set = new Set(blocks.map((b) => b.roomId));
    return [...set].sort();
  }, [blocks]);

  const columns = useMemo(() => {
    const cols: { label: string; start: number; end: number; kind: 'homeroom' | 'lesson' }[] = [];
    cols.push({
      label: 'Homeroom',
      start: toMin(pattern.homeroom[0]),
      end: toMin(pattern.homeroom[1]),
      kind: 'homeroom',
    });
    pattern.periods.forEach(([s, e]) => {
      cols.push({ label: formatTime(toMin(s)), start: toMin(s), end: toMin(e), kind: 'lesson' });
    });
    return cols;
  }, [pattern]);

  const visibleRooms = useMemo(
    () =>
      groupFilter === 'ALL'
        ? rooms
        : rooms.filter((r) => blocks.some((b) => b.roomId === r && b.classId.endsWith(groupFilter))),
    [rooms, groupFilter, blocks],
  );

  const lesson = selected ? toLesson(data, selected) : null;

  const onTab = (_e: SelectTabEvent, d: SelectTabData) =>
    setClock({ week: d.value as 'A' | 'B' });

  /* The block occupying a column for a room (start within the column). */
  const blockAt = (roomId: string, col: { start: number; end: number }) =>
    blocks.find((b) => b.roomId === roomId && b.startTime >= col.start && b.startTime < col.end);

  /* ---- editing actions ---- */
  const openAdd = () => {
    setDraft({
      id: null,
      classId: data.classes[0]?.classId ?? '',
      roomId: data.rooms[0]?.roomId ?? '',
      week: state.week,
      day,
      start: '08:40',
      end: '09:35',
    });
    setEditorOpen(true);
  };

  const openEdit = (b: TimetableBlock) => {
    setDraft({
      id: b.blockId,
      classId: b.classId,
      roomId: b.roomId,
      week: b.week,
      day: b.day,
      start: formatTime(b.startTime),
      end: formatTime(b.endTime),
    });
    setEditorOpen(true);
  };

  const duplicate = (b: TimetableBlock) => {
    const copy: TimetableBlock = {
      ...b,
      blockId: `${b.blockId}-copy-${Date.now().toString(36)}`,
    };
    setAdded((a) => [...a, copy]);
  };

  const remove = (b: TimetableBlock) => {
    if (b.blockId.startsWith('T-') || added.some((a) => a.blockId === b.blockId)) {
      setAdded((a) => a.filter((x) => x.blockId !== b.blockId));
    } else {
      setRemoved((r) => [...r, b.blockId]);
    }
    if (selected?.blockId === b.blockId) setSelected(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    const start = toMin(draft.start);
    const end = toMin(draft.end);
    if (end <= start) return;
    const block: TimetableBlock = {
      blockId: draft.id ?? `T-${draft.classId}-${draft.week}-${draft.day}-${start}-${Date.now().toString(36)}`,
      week: draft.week,
      day: draft.day,
      roomId: draft.roomId,
      classId: draft.classId,
      startTime: start,
      endTime: end,
    };
    if (draft.id && !added.some((a) => a.blockId === draft.id)) {
      // editing a seeded block
      setEdited((e) => ({ ...e, [draft.id!]: block }));
    } else if (draft.id) {
      setAdded((a) => a.map((x) => (x.blockId === draft.id ? block : x)));
    } else {
      setAdded((a) => [...a, block]);
    }
    setEditorOpen(false);
    setDraft(null);
  };

  return (
    <>
      <PageHeader
        title="Central Timetable"
        subtitle="Every class running in the Year 10 timetable. This is the school-wide view, not one student's schedule."
        actions={
          <>
            <Select
              value={day}
              options={DAYS.map((d) => ({ key: d, text: d }))}
              onChange={(v) => setDay(v as Day)}
              style={{ minWidth: 140 }}
            />
            <Button appearance="primary" icon={<Add20Regular />} onClick={openAdd}>
              Add class
            </Button>
          </>
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
                  <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--colorNeutralForeground3)' }}>
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
                  const b = blockAt(roomId, c);
                  if (!b) {
                    return (
                      <td key={`${roomId}-${c.start}`}>
                        <div className="scas-tt-cell is-empty" />
                      </td>
                    );
                  }
                  const l = toLesson(data, b);
                  const isActive =
                    day === state.day && state.time >= b.startTime && state.time < b.endTime;
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
                        <div className="scas-tt-menu">
                          <Menu>
                            <MenuTrigger disableButtonEnhancement>
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<MoreHorizontal20Regular />}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Cell actions"
                                style={{ minWidth: 28, padding: 0 }}
                              />
                            </MenuTrigger>
                            <MenuPopover>
                              <MenuList>
                                <MenuItem
                                  icon={<Edit20Regular />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(b);
                                  }}
                                >
                                  Edit
                                </MenuItem>
                                <MenuItem
                                  icon={<Copy20Regular />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    duplicate(b);
                                  }}
                                >
                                  Duplicate
                                </MenuItem>
                                <MenuItem
                                  icon={<Delete20Regular />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    remove(b);
                                  }}
                                >
                                  Delete
                                </MenuItem>
                                <MenuDivider />
                                <MenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelected(b);
                                  }}
                                >
                                  View attendance
                                </MenuItem>
                              </MenuList>
                            </MenuPopover>
                          </Menu>
                        </div>
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
            is the lesson running at the current simulation time. Click a cell to inspect it, or use
            the &ldquo;&hellip;&rdquo; menu to edit, duplicate or delete. Use{' '}
            <b>Add class</b> to schedule a new block.
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

      {/* ---------------- Add / edit dialog ---------------- */}
      <Dialog open={editorOpen} onOpenChange={(_, d) => setEditorOpen(d.open)} modalType="modal">
        <DialogSurface aria-label="Edit timetable block">
          <DialogBody>
            <DialogTitle>{draft?.id ? 'Edit class' : 'Add class'}</DialogTitle>
            <DialogContent>
              {draft && (
                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Class">
                    <Select
                      value={draft.classId}
                      options={data.classes.map((c) => {
                        const s = data.subjects.find((x) => x.subjectId === c.subjectId);
                        const t = data.teachers.find((x) => x.teacherId === c.teacherId);
                        return {
                          key: c.classId,
                          text: `${c.classId} · ${s?.name ?? ''} · ${t?.name ?? ''}`,
                        };
                      })}
                      onChange={(v) => setDraft({ ...draft, classId: v })}
                    />
                  </Field>
                  <Field label="Room">
                    <Select
                      value={draft.roomId}
                      options={data.rooms.map((r) => ({ key: r.roomId, text: r.roomName }))}
                      onChange={(v) => setDraft({ ...draft, roomId: v })}
                    />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Week">
                      <Select
                        value={draft.week}
                        options={[
                          { key: 'A', text: 'Week A' },
                          { key: 'B', text: 'Week B' },
                        ]}
                        onChange={(v) => setDraft({ ...draft, week: v as Week })}
                      />
                    </Field>
                    <Field label="Day">
                      <Select
                        value={draft.day}
                        options={DAYS.map((d) => ({ key: d, text: d }))}
                        onChange={(v) => setDraft({ ...draft, day: v as Day })}
                      />
                    </Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Start">
                      <Input
                        value={draft.start}
                        onChange={(_, d) => setDraft({ ...draft, start: d.value })}
                      />
                    </Field>
                    <Field label="End">
                      <Input
                        value={draft.end}
                        onChange={(_, d) => setDraft({ ...draft, end: d.value })}
                      />
                    </Field>
                  </div>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={saveDraft} disabled={!draft}>
                Save
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
  const s = summariseLesson(expected.map((x) => x.studentId), records);

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
  return (h || 0) * 60 + (m || 0);
}
