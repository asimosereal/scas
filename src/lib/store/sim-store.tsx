'use client';

/**
 * SCAS SIMULATION STORE
 * ==================================================================
 * A single React context holding the whole simulation state:
 *   - the simulation clock (week / day / date / time)
 *   - the simulator inputs
 *   - all runtime records (attendance, scans, audit, terminals, events)
 *
 * Deliberately framework-light: a reducer + context, so the business
 * logic stays independent of React and can be reused for pseudocode
 * extraction. Persistence is via localStorage so a refresh keeps the
 * simulated day.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type {
  AttendanceRecord,
  AuditEntry,
  Day,
  EventMovement,
  Room as RoomType,
  RuntimeState,
  ScanEvent,
  ScasEvent,
  SimulatorState,
  Terminal,
  Week,
} from '../types';
import { SCHOOL_DATA } from '../data';
import {
  calculateAttendanceStatus,
  calculateLateMinutes,
  checkDuplicateScan,
  hasFinished,
  markAbsentStudents,
  processAutoTransfer,
  processBreak,
  registerBlockStarts,
  type BreakState,
} from '../engine/attendance-engine';
import {
  getBlockForRoom,
  getCurrentTeacherBlock,
  getCurrentTimetableBlock,
  getStudentExpectedClass,
  validateStudentRoom,
} from '../engine/timetable-engine';
import { identifyStudent } from '../engine/identity-engine';
import { formatTime, toMinutes } from '../time';

registerBlockStarts(SCHOOL_DATA.timetableBlocks);

const STORAGE_KEY = 'scas.simulation.v2';

/* ------------------------------------------------------------------ */
/* Initial state                                                       */
/* ------------------------------------------------------------------ */

function buildTerminals(): Terminal[] {
  return SCHOOL_DATA.rooms
    .filter((r) => r.roomId !== 'B101' && r.roomId !== 'B102' && r.roomId !== 'B103')
    .map((r) => ({
      terminalId: `T-${r.roomId}`,
      roomId: r.roomId,
      label: `SCAS Terminal ${r.roomName}`,
      status: 'ONLINE' as const,
      mode: 'NORMAL' as const,
      eventId: null,
      queuedScans: 0,
    }));
}

export interface SimState {
  /* clock */
  week: Week;
  day: Day;
  date: string;
  time: number;
  running: boolean;
  mode: 'SIMULATION' | 'LIVE';

  /* identity / role */
  role: 'office' | 'teacher' | 'student';
  currentTeacherId: string;

  /* simulator */
  sim: SimulatorState;
  breakState: Record<string, { onBreak: boolean; breakStartedAt: number | null; accumulatedMinutes: number }>;

  /* runtime */
  attendance: AttendanceRecord[];
  scans: ScanEvent[];
  audit: AuditEntry[];
  terminals: Terminal[];
  events: ScasEvent[];
  movements: EventMovement[];

  /* transient UI feedback */
  lastScan: ScanEvent | null;
  terminalMessage: { tone: 'success' | 'warning' | 'error' | 'info'; text: string } | null;
  toastSeq: number;
}

const INITIAL: SimState = {
  week: 'A',
  day: 'Monday',
  date: '02/10/2026',
  time: toMinutes('08:47'),
  running: false,
  mode: 'SIMULATION',

  role: 'office',
  currentTeacherId: 'T-SIL',

  sim: {
    studentId: 'S-KL3946',
    typedStudentNumber: 'KL3946',
    roomId: 'B209',
    faceConfidence: 96,
    networkOnline: true,
    scenario: {
      duplicateScan: false,
      wrongFace: false,
      forgottenCard: false,
      cameraFailure: false,
      networkFailure: false,
      notExpectedInRoom: false,
      emergencyMode: false,
    },
  },
  breakState: {},

  attendance: [],
  scans: [],
  audit: [],
  terminals: buildTerminals(),
  events: [],
  movements: [],

  lastScan: null,
  terminalMessage: null,
  toastSeq: 0,
};

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

