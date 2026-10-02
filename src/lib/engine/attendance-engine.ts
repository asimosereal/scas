/**
 * ATTENDANCE ENGINE
 * ==================================================================
 * This file holds the business logic listed in requirement 28. Every
 * function is small, named after the step it performs, and free of UI
 * concerns, so each one can be lifted straight into a flowchart or
 * rewritten as IGCSE pseudocode.
 *
 * The functions are split across two files for readability:
 *   attendance-engine.ts  -> pure calculations & decisions
 *   attendance-processor.ts-> stateful orchestration of a scan event
 */

import type {
  AttendanceRecord,
  AttendanceStatus,
  Day,
  Minutes,
  SchoolData,
  TimetableBlock,
  Week,
} from '../types';

/* ------------------------------------------------------------------ */
/* 1. PRESENT / LATE                                                  */
/* ------------------------------------------------------------------ */

/**
 * calculateAttendanceStatus()
 * ------------------------------------------------------------------
 * Requirement 15.1 / 15.2
 *   scan time <= lesson start  ->  PRESENT
 *   scan time >  lesson start  ->  LATE
 */
export function calculateAttendanceStatus(
  scanTime: Minutes,
  lessonStart: Minutes,
): Extract<AttendanceStatus, 'PRESENT' | 'LATE'> {
  return scanTime <= lessonStart ? 'PRESENT' : 'LATE';
}

/**
 * calculateLateMinutes()
 * ------------------------------------------------------------------
 * late duration = scan time - lesson start, floored at zero.
 */
export function calculateLateMinutes(scanTime: Minutes, lessonStart: Minutes): number {
  return Math.max(0, scanTime - lessonStart);
}

/* ------------------------------------------------------------------ */
/* 2. DUPLICATE SCAN                                                  */
/* ------------------------------------------------------------------ */

/**
 * checkDuplicateScan()
 * ------------------------------------------------------------------
 * Requirement 15.4. Within the SAME attendance context (same student,
 * same block) a second tap must not create a second record.
 */
