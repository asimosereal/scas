/**
 * CENTRAL TIMETABLE — 10TAY, Week A (Week 1) / Week B (Week 2)
 * ==================================================================
 * SOURCES (all reproduced literally):
 *   1. 10TAY.PDF — the central class grid. Each day has several parallel
 *      rows; rows that begin with a homeroom cell are the three forms
 *      (B403 / A303 / A305). Rows WITHOUT a homeroom cell are further
 *      parallel option groups; they are aligned from P1 and any cell
 *      that would collide with an existing session is dropped or moved
 *      to a sibling set (see below).
 *   2. Shu Min (KL3946) individual timetable — Week A + Week B, supplied
 *      with the brief. AUTHORITATIVE for that student.
 *   3. CHEN-ZiChun_(10).pdf — iSAMS print, Week 1 = Week A, Week 2 = Week B.
 *      AUTHORITATIVE for that student.
 *
 * BUILD RULES
 *   a. The two demo students' lessons are created FIRST and their
 *      classes are SEALED: the central grid may de-duplicate against
 *      them (identical slot) but never extend them, so an individual
 *      timetable always matches its printed source exactly.
 *   b. A teaching set meets at most once per day. When a grid cell maps
 *      to a set that already meets that day, the cell is moved to a
 *      sibling set of the same subject + teacher (e.g. CHE-3) — this is
 *      how the grid's parallel bands are represented.
 *   c. A cell whose session already exists (same slot, room, teacher)
 *      is treated as a duplicate and skipped.
 *
 * DOCUMENTED SOURCE DISCREPANCY (requirement 33.5 — not silently changed):
 *   Week B Friday P3 (10:25-11:10) room B308 with Ms Sheela Sanjivee is
 *   printed as "Additional Math" in Shu Min's timetable but as "Maths"
 *   in both Zichun's iSAMS print and the 10TAY grid. Both records are
 *   kept as printed, so AM-2 and MATH-1 share that slot;
 *   validateTimetable() whitelists this single documented key.
 *
 * iSAMS prints periods as 08:40-09:40 etc. while the 10TAY grid prints
 * 08:40-09:35 etc.; the grid times (and the times supplied in the brief)
 * are used throughout.
 */

import { toMinutes } from '../time';
import type { Class, Day, TimetableBlock, Week } from '../types';
import { DAYS } from '../types';
import { CLASS_MAP, CLASSES as BASE_CLASSES, CLASS_BY_ID, subjectCodeOfClassId } from './reference';

/* ------------------------------------------------------------------ */
/* Time structure                                                      */
/* ------------------------------------------------------------------ */

export interface DayPattern {
  homeroom: [string, string];
  /** teaching periods as explicit [start, end] pairs */
  periods: [string, string][];
  lunch: [string, string];
}

export const DAY_PATTERNS: Record<Day, DayPattern> = {
  Monday: {
    homeroom: ['08:20', '08:35'],
    periods: [
      ['08:40', '09:35'],
      ['09:40', '10:35'],
      ['10:40', '11:40'],
      ['12:30', '13:25'],
      ['13:30', '14:25'],
      ['14:30', '15:30'],
    ],
    lunch: ['11:40', '12:30'],
  },
  Tuesday: {
    homeroom: ['08:20', '08:35'],
    periods: [
      ['08:40', '09:35'],
      ['09:40', '10:35'],
      ['10:40', '11:40'],
      ['12:30', '13:25'],
      ['13:30', '14:25'],
      ['14:30', '15:30'],
    ],
    lunch: ['11:40', '12:30'],
  },
  Wednesday: {
    homeroom: ['08:20', '08:35'],
    periods: [
      ['08:40', '09:35'],
      ['09:40', '10:35'],
      ['10:40', '11:40'],
      ['12:30', '13:25'],
      ['13:30', '14:25'],
      ['14:30', '15:30'],
    ],
    lunch: ['11:40', '12:30'],
  },
  Thursday: {
    homeroom: ['08:20', '08:35'],
    periods: [
      ['08:40', '09:35'],
      ['09:40', '10:35'],
      ['10:40', '11:40'],
      ['12:30', '13:25'],
      ['13:30', '14:25'],
      ['14:30', '15:30'],
    ],
    lunch: ['11:40', '12:30'],
  },
  // Friday periods are shorter — the engine is time-based, never period-based.
  Friday: {
    homeroom: ['08:20', '08:35'],
    periods: [
      ['08:40', '09:25'],
      ['09:30', '10:20'],
      ['10:25', '11:10'],
      ['12:00', '12:50'],
    ],
    lunch: ['11:10', '12:00'],
  },
};