type Action =
  | { type: 'HYDRATE'; state: SimState }
  | { type: 'SET_CLOCK'; patch: Partial<Pick<SimState, 'week' | 'day' | 'date' | 'time' | 'running' | 'mode'>> }
  | { type: 'TICK' }
  | { type: 'SET_ROLE'; role: SimState['role']; teacherId?: string }
  | { type: 'SET_SIM'; patch: Partial<SimulatorState> }
  | { type: 'SET_SCENARIO'; patch: Partial<SimulatorState['scenario']> }
  | { type: 'APPLY_SCAN'; payload: ScanOutcome }
  | { type: 'SET_TERMINAL_STATUS'; terminalId: string; status: Terminal['status'] }
  | { type: 'TOGGLE_BREAK'; studentId: string; break: BreakState; record: AttendanceRecord | null }
  | { type: 'OVERRIDE'; recordId: string; newStatus: AttendanceRecord['status']; reason: string; teacherId: string }
  | { type: 'REVIEW_CONFIRM'; recordId: string; teacherId: string }
  | { type: 'ACTIVATE_EVENT'; event: ScasEvent }
  | { type: 'END_EVENT'; eventId: string }
  | { type: 'ADD_MOVEMENT'; movement: EventMovement }
  | { type: 'RESET_DAY' }
  | { type: 'RESET_ALL' }
  | { type: 'TOAST'; tone: 'success' | 'warning' | 'error' | 'info'; text: string }
  | { type: 'CLEAR_TOAST' };

export interface ScanOutcome {
  scan: ScanEvent;
  attendance: AttendanceRecord[];
  terminals: Terminal[];
  message: { tone: 'success' | 'warning' | 'error' | 'info'; text: string };
  audit?: AuditEntry;
}