export function checkDuplicateScan(
  records: AttendanceRecord[],
  studentId: string,
  blockId: string,
): AttendanceRecord | null {
  return (
    records.find((r) => r.studentId === studentId && r.blockId === blockId) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* 3. AUTO-TRANSFER                                                   */
/* ------------------------------------------------------------------ */

/**
 * processAutoTransfer()
 * ------------------------------------------------------------------
 * Requirement 15.5. A normal student moving between classrooms does
 * NOT tap out. When they scan into their next expected classroom we
 * close whatever lesson they were previously open in.
 *
 * Returns the records that should be closed (with exit time filled in)
 * and the total minutes the student spent in the previous room.
 */
export interface AutoTransferResult {
  closed: { record: AttendanceRecord; exitTime: Minutes; minutesInRoom: number }[];
  totalTransferMinutes: number;
}

export function processAutoTransfer(
  records: AttendanceRecord[],
  studentId: string,
  newRoomId: string,
  now: Minutes,
): AutoTransferResult {
  const open = records.filter(
    (r) => r.studentId === studentId && r.exitTime === null && r.status !== 'ABSENT',
  );

  const closed: AutoTransferResult['closed'] = [];
  let total = 0;

  for (const rec of open) {
    if (rec.roomId === newRoomId) continue; // same room, nothing to transfer
    const minutesInRoom = rec.entryTime === null ? 0 : Math.max(0, now - rec.entryTime);
    closed.push({ record: rec, exitTime: now, minutesInRoom });
    total += minutesInRoom;
  }

  return { closed, totalTransferMinutes: total };
}

/* ------------------------------------------------------------------ */
/* 4. BREAK                                                            */
/* ------------------------------------------------------------------ */

/**
 * processBreak()
 * ------------------------------------------------------------------
 * Requirement 15.6. An authorised temporary exit. The student taps to
 * begin a break and again on return; the duration is accumulated onto
 * the attendance record rather than closing it.
 */
export interface BreakState {
  onBreak: boolean;
  breakStartedAt: Minutes | null;
  accumulatedMinutes: number;
}

export function processBreak(
  state: BreakState,
  now: Minutes,
): { next: BreakState; event: 'BREAK_START' | 'BREAK_END' | 'NONE'; minutes: number } {
  if (!state.onBreak) {
    return {
      next: { ...state, onBreak: true, breakStartedAt: now },
      event: 'BREAK_START',
      minutes: 0,
    };
  }
  const minutes =
    state.breakStartedAt === null ? 0 : Math.max(0, now - state.breakStartedAt);
  return {
    next: { onBreak: false, breakStartedAt: null, accumulatedMinutes: state.accumulatedMinutes + minutes },
    event: 'BREAK_END',
    minutes,
  };
}

/* ------------------------------------------------------------------ */
/* 5. ABSENT finalisation                                             */
/* ------------------------------------------------------------------ */

/**
 * hasFinished()
 * Has the lesson ended? Used by markAbsentStudents().
 */
export function hasFinished(block: TimetableBlock, now: Minutes): boolean {
  return now >= block.endTime;
}

/**
 * markAbsentStudents()
 * ------------------------------------------------------------------
 * Requirement 15.3. When a lesson ends, any expected student with no
 * attendance record is automatically marked ABSENT.
 *
 * Must NOT overwrite students who are already PRESENT / LATE / REVIEW.
 */
export function markAbsentStudents(
  expectedStudentIds: string[],
  existing: AttendanceRecord[],
  block: TimetableBlock,
): AttendanceRecord[] {
  const seen = new Set(existing.map((r) => r.studentId));
  const created: AttendanceRecord[] = [];

  for (const studentId of expectedStudentIds) {
    if (seen.has(studentId)) continue;
    created.push({
      attendanceId: `${block.blockId}::${studentId}::ABSENT`,
      studentId,
      classId: block.classId,
      roomId: block.roomId,
      blockId: block.blockId,
      week: block.week,
      day: block.day,
      entryTime: null,
      exitTime: block.endTime,
      status: 'ABSENT',
      lateMinutes: 0,
      verificationMethod: 'TEACHER_OVERRIDE',
      verificationConfidence: null,
      reviewStatus: 'NONE',
      overrideReason: null,
      breakMinutes: 0,
      pendingSync: false,
    });
  }

  return created;
}

/* ------------------------------------------------------------------ */
/* 6. Manual override + audit                                         */
/* ------------------------------------------------------------------ */

export const OVERRIDE_REASONS = [
  'Forgotten RFID card',
  'Camera inconclusive',
  'Reader error',
  'Student was physically present',
  'Student arrived after lesson ended',
  'Other',
] as const;

export type OverrideReason = (typeof OVERRIDE_REASONS)[number];

/**
 * processManualOverride()
 * ------------------------------------------------------------------
 * Requirement 17. A teacher changes a status. A reason is MANDATORY —
 * there is no silent modification. Returns the new record plus the
 * before/after pair the audit log needs.
 */
export interface OverrideOutcome {
  ok: boolean;
  error?: string;
  updated?: AttendanceRecord;
  audit: {
    recordId: string;
    oldValue: string;
    newValue: string;
    reason: string;
  };
}

export function processManualOverride(
  record: AttendanceRecord,
  newStatus: AttendanceStatus,
  reason: string | null,
  teacherId: string,
): OverrideOutcome {
  if (!reason || reason.trim().length === 0) {
    return {
      ok: false,
      error: 'A REASON IS REQUIRED FOR EVERY OVERRIDE',
      audit: { recordId: record.attendanceId, oldValue: record.status, newValue: newStatus, reason: '' },
    };
  }

  if (record.status === newStatus) {
    return {
      ok: false,
      error: 'THE SELECTED STATUS MATCHES THE EXISTING STATUS',
      audit: { recordId: record.attendanceId, oldValue: record.status, newValue: newStatus, reason },
    };
  }

  return {
    ok: true,
    updated: {
      ...record,
      status: newStatus,
      // Overriding to PRESENT/LATE means the student was physically there.
      entryTime: record.entryTime ?? blockStartFallback(record),
      lateMinutes:
        newStatus === 'LATE' && record.entryTime !== null
          ? Math.max(0, record.entryTime - blockStartFallback(record))
          : newStatus === 'PRESENT'
            ? 0
            : record.lateMinutes,
      reviewStatus: 'OVERRIDDEN',
      overrideReason: reason,
      verificationMethod: 'TEACHER_OVERRIDE',
    },
    audit: {
      recordId: record.attendanceId,
      oldValue: record.status,
      newValue: newStatus,
      reason,
    },
  };
}

/** Attendance records do not carry the block, so we keep a lookup table. */
let BLOCK_START_CACHE = new Map<string, Minutes>();
export function registerBlockStarts(blocks: TimetableBlock[]): void {
  BLOCK_START_CACHE = new Map(blocks.map((b) => [b.blockId, b.startTime]));
}
function blockStartFallback(record: AttendanceRecord): Minutes {
  return BLOCK_START_CACHE.get(record.blockId) ?? 0;
}

/* ------------------------------------------------------------------ */
/* 7. Offline synchronisation                                         */
/* ------------------------------------------------------------------ */

export interface SyncResult {
  syncedCount: number;
  stillQueued: number;
  message: string;
}

/**
 * syncOfflineScans()
 * ------------------------------------------------------------------
 * Requirement 20. While a terminal is offline, scans are appended to a
 * local queue. When connectivity returns the queue is drained in
 * timestamp order and every record is marked no longer pending.
 */
export function syncOfflineScans(
  queued: { id: string; timestamp: Minutes }[],
  records: AttendanceRecord[],
  now: Minutes,
): { result: SyncResult; records: AttendanceRecord[] } {
  const ordered = [...queued].sort((a, b) => a.timestamp - b.timestamp);
  const pendingIds = new Set(ordered.map((q) => q.id));

  const updated = records.map((r) =>
    pendingIds.has(r.attendanceId) && r.pendingSync
      ? { ...r, pendingSync: false, status: normalisePendingStatus(r.status) }
      : r,
  );

  return {
    result: {
      syncedCount: ordered.length,
      stillQueued: 0,
      message:
        ordered.length === 0
          ? 'NOTHING TO SYNCHRONISE'
          : `SYNCHRONISED ${ordered.length} OFFLINE SCAN${ordered.length === 1 ? '' : 'S'}`,
    },
    records: updated,
  };
}

function normalisePendingStatus(s: AttendanceStatus): AttendanceStatus {
  return s === 'PENDING_SYNC' ? 'PRESENT' : s;
}

/* ------------------------------------------------------------------ */
/* 8. Summary helpers                                                  */
/* ------------------------------------------------------------------ */

export interface LessonSummary {
  expected: number;
  present: number;
  late: number;
  absent: number;
  review: number;
}

export function summariseLesson(
  expectedStudentIds: string[],
  records: AttendanceRecord[],
): LessonSummary {
  const inLesson = records.filter((r) => expectedStudentIds.includes(r.studentId));
  const count = (s: AttendanceStatus) =>
    inLesson.filter((r) => r.status === s).length;
  return {
    expected: expectedStudentIds.length,
    present: count('PRESENT'),
    late: count('LATE'),
    absent: count('ABSENT'),
    review: count('REVIEW'),
  };
}

/** Is the simulation moment inside any lesson at all? */
export function isDuringSchoolDay(time: Minutes): boolean {
  return time >= 8 * 60 + 20 && time <= 15 * 60;
}

export function describeMoment(
  block: TimetableBlock | null,
  week: Week,
  day: Day,
): string {
  if (!block) return `No lesson scheduled — ${week} / ${day}`;
  return `${block.classId} in ${block.roomId}`;
}