/* ------------------------------------------------------------------ */
/* The 10TAY central grid, reproduced cell by cell                     */
/* ------------------------------------------------------------------ */
/**
 * Each row is [homeroom, P1, P2, P3, P4, P5, P6] as 'SUBJ@ROOM'.
 * Friday rows are [homeroom, P1, P2, P3, P4]. '' = no lesson.
 */

const GRID: Record<Week, Record<Day, string[][]>> = {
  A: {
    Monday: [
      ['HR@B403', 'BM@A305', 'MN@B315', 'ABL@B403', 'EC@B407', 'GEO@B402', 'ENG@B416'],
      ['HR@A303', 'BS@B408', 'PHY@B422', 'ABL@A303', 'EC@B409', 'CHE@B212', 'ENG@B421'],
      ['HR@A305', 'CHE@B209', 'EC@B407', 'ABL@A305', 'BIO@B214', 'AM@B318', 'ENG@B418'],
      ['', 'BM@A306', 'GP@B426', 'ABL@A304', 'HIS@B428', 'GP@B425', 'ENG@B420'],
      ['', 'BM@A303', 'MN@B314', 'ABL@A306', 'IT@B324', 'CS@B323', 'ENG@B410'],
      ['', 'MN@B311', 'DR@A501', 'ENG@B415', '', '', ''],
    ],
    Tuesday: [
      ['HR@B403', 'PE@BAD', 'PSHE@B420', 'GEO@B402', 'MATH@B308', 'BIO@B216', 'EC@B407'],
      ['HR@A303', 'PE@FLD', 'AG@A302', 'CHE@B212', 'MATH@B317', 'EC@B409', 'EC@B409'],
      ['HR@A305', 'PE@SPH', 'PSHE@A503', 'AM@B318', 'MATH@B320', 'BS@B408', 'BIO@B214'],
      ['', 'PE@SCX', 'PSHE@B402', 'GP@B425', 'MATH@B307', 'AM@B308', 'HIS@B428'],
      ['', 'CS@B323', 'MATH@B309', 'PP@B320', 'IT@B324', '', ''],
      ['', 'CHE@B212', 'DR@A501', '', '', '', ''],
    ],
    Wednesday: [
      ['HR@B403', 'GEO@B402', 'BIO@B216', 'HIS@B403', 'EC@B407', 'MATH@B308', 'ENG@B416'],
      ['HR@A303', 'CHE@B212', 'EC@B409', 'IGPE@HLZ', 'EC@B409', 'MATH@B317', 'ENG@B421'],
      ['HR@A305', 'AM@B318', 'BS@B408', 'BS@B320', 'BIO@B214', 'MATH@B320', 'ENG@B418'],
      ['', 'GP@B425', 'AM@B308', 'PHY@B211', 'HIS@B428', 'MATH@B307', 'ENG@B420'],
      ['', 'CS@B323', 'PP@B320', 'MU@A502', 'IT@B324', 'MATH@B309', 'ENG@B410'],
      ['', '', 'CHE@B212', 'DR@A501', 'ENG@B415', '', ''],
    ],
    Thursday: [
      ['HR@B403', 'BIO@B216', 'MATH@B308', 'MN@B315', 'ENG@B416', 'BM@A305', 'CCA@B323'],
      ['HR@A303', 'PHY@B215', 'MATH@B317', 'PHY@B422', 'ENG@B421', 'BS@B408', ''],
      ['HR@A305', 'PHY@B422', 'MATH@B320', 'EC@B407', 'ENG@B418', 'CHE@B209', ''],
      ['', 'CHE@B209', 'MATH@B307', 'GP@B426', 'ENG@B420', 'BM@A306', ''],
      ['', 'SC@B212', 'MATH@B309', 'MN@B314', 'ENG@B410', 'BM@A303', ''],
      ['', 'ART@B208', 'MN@B311', 'ENG@B415', '', '', ''],
    ],
    Friday: [
      ['HR@B403', 'BIO@B216', 'BIO@B216', 'EC@B407', 'HIS@B403'],
      ['HR@A303', 'EC@B409', 'PHY@B215', 'EC@B409', 'IGPE@HLZ'],
      ['HR@A305', 'BS@B408', 'PHY@B422', 'BIO@B214', 'BS@B320'],
      ['', 'AM@B308', 'CHE@B209', 'HIS@B428', 'PHY@B211'],
      ['', 'PP@B320', 'SC@B212', 'IT@B324', 'MU@A503'],
      ['', 'CHE@B212', 'ART@B208', 'DR@A501', ''],
    ],
  },
  B: {
    Monday: [
      ['HR@B403', 'BM@A305', 'MATH@B308', 'ENG@B416', 'BIO@B216', 'HIS@B403', 'MN@B315'],
      ['HR@A303', 'BS@B408', 'MATH@B317', 'ENG@B421', 'PHY@B215', 'IGPE@B404', 'PHY@B422'],
      ['HR@A305', 'CHE@B209', 'MATH@B320', 'ENG@B418', 'PHY@B422', 'BS@B320', 'EC@B407'],
      ['', 'BM@A306', 'MATH@B307', 'ENG@B420', 'CHE@B209', 'PHY@B211', 'GP@B426'],
      ['', 'BM@A303', 'MATH@B309', 'ENG@B410', 'SC@B212', 'MU@A502', 'MN@B314'],
      ['', 'ENG@B415', 'ART@B208', 'MN@B311', '', '', ''],
    ],
    Tuesday: [
      ['HR@B403', 'PE@BAD', 'PSHE@B420', 'BM@A305', 'ENG@B416', 'MN@B315', 'MATH@B308'],
      ['HR@A303', 'PE@FLD', 'AG@A302', 'BS@B408', 'ENG@B421', 'PHY@B422', 'MATH@B317'],
      ['HR@A305', 'PE@SPH', 'PSHE@A503', 'CHE@B209', 'ENG@B418', 'EC@B407', 'MATH@B320'],
      ['', 'PE@SCX', 'PSHE@B402', 'BM@A306', 'ENG@B420', 'GP@B426', 'MATH@B307'],
      ['', 'BM@A303', 'ENG@B410', 'MN@B314', 'MATH@B309', '', ''],
      ['', 'ENG@B415', 'MN@B311', '', '', '', ''],
    ],
    Wednesday: [
      ['HR@B403', 'BIO@B216', 'GEO@B402', 'EC@B407', 'HIS@B403', 'BIO@B216', 'ENG@B416'],
      ['HR@A303', 'EC@B409', 'CHE@B212', 'EC@B409', 'IGPE@B426', 'PHY@B215', 'ENG@B421'],
      ['HR@A305', 'BS@B408', 'AM@B318', 'BIO@B214', 'BS@B320', 'PHY@B422', 'ENG@B418'],
      ['', 'AM@B308', 'GP@B425', 'HIS@B428', 'PHY@B211', 'CHE@B209', 'ENG@B420'],
      ['', 'PP@B320', 'CS@B323', 'IT@B324', 'MU@A503', 'SC@B212', 'ENG@B410'],
      ['', 'CHE@B212', 'DR@A501', 'ART@B208', 'ENG@B415', '', ''],
    ],
    Thursday: [
      ['HR@B403', 'MATH@B308', 'BIO@B216', 'GEO@B402', 'BIO@B216', 'HIS@B403', 'CCA@B323'],
      ['HR@A303', 'MATH@B317', 'EC@B409', 'CHE@B212', 'PHY@B215', 'IGPE@HLZ', ''],
      ['HR@A305', 'MATH@B320', 'BS@B408', 'AM@B318', 'PHY@B422', 'BS@B320', ''],
      ['', 'MATH@B307', 'AM@B308', 'GP@B425', 'CHE@B209', 'PHY@B211', ''],
      ['', 'MATH@B309', 'PP@B320', 'CS@B323', 'SC@B212', 'MU@A503', ''],
      ['', 'CHE@B212', 'ART@B208', '', '', '', ''],
    ],
    Friday: [
      ['HR@B403', 'MN@B315', 'BM@A305', 'MATH@B308', 'ENG@B416'],
      ['HR@A303', 'PHY@B422', 'BS@B408', 'MATH@B317', 'ENG@B421'],
      ['HR@A305', 'EC@B407', 'CHE@B209', 'MATH@B320', 'ENG@B418'],
      ['', 'GP@B426', 'BM@A306', 'MATH@B307', 'ENG@B420'],
      ['', 'MN@B314', 'BM@A303', 'MATH@B309', 'ENG@B410'],
      ['', 'MN@B311', 'ENG@B415', '', ''],
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Individual timetables of the two demonstration students             */
/* ------------------------------------------------------------------ */
/** [week, day, periodIndex (0 = homeroom, 1..n teaching), 'SUBJ@ROOM'] */
type DemoCell = [Week, Day, number, string];

const SHU_MIN_CELLS: DemoCell[] = [
  // Week A
  ['A', 'Monday', 1, 'CHE@B209'], ['A', 'Monday', 2, 'MN@B315'], ['A', 'Monday', 3, 'ABL@A305'],
  ['A', 'Monday', 4, 'EC@B409'], ['A', 'Monday', 5, 'CS@B323'], ['A', 'Monday', 6, 'ENG@B420'],
  ['A', 'Tuesday', 1, 'PE@BAD'], ['A', 'Tuesday', 2, 'PSHE@A503'], ['A', 'Tuesday', 3, 'CS@B323'],
  ['A', 'Tuesday', 4, 'MATH@B308'], ['A', 'Tuesday', 5, 'AM@B308'], ['A', 'Tuesday', 6, 'EC@B409'],
  ['A', 'Wednesday', 1, 'CS@B323'], ['A', 'Wednesday', 2, 'AM@B308'], ['A', 'Wednesday', 3, 'PHY@B211'],
  ['A', 'Wednesday', 4, 'EC@B409'], ['A', 'Wednesday', 5, 'MATH@B308'], ['A', 'Wednesday', 6, 'ENG@B420'],
  ['A', 'Thursday', 1, 'BIO@B401'], ['A', 'Thursday', 2, 'MATH@B308'], ['A', 'Thursday', 3, 'MN@B315'],
  ['A', 'Thursday', 4, 'ENG@B420'], ['A', 'Thursday', 5, 'CHE@B209'], ['A', 'Thursday', 6, 'CCA@B323'],
  ['A', 'Friday', 1, 'AM@B308'], ['A', 'Friday', 2, 'BIO@B401'], ['A', 'Friday', 3, 'EC@B409'], ['A', 'Friday', 4, 'PHY@B211'],
  // Week B
  ['B', 'Monday', 1, 'CHE@B209'], ['B', 'Monday', 2, 'MATH@B308'], ['B', 'Monday', 3, 'ENG@B420'],
  ['B', 'Monday', 4, 'BIO@B401'], ['B', 'Monday', 5, 'PHY@B211'], ['B', 'Monday', 6, 'MN@B315'],
  ['B', 'Tuesday', 1, 'PE@BAD'], ['B', 'Tuesday', 2, 'PSHE@A503'], ['B', 'Tuesday', 3, 'CHE@B209'],
  ['B', 'Tuesday', 4, 'ENG@B420'], ['B', 'Tuesday', 5, 'MN@B315'], ['B', 'Tuesday', 6, 'MATH@B308'],
  ['B', 'Wednesday', 1, 'AM@B308'], ['B', 'Wednesday', 2, 'CS@B323'], ['B', 'Wednesday', 3, 'EC@B409'],
  ['B', 'Wednesday', 4, 'PHY@B211'], ['B', 'Wednesday', 5, 'BIO@B401'], ['B', 'Wednesday', 6, 'ENG@B420'],
  ['B', 'Thursday', 1, 'MATH@B308'], ['B', 'Thursday', 2, 'AM@B308'], ['B', 'Thursday', 3, 'CS@B323'],
  ['B', 'Thursday', 4, 'BIO@B401'], ['B', 'Thursday', 5, 'PHY@B211'], ['B', 'Thursday', 6, 'CCA@B323'],
  ['B', 'Friday', 1, 'MN@B315'], ['B', 'Friday', 2, 'CHE@B209'], ['B', 'Friday', 3, 'AM9@B308'], ['B', 'Friday', 4, 'ENG@B420'],
];

const ZICHUN_CELLS: DemoCell[] = [
  // Week A (iSAMS Week 1)
  ['A', 'Monday', 1, 'CHE@B209'], ['A', 'Monday', 2, 'MN@B315'], ['A', 'Monday', 3, 'ASM@B403'],
  ['A', 'Monday', 4, 'IT@B324'], ['A', 'Monday', 5, 'CS@B323'], ['A', 'Monday', 6, 'ENG@B421'],
  ['A', 'Tuesday', 1, 'PE@FLD'], ['A', 'Tuesday', 2, 'PSHE@B420'], ['A', 'Tuesday', 3, 'CS@B323'],
  ['A', 'Tuesday', 4, 'MATH@B308'], ['A', 'Tuesday', 5, 'AM@B308'], ['A', 'Tuesday', 6, 'IT@B324'],
  ['A', 'Wednesday', 1, 'CS@B323'], ['A', 'Wednesday', 2, 'AM@B308'], ['A', 'Wednesday', 3, 'PHY@B211'],
  ['A', 'Wednesday', 4, 'IT@B324'], ['A', 'Wednesday', 5, 'MATH@B308'], ['A', 'Wednesday', 6, 'ENG@B421'],
  ['A', 'Thursday', 1, 'BIO@B216'], ['A', 'Thursday', 2, 'MATH@B308'], ['A', 'Thursday', 3, 'MN@B315'],
  ['A', 'Thursday', 4, 'ENG@B421'], ['A', 'Thursday', 5, 'CHE@B209'], ['A', 'Thursday', 6, 'CCA@B323'],
  ['A', 'Friday', 1, 'AM@B308'], ['A', 'Friday', 2, 'BIO@B216'], ['A', 'Friday', 3, 'IT@B324'], ['A', 'Friday', 4, 'PHY@B211'],
  // Week B (iSAMS Week 2)
  ['B', 'Monday', 1, 'CHE@B209'], ['B', 'Monday', 2, 'MATH@B308'], ['B', 'Monday', 3, 'ENG@B421'],
  ['B', 'Monday', 4, 'BIO@B216'], ['B', 'Monday', 5, 'PHY@B211'], ['B', 'Monday', 6, 'MN@B315'],
  ['B', 'Tuesday', 1, 'PE@FLD'], ['B', 'Tuesday', 2, 'PSHE@B420'], ['B', 'Tuesday', 3, 'CHE@B209'],
  ['B', 'Tuesday', 4, 'ENG@B421'], ['B', 'Tuesday', 5, 'MN@B315'], ['B', 'Tuesday', 6, 'MATH@B308'],
  ['B', 'Wednesday', 1, 'AM@B308'], ['B', 'Wednesday', 2, 'CS@B323'], ['B', 'Wednesday', 3, 'IT@B324'],
  ['B', 'Wednesday', 4, 'PHY@B211'], ['B', 'Wednesday', 5, 'BIO@B216'], ['B', 'Wednesday', 6, 'ENG@B421'],
  ['B', 'Thursday', 1, 'MATH@B308'], ['B', 'Thursday', 2, 'AM@B308'], ['B', 'Thursday', 3, 'CS@B323'],
  ['B', 'Thursday', 4, 'BIO@B216'], ['B', 'Thursday', 5, 'PHY@B211'], ['B', 'Thursday', 6, 'CCA@B323'],
  ['B', 'Friday', 1, 'MN@B315'], ['B', 'Friday', 2, 'CHE@B209'], ['B', 'Friday', 3, 'MATH9@B308'], ['B', 'Friday', 4, 'ENG@B421'],
];

const DEMO_CELLS: DemoCell[] = [...SHU_MIN_CELLS, ...ZICHUN_CELLS];

/* ------------------------------------------------------------------ */
/* Expansion into TIMETABLE_BLOCKS                                     */
/* ------------------------------------------------------------------ */

function periodTimes(day: Day, period: number): { start: number; end: number } {
  const pat = DAY_PATTERNS[day];
  if (period === 0) {
    return { start: toMinutes(pat.homeroom[0]), end: toMinutes(pat.homeroom[1]) };
  }
  const [s, e] = pat.periods[period - 1];
  return { start: toMinutes(s), end: toMinutes(e) };
}

function blockId(week: Week, day: Day, period: number, classId: string): string {
  return `${week}-${day.slice(0, 3).toUpperCase()}-P${period}-${classId}`;
}

/** The one documented discrepancy between the sources (see header). */
export const DOCUMENTED_CLASHES = new Set(['B|Friday|625']);

interface Built {
  blocks: TimetableBlock[];
  extraClasses: Class[];
}

function build(): Built {
  const blocks: TimetableBlock[] = [];
  const extraClasses: Class[] = [];

  const dayOf = new Map<string, Set<string>>(); // week|day -> classIds meeting that day
  const roomAt = new Map<string, Set<string>>(); // week|day|start -> rooms + T:<teacherId>
  const sealed = new Set<string>();

  const dayKey = (w: Week, d: Day) => `${w}|${d}`;
  const slotKey = (w: Week, d: Day, start: number) => `${w}|${d}|${start}`;
  const teacherOf = (classId: string) => CLASS_BY_ID[classId]?.teacherId ?? 'T-TBC';

  const roomFree = (w: Week, d: Day, start: number, roomId: string) =>
    !(roomAt.get(slotKey(w, d, start)) ?? new Set()).has(roomId);
  const teacherFree = (w: Week, d: Day, start: number, teacherId: string) =>
    !(roomAt.get(slotKey(w, d, start)) ?? new Set()).has(`T:${teacherId}`);

  const mark = (classId: string, w: Week, d: Day, start: number, roomId: string, teacherId: string) => {
    const k = slotKey(w, d, start);
    const s = roomAt.get(k) ?? new Set<string>();
    s.add(roomId);
    s.add(`T:${teacherId}`);
    roomAt.set(k, s);
    const dk = dayKey(w, d);
    const ds = dayOf.get(dk) ?? new Set<string>();
    ds.add(classId);
    dayOf.set(dk, ds);
  };

  const sameSessionExists = (w: Week, d: Day, start: number, roomId: string, teacherId: string) =>
    blocks.some(
      (b) =>
        b.week === w && b.day === d && b.startTime === start && b.roomId === roomId &&
        teacherOf(b.classId) === teacherId,
    );

  const tryPush = (
    classId: string,
    week: Week,
    day: Day,
    period: number,
    roomId: string,
    teacherIdOverride?: string,
    opts: { allowDocumentedClash?: boolean } = {},
  ): boolean => {
    const t = periodTimes(day, period);
    const teacherId = teacherIdOverride ?? teacherOf(classId);

    // exact duplicate of an already-created block?
    if (blocks.some((b) => b.classId === classId && b.week === week && b.day === day && b.startTime === t.start)) {
      return false;
    }
    const roomOK = roomFree(week, day, t.start, roomId);
    const teachOK = teacherFree(week, day, t.start, teacherId);
    if ((!roomOK || !teachOK) && !(opts.allowDocumentedClash && DOCUMENTED_CLASHES.has(slotKey(week, day, t.start)))) {
      return false;
    }
    blocks.push({
      blockId: blockId(week, day, period, classId),
      week,
      day,
      startTime: t.start,
      endTime: t.end,
      classId,
      roomId,
    });
    if (opts.allowDocumentedClash) {
      mark(classId, week, day, t.start, roomId, teacherId);
    } else {
      // still record the day so later cells route to siblings
      const dk = dayKey(week, day);
      const ds = dayOf.get(dk) ?? new Set<string>();
      ds.add(classId);
      dayOf.set(dk, ds);
    }
    return true;
  };

  /* --- 1. Demo students' individual timetables (authoritative) ---- */
  for (const [week, day, period, cell] of DEMO_CELLS) {
    const def = CLASS_MAP[cell];
    if (!def) throw new Error(`Unknown demo cell ${cell}`);
    sealed.add(def.classId);
    tryPush(def.classId, week, day, period, cell.split('@')[1], undefined, { allowDocumentedClash: true });
  }

  /* --- 2. Central 10TAY grid -------------------------------------- */
  const setSeq: Record<string, number> = {};
  for (const classId of Object.keys(CLASS_BY_ID)) {
    const subj = subjectCodeOfClassId(classId);
    setSeq[subj] = Math.max(setSeq[subj] ?? 0, Number(classId.split('-')[1]));
  }
  const nextSetNo = (subj: string) => {
    setSeq[subj] = (setSeq[subj] ?? 0) + 1;
    return setSeq[subj];
  };

  for (const week of ['A', 'B'] as Week[]) {
    for (const day of DAYS) {
      const periodCount = DAY_PATTERNS[day].periods.length;
      for (const row of GRID[week][day]) {
        for (let i = 0; i < row.length; i++) {
          const cell = row[i];
          if (!cell) continue;
          const period = i; // 0 = homeroom
          if (period > periodCount) continue;
          const [subj, roomId] = cell.split('@');
          const def = CLASS_MAP[cell];
          if (!def) throw new Error(`Unknown grid cell ${cell} (${week} ${day})`);
          const base = def.classId;
          const t = periodTimes(day, period);
          const teacherId = CLASS_BY_ID[base]?.teacherId ?? 'T-TBC';

          // identical session already created (e.g. Assembly vs the grid's
          // ABL label for the same form room / teacher / slot)?
          if (sameSessionExists(week, day, t.start, roomId, teacherId)) continue;
          // exact duplicate of the same class at the same slot?
          if (blocks.some((b) => b.classId === base && b.week === week && b.day === day && b.startTime === t.start)) continue;

          const baseUsable =
            !sealed.has(base) && !(dayOf.get(dayKey(week, day)) ?? new Set()).has(base) &&
            roomFree(week, day, t.start, roomId) && teacherFree(week, day, t.start, teacherId);

          if (baseUsable) {
            if (tryPush(base, week, day, period, roomId, teacherId)) continue;
          }

          // move to (or create) a sibling set of the same subject + teacher
          let sibling: string | null = null;
          for (const cid of Object.keys(CLASS_BY_ID)) {
            if (cid === base || sealed.has(cid)) continue;
            if (subjectCodeOfClassId(cid) !== subj) continue;
            if (CLASS_BY_ID[cid].teacherId !== teacherId) continue;
            if ((dayOf.get(dayKey(week, day)) ?? new Set()).has(cid)) continue;
            if (!roomFree(week, day, t.start, roomId) || !teacherFree(week, day, t.start, teacherId)) continue;
            sibling = cid;
            break;
          }
          if (!sibling) {
            const candidate = `${subj}-${nextSetNo(subj)}`;
            if (tryPush(candidate, week, day, period, roomId, teacherId)) {
              const cls: Class = { classId: candidate, subjectId: `SUB-${subj}`, teacherId, group: '' };
              CLASS_BY_ID[candidate] = cls;
              extraClasses.push(cls);
            }
            continue;
          }
          tryPush(sibling, week, day, period, roomId, teacherId);
        }
      }
    }
  }

  return { blocks, extraClasses };
}

const built = build();

export const TIMETABLE_BLOCKS: TimetableBlock[] = built.blocks;
export const EXTRA_CLASSES: Class[] = built.extraClasses;

/* ------------------------------------------------------------------ */
/* Integrity validation                                                */
/* ------------------------------------------------------------------ */

export function validateTimetable(blocks: TimetableBlock[]): string[] {
  const problems: string[] = [];
  const roomAt = new Map<string, Set<string>>();
  const teacherAt = new Map<string, Set<string>>();

  for (const b of blocks) {
    const key = `${b.week}|${b.day}|${b.startTime}`;
    const teacherId = CLASS_BY_ID[b.classId]?.teacherId ?? 'UNKNOWN';

    const r = roomAt.get(key) ?? new Set<string>();
    if (r.has(b.roomId) && !DOCUMENTED_CLASHES.has(key)) {
      problems.push(`Room ${b.roomId} double-booked at ${key}`);
    }
    r.add(b.roomId);
    roomAt.set(key, r);

    const t = teacherAt.get(key) ?? new Set<string>();
    if (t.has(teacherId) && !DOCUMENTED_CLASHES.has(key)) {
      problems.push(`Teacher ${teacherId} double-booked at ${key}`);
    }
    t.add(teacherId);
    teacherAt.set(key, t);
  }

  return problems;
}

const PROBLEMS = validateTimetable(TIMETABLE_BLOCKS);
if (PROBLEMS.length > 0 && process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.warn('[SCAS] Central timetable integrity warnings:', PROBLEMS);
}
