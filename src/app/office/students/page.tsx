'use client';

/**
 * STUDENTS + INDIVIDUAL TIMETABLE
 * ==================================================================
 * The student timetable shown here is DERIVED from the central timetable
 * plus the student's enrolments — it is never stored separately. This
 * is the key distinction in the requirements (section 2A vs 2B).
 */

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,

  Field,
  Input,
  Tab,
  TabList,
  Text,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import { Person24Regular, PersonAvailable24Regular } from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatGrid, StatTile, StatusPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import {
  getExpectedStudents,
  getStudentExpectedClass,
  getStudentTimetable,
} from '@/lib/engine/timetable-engine';
import { summariseLesson } from '@/lib/engine/attendance-engine';
import { DAYS, type Day } from '@/lib/types';
import { DEMO_STUDENT_IDS, getStudentGroup } from '@/lib/data/students';
import { FORMS } from '@/lib/data';

export default function StudentsPage() {
  const { state, data, dispatch } = useSim();
  const [selectedId, setSelectedId] = useState(state.sim.studentId ?? 'S-KL3946');
  const [tab, setTab] = useState<'timetable' | 'enrolment' | 'roster'>('timetable');
  const [day, setDay] = useState<Day>(state.day);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');

  const student = data.students.find((s) => s.studentId === selectedId)!;
  const group = getStudentGroup(selectedId);
  const isDemo = DEMO_STUDENT_IDS.includes(selectedId);

  const nowLesson = getStudentExpectedClass(data, selectedId, {
    week: state.week,
    day: state.day,
    time: state.time,
  });

  const dayTimetable = useMemo(
    () => getStudentTimetable(data, selectedId, state.week, day),
    [data, selectedId, state.week, day],
  );

  const enrolments = useMemo(
    () => data.enrolments.filter((e) => e.studentId === selectedId && e.week === state.week),
    [data.enrolments, selectedId, state.week],
  );

  const todaySummary = useMemo(() => {
    let e = 0, p = 0, l = 0, a = 0, r = 0;
    dayTimetable.forEach((lesson) => {
      const recs = state.attendance.filter((x) => x.blockId === lesson.block.blockId);
      const s = summariseLesson([selectedId], recs);
      e += 1; p += s.present; l += s.late; a += s.absent; r += s.review;
    });
    return { e, p, l, a, r };
  }, [dayTimetable, state.attendance, selectedId]);

  const roster = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students
      .filter((s) => groupFilter === 'ALL' || getStudentGroup(s.studentId) === groupFilter)
      .filter(
        (s) => !q || s.name.toLowerCase().includes(q) || s.studentNumber.toLowerCase().includes(q),
      );
  }, [data.students, query, groupFilter]);

  const onTab = (_e: SelectTabEvent, d: SelectTabData) =>
    setTab(d.value as typeof tab);

  const activate = (id: string) => {
    setSelectedId(id);
    const s = data.students.find((x) => x.studentId === id);
    dispatch({ type: 'SET_SIM', patch: { studentId: id, typedStudentNumber: s?.studentNumber ?? '' } });
  };

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Enrolments, derived individual timetables and class rosters."
        actions={
          <>
            <Button appearance="outline" icon={<PersonAvailable24Regular />} onClick={() => activate('S-KL3946')}>
              Shu Min · KL3946
            </Button>
            <Button appearance="outline" icon={<PersonAvailable24Regular />} onClick={() => activate('S-KL5195')}>
              Zichun · KL5195
            </Button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20, alignItems: 'start' }}>
        {/* ---------------- Student picker ---------------- */}
        <Card appearance="outline" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Text weight="semibold" size={200}>
              Student directory
            </Text>
            <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
              {data.students.length} Year 10 students
            </Text>
          </div>
          <div style={{ padding: 12, display: 'grid', gap: 10, borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
            <Input
              value={query}
              onChange={(_, d) => setQuery(d.value)}
              placeholder="Search name or ID"
            />
            <Select
              value={groupFilter}
              options={[
                { key: 'ALL', text: 'All forms' },
                ...FORMS.map((g) => ({ key: g, text: `Form ${g}` })),
              ]}
              onChange={(v) => setGroupFilter(v)}
            />
          </div>
          <div className="scas-scroll-y" style={{ maxHeight: 520 }}>
            <table className="scas-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Grp</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr
                    key={s.studentId}
                    data-selected={s.studentId === selectedId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => activate(s.studentId)}
                  >
                    <td style={{ fontWeight: 500 }}>
                      {s.name}
                      {DEMO_STUDENT_IDS.includes(s.studentId) && (
                        <Badge appearance="filled" color="brand" size="small" style={{ marginLeft: 6 }}>
                          demo
                        </Badge>
                      )}
                    </td>
                    <td className="scas-mono">{s.studentNumber}</td>
                    <td>{getStudentGroup(s.studentId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ---------------- Student detail ---------------- */}
        <div>
          <Card appearance="outline" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--borderRadiusLarge)',
                  background: 'var(--colorBrandBackground1)',
                  color: 'var(--colorNeutralForegroundOnBrand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Person24Regular />
              </div>
              <div style={{ minWidth: 220 }}>
                <div className="scas-row" style={{ gap: 8 }}>
                  <Text size={500} weight="semibold">
                    {student.name}
                  </Text>
                  {isDemo && (
                    <Badge appearance="filled" color="brand" size="small">
                      demonstration student
                    </Badge>
                  )}
                </div>
                <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {student.studentNumber} · Year {student.yearGroup} · Group {group}
                </Text>
              </div>
              <span className="scas-spacer" />
              <div style={{ minWidth: 260 }}>
                <KV
                  items={[
                    [
                      'Expected now',
                      nowLesson
                        ? `${nowLesson.subject.name} · ${nowLesson.room.roomName}`
                        : 'No lesson at this time',
                    ],
                    ['Simulated time', `${formatTime(state.time)} · ${state.day} · Week ${state.week}`],
                  ]}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <StatGrid>
                <StatTile value={todaySummary.e} label="Lessons today" />
                <StatTile value={todaySummary.p} label="Present" tone="success" />
                <StatTile value={todaySummary.l} label="Late" tone="warning" />
                <StatTile value={todaySummary.a} label="Absent" tone="danger" />
                <StatTile value={todaySummary.r} label="Review" tone="brand" />
              </StatGrid>
            </div>
          </Card>

          <TabList selectedValue={tab} onTabSelect={onTab} size="small">
            <Tab value="timetable">Individual timetable</Tab>
            <Tab value="enrolment">Enrolments ({enrolments.length})</Tab>
            <Tab value="roster">Class rosters</Tab>
          </TabList>

          <div style={{ marginTop: 14 }}>
            {tab === 'timetable' && (
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
                    Week {state.week} · {day}
                  </Text>
                  <span className="scas-spacer" />
                  <Select value={day} options={DAYS.map((d) => ({ key: d, text: d }))} onChange={(v) => setDay(v as any)} style={{ minWidth: 130 }} />
                </div>
                <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 480 }}>
                  <table className="scas-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Room</th>
                        <th>Teacher</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayTimetable.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ color: 'var(--colorNeutralForeground3)' }}>
                            No lessons for this student on {day}.
                          </td>
                        </tr>
                      )}
                      {dayTimetable.map((l) => {
                        const rec = state.attendance.find(
                          (r) => r.blockId === l.block.blockId && r.studentId === selectedId,
                        );
                        const isNow =
                          day === state.day &&
                          state.time >= l.block.startTime &&
                          state.time < l.block.endTime;
                        return (
                          <tr key={l.block.blockId} data-selected={isNow}>
                            <td className="scas-mono">
                              {formatTime(l.block.startTime)} – {formatTime(l.block.endTime)}
                            </td>
                            <td style={{ fontWeight: 500 }}>
                              {l.subject.name}
                              {l.block.classId.startsWith('HO-') && (
                                <Badge appearance="outline" size="small" style={{ marginLeft: 6 }}>
                                  homeroom
                                </Badge>
                              )}
                            </td>
                            <td>{l.room.roomName}</td>
                            <td>{l.teacher.name}</td>
                            <td>
                              <StatusPill status={rec?.status ?? 'NEUTRAL'} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {tab === 'enrolment' && (
              <Card appearance="outline" style={{ padding: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                  <Text weight="semibold" size={200}>
                    Enrolments for Week {state.week}
                  </Text>
                  <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    These class assignments are what generate the individual timetable above
                  </Text>
                </div>
                <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 480 }}>
                  <table className="scas-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Teacher</th>
                        <th>Room</th>
                        <th style={{ textAlign: 'right' }}>Periods / week</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolments.map((e) => {
                        const cls = data.classes.find((c) => c.classId === e.classId)!;
                        const subject = data.subjects.find((s) => s.subjectId === cls.subjectId)!;
                        const teacher = data.teachers.find((t) => t.teacherId === cls.teacherId)!;
                        const clsBlocks = data.timetableBlocks.filter(
                          (b) => b.week === state.week && b.classId === e.classId,
                        );
                        const count = clsBlocks.filter((b) => !b.classId.startsWith('HR-')).length;
                        const room = clsBlocks[0]?.roomId ?? '—';
                        return (
                          <tr key={e.classId}>
                            <td style={{ fontWeight: 500 }}>{cls.classId}</td>
                            <td>{subject.name}</td>
                            <td>{teacher.name}</td>
                            <td>{room}</td>
                            <td className="num">{count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {tab === 'roster' && (
              <Card appearance="outline" style={{ padding: 0 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                  <Text weight="semibold" size={200}>
                    Class rosters
                  </Text>
                  <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    Who is expected in each class this week
                  </Text>
                </div>
                <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 480 }}>
                  <table className="scas-table">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Room</th>
                        <th style={{ textAlign: 'right' }}>Expected students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.classes
                        .filter((c) => enrolments.some((e) => e.classId === c.classId))
                        .map((c) => {
                          const subject = data.subjects.find((s) => s.subjectId === c.subjectId)!;
                          const list = getExpectedStudents(data, c.classId, state.week);
                          const blk = data.timetableBlocks.find(
                            (b) => b.week === state.week && b.classId === c.classId,
                          );
                          return (
                            <tr key={c.classId}>
                              <td style={{ fontWeight: 500 }}>{c.classId}</td>
                              <td>{subject.name}</td>
                              <td>{blk?.roomId ?? '—'}</td>
                              <td className="num">{list.length}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