let scanCounter = 0;
let attCounter = 0;
let auditCounter = 0;
function nextId(prefix: string): string {
  scanCounter += 1;
  attCounter += 1;
  auditCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${scanCounter}${attCounter}${auditCounter}`;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'SET_CLOCK':
      return { ...state, ...action.patch };

    case 'TICK': {
      const t = state.time + 1;
      return t <= 15 * 60 + 30 ? { ...state, time: t } : { ...state, running: false };
    }

    case 'SET_ROLE':
      return {
        ...state,
        role: action.role,
        currentTeacherId: action.teacherId ?? state.currentTeacherId,
      };

    case 'SET_SIM':
      return { ...state, sim: { ...state.sim, ...action.patch } };

    case 'SET_SCENARIO':
      return {
        ...state,
        sim: { ...state.sim, scenario: { ...state.sim.scenario, ...action.patch } },
      };

    case 'APPLY_SCAN':
      return {
        ...state,
        attendance: action.payload.attendance,
        scans: [action.payload.scan, ...state.scans],
        terminals: action.payload.terminals,
        lastScan: action.payload.scan,
        terminalMessage: action.payload.message,
        audit: action.payload.audit ? [action.payload.audit, ...state.audit] : state.audit,
        toastSeq: state.toastSeq + 1,
      };

    case 'SET_TERMINAL_STATUS':
      return {
        ...state,
        terminals: state.terminals.map((t) =>
          t.terminalId === action.terminalId
            ? { ...t, status: action.status, queuedScans: action.status === 'ONLINE' ? 0 : t.queuedScans }
            : t,
        ),
      };

    case 'TOGGLE_BREAK':
      return {
        ...state,
        breakState: { ...state.breakState, [action.studentId]: action.break },
        attendance: action.record
          ? state.attendance.map((r) =>
              r.attendanceId === action.record!.attendanceId ? action.record! : r,
            )
          : state.attendance,
      };

    case 'OVERRIDE': {
      const target = state.attendance.find((r) => r.attendanceId === action.recordId);
      if (!target) return state;
      const updated: AttendanceRecord = {
        ...target,
        status: action.newStatus,
        reviewStatus: 'OVERRIDDEN',
        overrideReason: action.reason,
        verificationMethod: 'TEACHER_OVERRIDE',
      };
      const audit: AuditEntry = {
        auditId: nextId('AUD'),
        userId: action.teacherId,
        userRole: 'TEACHER',
        action: 'ATTENDANCE_OVERRIDE',
        recordId: target.attendanceId,
        oldValue: target.status,
        newValue: action.newStatus,
        reason: action.reason,
        timestamp: state.time,
        week: state.week,
        day: state.day,
      };
      return {
        ...state,
        attendance: state.attendance.map((r) => (r.attendanceId === action.recordId ? updated : r)),
        audit: [audit, ...state.audit],
        toastSeq: state.toastSeq + 1,
        terminalMessage: { tone: 'success', text: `OVERRIDE APPLIED — ${target.studentId} set to ${action.newStatus}` },
      };
    }

    case 'REVIEW_CONFIRM': {
      const target = state.attendance.find((r) => r.attendanceId === action.recordId);
      if (!target) return state;
      const audit: AuditEntry = {
        auditId: nextId('AUD'),
        userId: action.teacherId,
        userRole: 'TEACHER',
        action: 'REVIEW_CONFIRM',
        recordId: target.attendanceId,
        oldValue: target.status,
        newValue: 'PRESENT',
        reason: 'Identity confirmed by teacher',
        timestamp: state.time,
        week: state.week,
        day: state.day,
      };
      return {
        ...state,
        attendance: state.attendance.map((r) =>
          r.attendanceId === action.recordId
            ? { ...r, status: 'PRESENT', reviewStatus: 'CONFIRMED', lateMinutes: 0, overrideReason: null }
            : r,
        ),
        audit: [audit, ...state.audit],
        toastSeq: state.toastSeq + 1,
        terminalMessage: { tone: 'success', text: 'REVIEW ITEM CONFIRMED' },
      };
    }

    case 'ACTIVATE_EVENT': {
      return {
        ...state,
        events: [action.event, ...state.events.filter((e) => e.eventId !== action.event.eventId)],
        terminals: state.terminals.map((t) =>
          action.event.terminalIds.includes(t.terminalId)
            ? { ...t, mode: 'EVENT', eventId: action.event.eventId, status: 'ONLINE' as const }
            : t,
        ),
        toastSeq: state.toastSeq + 1,
        terminalMessage: { tone: 'warning', text: `EVENT MODE ACTIVE — ${action.event.eventName}` },
      };
    }

    case 'END_EVENT':
      return {
        ...state,
        events: state.events.map((e) =>
          e.eventId === action.eventId ? { ...e, active: false, endTime: state.time } : e,
        ),
        terminals: state.terminals.map((t) =>
          t.eventId === action.eventId ? { ...t, mode: 'NORMAL', eventId: null } : t,
        ),
        toastSeq: state.toastSeq + 1,
        terminalMessage: { tone: 'info', text: 'EVENT MODE ENDED' },
      };

    case 'ADD_MOVEMENT':
      return { ...state, movements: [action.movement, ...state.movements] };

    case 'RESET_DAY':
      return { ...state, attendance: [], scans: [], movements: [], toastSeq: state.toastSeq + 1 };

    case 'RESET_ALL':
      return { ...INITIAL, terminals: buildTerminals(), toastSeq: state.toastSeq + 1 };

    case 'TOAST':
      return { ...state, terminalMessage: { tone: action.tone, text: action.text }, toastSeq: state.toastSeq + 1 };

    case 'CLEAR_TOAST':
      return { ...state, terminalMessage: null };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface Ctx {
  state: SimState;
  dispatch: React.Dispatch<Action>;
  /* derived helpers */
  data: typeof SCHOOL_DATA;
  activeBlocks: ReturnType<typeof getCurrentTimetableBlock>;
  roomBlock: ReturnType<typeof getBlockForRoom>;
  teacherBlock: ReturnType<typeof getCurrentTeacherBlock>;
  expectedLesson: ReturnType<typeof getStudentExpectedClass>;
  validation: ReturnType<typeof validateStudentRoom> | null;
  breakState: SimState['breakState'];
  runScan: () => void;
  toggleBreak: (studentId: string) => void;
  setClock: (patch: Partial<Pick<SimState, 'week' | 'day' | 'date' | 'time'>>) => void;
}

function getCurrentBlocksSafe(state: SimState) {
  return getCurrentTimetableBlock(SCHOOL_DATA, { week: state.week, day: state.day, time: state.time });
}

const SimContext = createContext<Ctx | null>(null);

export function SimProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const hydrated = useRef(false);

  /* --- persistence ------------------------------------------------ */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SimState;
        dispatch({ type: 'HYDRATE', state: { ...parsed, running: false } });
      }
    } catch {
      /* ignore corrupt storage */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage full — prototype does not depend on it */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [state]);

  /* --- simulated clock ticker ------------------------------------ */
  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => window.clearInterval(id);
  }, [state.running]);

  /* --- derived context ------------------------------------------- */
  const activeBlocks = useMemo(
    () => getCurrentBlocksSafe(state),
    [state.week, state.day, state.time],
  );

  const roomBlock = useMemo(
    () => getBlockForRoom(SCHOOL_DATA, { week: state.week, day: state.day, time: state.time }, state.sim.roomId),
    [state.week, state.day, state.time, state.sim.roomId],
  );

  const teacherBlock = useMemo(
    () => getCurrentTeacherBlock(SCHOOL_DATA, state.currentTeacherId, { week: state.week, day: state.day, time: state.time }, state.sim.roomId),
    [state.currentTeacherId, state.week, state.day, state.time, state.sim.roomId],
  );

  const expectedLesson = useMemo(
    () => (state.sim.studentId ? getStudentExpectedClass(SCHOOL_DATA, state.sim.studentId, { week: state.week, day: state.day, time: state.time }) : null),
    [state.sim.studentId, state.week, state.day, state.time],
  );

  const validation = useMemo(
    () =>
      state.sim.studentId
        ? validateStudentRoom(SCHOOL_DATA, state.sim.studentId, { week: state.week, day: state.day, time: state.time }, state.sim.roomId)
        : null,
    [state.sim.studentId, state.sim.roomId, state.week, state.day, state.time],
  );

  /* --- the scan pipeline ----------------------------------------- */
  const runScan = useCallback(() => {
    const sc = state.sim.scenario;
    const terminal = state.terminals.find((t) => t.roomId === state.sim.roomId);
    if (!terminal) return;

    const offline = sc.networkFailure || terminal.status === 'OFFLINE' || terminal.mode === 'EVENT';
    const targetRoom = sc.notExpectedInRoom
      ? pickWrongRoom(state.sim.roomId)
      : state.sim.roomId;
    const targetTerminal = state.terminals.find((t) => t.roomId === targetRoom) ?? terminal;

    /* 1. IDENTIFY ------------------------------------------------- */
    const identity = identifyStudent(SCHOOL_DATA, {
      cardNumber: sc.forgottenCard ? '' : state.sim.typedStudentNumber,
      faceConfidence: sc.wrongFace ? 52 : sc.cameraFailure ? 0 : state.sim.faceConfidence,
      cameraFailure: sc.cameraFailure,
      typedId: state.sim.typedStudentNumber,
      typedPin: state.sim.studentId ? SCHOOL_DATA.students.find((s) => s.studentId === state.sim.studentId)?.backupPin : undefined,
    });

    const baseScan = {
      scanId: nextId('SCN'),
      terminalId: targetTerminal.terminalId,
      studentId: identity.student?.studentId ?? null,
      timestamp: state.time,
      week: state.week,
      day: state.day,
      verificationConfidence: identity.confidence,
      synced: false,
    };

    /* 2. FAILED IDENTIFICATION ----------------------------------- */
    if (!identity.student) {
      dispatch({
        type: 'APPLY_SCAN',
        payload: {
          scan: { ...baseScan, result: 'INVALID_CARD', message: identity.message },
          attendance: state.attendance,
          terminals: state.terminals,
          message: { tone: 'error', text: identity.message },
        },
      });
      return;
    }

    const studentId = identity.student.studentId;

    /* 3. EVENT MODE ---------------------------------------------- */
    if (terminal.mode === 'EVENT' && terminal.eventId) {
      const movement: EventMovement = {
        movementId: nextId('MOV'),
        eventId: terminal.eventId,
        studentId,
        terminalId: terminal.terminalId,
        timestamp: state.time,
        movementType: 'ENTER',
      };
      dispatch({ type: 'ADD_MOVEMENT', movement });
      dispatch({
        type: 'APPLY_SCAN',
        payload: {
          scan: { ...baseScan, result: 'EVENT_MODE_QUEUED', message: 'MOVEMENT RECORDED IN EVENT LOG (ATTENDANCE UNCHANGED)' },
          attendance: state.attendance,
          terminals: state.terminals,
          message: { tone: 'warning', text: 'EVENT MODE — MOVEMENT LOGGED SEPARATELY' },
        },
      });
      return;
    }

    /* 4. ROOM VALIDATION ----------------------------------------- */
    const check = validateStudentRoom(SCHOOL_DATA, studentId, { week: state.week, day: state.day, time: state.time }, targetRoom);
    if (!check.valid) {
      const block = check.roomBlock;
      dispatch({
        type: 'APPLY_SCAN',
        payload: {
          scan: { ...baseScan, result: 'NOT_EXPECTED', message: check.message },
          attendance: state.attendance,
          terminals: state.terminals,
          message: { tone: 'error', text: check.message },
          audit: {
            auditId: nextId('AUD'),
            userId: 'TERMINAL',
            userRole: 'SYSTEM',
            action: 'EXCEPTION_RAISED',
            recordId: studentId,
            oldValue: '-',
            newValue: check.reason,
            reason: check.message,
            timestamp: state.time,
            week: state.week,
            day: state.day,
          },
        },
      });
      void block;
      return;
    }

    const lesson = check.expectedLesson!;
    const block = lesson.block;

    /* 5. DUPLICATE SCAN ------------------------------------------ */
    if (sc.duplicateScan) {
      const dupe = checkDuplicateScan(state.attendance, studentId, block.blockId);
      dispatch({
        type: 'APPLY_SCAN',
        payload: {
          scan: {
            ...baseScan,
            result: 'DUPLICATE_IGNORED',
            message: dupe
              ? 'DUPLICATE SCAN — ALREADY RECORDED FOR THIS LESSON'
              : 'DUPLICATE SCAN FLAG — RECORD CREATED (no prior record existed)',
          },
          attendance: state.attendance,
          terminals: state.terminals,
          message: dupe
            ? { tone: 'warning', text: 'DUPLICATE SCAN BLOCKED — NO NEW RECORD' }
            : { tone: 'info', text: 'NO PRIOR RECORD — NORMAL ENTRY CREATED' },
        },
      });
      return;
    }

    /* 6. BUILD THE RECORD ---------------------------------------- */
    const status = calculateAttendanceStatus(state.time, block.startTime);
    const late = calculateLateMinutes(state.time, block.startTime);
    const needsReview = identity.requiresReview;

    const record: AttendanceRecord = {
      attendanceId: `${block.blockId}::${studentId}`,
      studentId,
      classId: block.classId,
      roomId: targetRoom,
      blockId: block.blockId,
      week: state.week,
      day: state.day,
      entryTime: state.time,
      exitTime: null,
      status: needsReview ? 'REVIEW' : status,
      lateMinutes: late,
      verificationMethod:
        identity.method === 'MANUAL_ID_PIN'
          ? 'MANUAL_ID_PIN'
          : identity.confidence !== null && identity.confidence >= 75
            ? 'RFID_FACE'
            : 'RFID',
      verificationConfidence: identity.confidence,
      reviewStatus: needsReview ? 'PENDING' : 'NONE',
      overrideReason: null,
      breakMinutes: 0,
      pendingSync: offline,
    };

    /* 7. AUTO-TRANSFER ------------------------------------------- */
    const transfer = processAutoTransfer(state.attendance, studentId, targetRoom, state.time);
    const withTransferClosed = state.attendance.map((r) => {
      const c = transfer.closed.find((x) => x.record.attendanceId === r.attendanceId);
      return c ? { ...r, exitTime: c.exitTime } : r;
    });

    /* 8. ABSENT FINALISATION for anything that has ended ---------- */
    const endedBlocks = SCHOOL_DATA.timetableBlocks.filter(
      (b) => b.week === state.week && b.day === state.day && hasFinished(b, state.time) && !b.classId.startsWith('HO-'),
    );
    const absentAdditions: AttendanceRecord[] = [];
    for (const eb of endedBlocks) {
      const expected = SCHOOL_DATA.enrolments
        .filter((e) => e.classId === eb.classId && e.week === state.week)
        .map((e) => e.studentId);
      const existing = withTransferClosed.filter((r) => r.blockId === eb.blockId);
      absentAdditions.push(...markAbsentStudents(expected, existing, eb));
    }

    const nextAttendance = [...withTransferClosed, ...absentAdditions, record];

    const terminalUpdate = offline
      ? state.terminals.map((t) =>
          t.terminalId === targetTerminal.terminalId
            ? { ...t, status: 'OFFLINE' as const, queuedScans: t.queuedScans + 1 }
            : t,
        )
      : state.terminals;

    const resultLabel = record.status === 'LATE' ? `LATE by ${late} min` : record.status;
    const transferNote =
      transfer.closed.length > 0
        ? ` · AUTO-TRANSFER from ${transfer.closed.map((c) => c.record.roomId).join(', ')} (${transfer.totalTransferMinutes} min)`
        : '';

    dispatch({
      type: 'APPLY_SCAN',
      payload: {
        scan: {
          ...baseScan,
          result: offline ? 'TERMINAL_OFFLINE_QUEUED' : needsReview ? 'FACE_REVIEW' : 'ACCEPTED',
          message: offline
            ? 'TERMINAL OFFLINE — SCAN QUEUED LOCALLY'
            : `${resultLabel} — ${lesson.subject.name} in ${lesson.room.roomName}`,
        },
        attendance: nextAttendance,
        terminals: terminalUpdate,
        message: offline
          ? { tone: 'warning', text: 'TERMINAL OFFLINE — SCAN QUEUED FOR LATER SYNC' }
          : needsReview
            ? { tone: 'warning', text: 'IDENTITY UNCERTAIN — SENT TO TEACHER REVIEW' }
            : { tone: 'success', text: `${identity.student.name} — ${resultLabel}${transferNote}` },
      },
    });
  }, [state]);

  const setClock = useCallback(
    (patch: Partial<Pick<SimState, 'week' | 'day' | 'date' | 'time'>>) => {
      dispatch({ type: 'SET_CLOCK', patch });
    },
    [],
  );

  /* --- break workflow (tap → break → tap) ----------------------- */
  const toggleBreak = useCallback(
    (studentId: string) => {
      const block = roomBlock;
      if (!block) {
        dispatch({
          type: 'TOAST',
          tone: 'info',
          text: 'No active lesson in this room to take a break from',
        });
        return;
      }
      const rec = state.attendance.find(
        (r) => r.studentId === studentId && r.blockId === block.blockId,
      );
      if (!rec) {
        dispatch({
          type: 'TOAST',
          tone: 'warning',
          text: 'Scan in first — there is no attendance record to pause',
        });
        return;
      }
      const prev: BreakState = state.breakState[studentId] ?? {
        onBreak: false,
        breakStartedAt: null,
        accumulatedMinutes: rec.breakMinutes,
      };
      const { next, event, minutes } = processBreak(prev, state.time);
      const updatedRec: AttendanceRecord =
        event === 'BREAK_END'
          ? { ...rec, breakMinutes: rec.breakMinutes + minutes }
          : rec;
      dispatch({ type: 'TOGGLE_BREAK', studentId, break: next, record: updatedRec });
      dispatch({
        type: 'TOAST',
        tone: 'info',
        text:
          event === 'BREAK_START'
            ? 'Break started — tap again on return'
            : `Break ended — ${minutes} min recorded`,
      });
    },
    [state.attendance, state.breakState, state.time, roomBlock],
  );

  const value: Ctx = {
    state,
    dispatch,
    data: SCHOOL_DATA,
    activeBlocks,
    roomBlock,
    teacherBlock,
    expectedLesson,
    validation,
    breakState: state.breakState,
    runScan,
    toggleBreak,
    setClock,
  };

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): Ctx {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim must be used inside <SimProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Pick a room that is definitely NOT this student's expected room. */
function pickWrongRoom(currentRoomId: string): string {
  const candidates = ['B323', 'B420', 'B308', 'A305', 'B315'];
  return candidates.find((r) => r !== currentRoomId) ?? 'B323';
}

export { formatTime, toMinutes };
export type { RoomType };
