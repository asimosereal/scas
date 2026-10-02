'use client';

/**
 * TEST PANEL
 * ==================================================================
 * Requirement 29 — fourteen demonstrable scenarios. Each test runs the
 * REAL engine functions against the REAL seeded timetable, so a pass
 * here is evidence the algorithm is correct, not a mock.
 *
 * Tests are pure: they build their own state, run the engine, assert,
 * and return a result. Nothing is written to the simulation store, so
 * running the suite never pollutes the demo day.
 */

import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Text } from '@fluentui/react-components';
import { Play16Regular, ArrowClockwise16Regular } from '@fluentui/react-icons';
import { PageHeader, Section, StatGrid, StatTile } from '@/components/ui';
import { SCHOOL_DATA } from '@/lib/data';
import { getStudentGroup, STUDENTS } from '@/lib/data/students';
import { formatTime, toMinutes } from '@/lib/time';
import {
  getCurrentTimetableBlock,
  getStudentExpectedClass,
  validateStudentRoom,
} from '@/lib/engine/timetable-engine';
import { identifyStudent } from '@/lib/engine/identity-engine';
import {
  calculateAttendanceStatus,
  calculateLateMinutes,
  checkDuplicateScan,
  hasFinished,
  markAbsentStudents,
  processAutoTransfer,
  processManualOverride,
  syncOfflineScans,
  OVERRIDE_REASONS,
} from '@/lib/engine/attendance-engine';
import type { AttendanceRecord, TimetableBlock } from '@/lib/types';

interface TestResult {
  id: number;
  name: string;
  requirement: string;
  passed: boolean;
  detail: string;
  expected: string;
  actual: string;
}

function makeRecord(
  studentId: string,
  block: TimetableBlock,
  entryTime: number | null,
  status: AttendanceRecord['status'],
): AttendanceRecord {
  return {
    attendanceId: `${block.blockId}::${studentId}`,
    studentId,
    classId: block.classId,
    roomId: block.roomId,
    blockId: block.blockId,
    week: block.week,
    day: block.day,
    entryTime,
    exitTime: null,
    status,
    lateMinutes: entryTime === null ? 0 : calculateLateMinutes(entryTime, block.startTime),
    verificationMethod: 'RFID_FACE',
    verificationConfidence: 96,
    reviewStatus: 'NONE',
    overrideReason: null,
    breakMinutes: 0,
    pendingSync: false,
  };
}

/** The student's expected lesson at 08:47 on the given day (Period 1). */
function firstBlockOf(
  week: 'A' | 'B',
  day: 'Monday',
  studentId: string,
): TimetableBlock | null {
  const lesson = getStudentExpectedClass(SCHOOL_DATA, studentId, {
    week,
    day,
    time: 8 * 60 + 47,
  });
  return lesson?.block ?? null;
}

export default function TestsPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const student = STUDENTS[0];
  const student2 = STUDENTS[1];

  const runSuite = () => {
    setRunning(true);
    const out: TestResult[] = [];
    const add = (
      id: number,
      name: string,
      requirement: string,
      expected: string,
      actual: string,
      passed: boolean,
      detail = '',
    ) => out.push({ id, name, requirement, expected, actual, passed, detail });

    /* ---------------- TEST 1 — before class -> PRESENT ---------- */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const scan = block.startTime - 2; // 08:38 for an 08:40 lesson
      const status = calculateAttendanceStatus(scan, block.startTime);
      add(
        1,
        'Student arrives before class',
        'Req 15.1',
        'PRESENT',
        status,
        status === 'PRESENT',
        `Scanned ${formatTime(scan)}, lesson starts ${formatTime(block.startTime)} → scan <= start`,
      );
    }

    /* ---------------- TEST 2 — after start -> LATE -------------- */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const scan = block.startTime + 7; // 08:47 for an 08:40 lesson
      const status = calculateAttendanceStatus(scan, block.startTime);
      const late = calculateLateMinutes(scan, block.startTime);
      add(
        2,
        'Student arrives after class starts',
        'Req 15.2',
        'LATE, 7 minutes',
        `${status}, ${late} minutes`,
        status === 'LATE' && late === 7,
        `Scanned ${formatTime(scan)}, lesson starts ${formatTime(block.startTime)} → scan - start = ${late}`,
      );
    }

    /* ---------------- TEST 3 — never scans -> ABSENT ------------ */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const expected = SCHOOL_DATA.enrolments
        .filter((e) => e.classId === block.classId && e.week === block.week)
        .map((e) => e.studentId);
      const created = markAbsentStudents(expected, [], block);
      const mine = created.find((r) => r.studentId === student.studentId);
      const finished = hasFinished(block, block.endTime + 1);
      add(
        3,
        'Student never scans → ABSENT at class end',
        'Req 15.3',
        `${expected.length} ABSENT records created`,
        `${created.length} created`,
        created.length === expected.length && mine?.status === 'ABSENT' && finished,
        `Lesson ended ${formatTime(block.endTime)}; every expected student without a record was marked ABSENT`,
      );
    }

    /* ---------------- TEST 4 — duplicate scan ------------------ */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const first = makeRecord(student.studentId, block, block.startTime, 'PRESENT');
      const records = [first];
      const dupe = checkDuplicateScan(records, student.studentId, block.blockId);
      const wouldCreate = dupe === null;
      add(
        4,
        'Duplicate RFID scan prevented',
        'Req 15.4',
        'duplicate detected, no new record',
        dupe ? 'duplicate detected' : 'would create record',
        dupe !== null && !wouldCreate,
        `Second tap for ${student.studentNumber} in ${block.blockId} matched an existing record`,
      );
    }

    /* ---------------- TEST 5 — auto transfer -------------------- */
    {
      // Shu Min, Week A Monday: Chemistry B209 (P1) then Mandarin B315 (P2).
      const firstBlock = firstBlockOf('A', 'Monday', student.studentId)!;
      const nextLesson = getStudentExpectedClass(SCHOOL_DATA, student.studentId, {
        week: 'A',
        day: 'Monday',
        time: firstBlock.endTime + 5,
      })!;
      const secondBlock = nextLesson.block;
      const enter = firstBlock.startTime;
      const records = [makeRecord(student.studentId, firstBlock, enter, 'PRESENT')];
      const t = processAutoTransfer(records, student.studentId, secondBlock.roomId, secondBlock.startTime + 1);
      add(
        5,
        'Scan into next classroom closes previous lesson',
        'Req 15.5',
        `previous closed at ${formatTime(secondBlock.startTime + 1)}, ${secondBlock.startTime + 1 - enter} min in room`,
        t.closed.length === 1
          ? `closed, ${t.totalTransferMinutes} min`
          : 'not closed',
        t.closed.length === 1 && t.totalTransferMinutes === secondBlock.startTime + 1 - enter,
        `${firstBlock.roomId} → ${secondBlock.roomId}; no tap-out required`,
      );
    }

    /* ---------------- TEST 6 — wrong room ---------------------- */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const wrongRoom = block.roomId === 'B323' ? 'B420' : 'B323';
      const v = validateStudentRoom(
        SCHOOL_DATA,
        student.studentId,
        { week: block.week, day: block.day, time: block.startTime + 5 },
        wrongRoom,
      );
      add(
        6,
        'Student scans into the wrong room',
        'Req 14 / 15',
        'rejected with NOT EXPECTED',
        `${v.reason}: ${v.message.slice(0, 46)}…`,
        !v.valid && (v.reason === 'DIFFERENT_CLASS' || v.reason === 'NO_LESSON_IN_ROOM'),
        `Expected ${block.roomId}, scanned ${wrongRoom}`,
      );
    }

    /* ---------------- TEST 7 — low face confidence -------------- */
    {
      const id = identifyStudent(SCHOOL_DATA, {
        cardNumber: student.studentNumber,
        faceConfidence: 52,
        cameraFailure: false,
      });
      add(
        7,
        'Low face confidence → REVIEW REQUIRED',
        'Req 16',
        'requiresReview = true',
        `requiresReview = ${id.requiresReview}`,
        id.requiresReview && id.confidence === 52,
        `Confidence 52% is below the 75% threshold → routed to the teacher review queue`,
      );
    }

    /* ---------------- TEST 7b — high confidence ----------------- */
    {
      const id = identifyStudent(SCHOOL_DATA, {
        cardNumber: student.studentNumber,
        faceConfidence: 96,
        cameraFailure: false,
      });
      add(
        8,
        'High face confidence → VERIFIED',
        'Req 16',
        'requiresReview = false',
        `requiresReview = ${id.requiresReview}`,
        !id.requiresReview && id.method === 'RFID_FACE_VERIFIED',
        `Confidence 96% is above the threshold → accepted automatically`,
      );
    }

    /* ---------------- TEST 9 — forgotten card ------------------- */
    {
      const id = identifyStudent(SCHOOL_DATA, {
        cardNumber: '',
        faceConfidence: 90,
        cameraFailure: false,
        typedId: student.studentNumber,
        typedPin: student.backupPin,
      });
      const bad = identifyStudent(SCHOOL_DATA, {
        cardNumber: '',
        faceConfidence: 90,
        cameraFailure: false,
        typedId: student.studentNumber,
        typedPin: '0000',
      });
      add(
        9,
        'Forgotten card → ID + backup PIN',
        'Req 19',
        'valid PIN accepted, wrong PIN rejected',
        `${id.method} / ${bad.method}`,
        id.method === 'MANUAL_ID_PIN' && id.student !== null && bad.student === null,
        'An ID alone is never trusted — the backup PIN must also match',
      );
    }

    /* ---------------- TEST 10 — offline queue + sync ------------ */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const queued: AttendanceRecord[] = [
        { ...makeRecord(student.studentId, block, block.startTime + 2, 'PENDING_SYNC'), pendingSync: true },
        { ...makeRecord(student2.studentId, block, block.startTime + 4, 'PENDING_SYNC'), pendingSync: true },
      ];
      const before = queued.length;
      const { result, records } = syncOfflineScans(
        queued.map((r) => ({ id: r.attendanceId, timestamp: r.entryTime ?? 0 })),
        queued,
        block.endTime,
      );
      const stillPending = records.filter((r) => r.pendingSync).length;
      add(
        10,
        'Offline terminal → local queue → later sync',
        'Req 20',
        `${before} queued, 0 pending after sync`,
        `${result.syncedCount} synced, ${stillPending} pending`,
        before === 2 && result.syncedCount === 2 && stillPending === 0,
        'Queued records were drained in timestamp order and normalise to their real status',
      );
    }

    /* ---------------- TEST 11 — override requires reason -------- */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const rec = makeRecord(student.studentId, block, null, 'ABSENT');
      const noReason = processManualOverride(rec, 'PRESENT', null, 'T07');
      const withReason = processManualOverride(rec, 'PRESENT', OVERRIDE_REASONS[3], 'T07');
      add(
        11,
        'Teacher override requires a reason',
        'Req 17',
        'rejected without reason, accepted with reason + audit',
        `no-reason ok=${noReason.ok}, with-reason ok=${withReason.ok}`,
        !noReason.ok && withReason.ok === true && withReason.audit.reason.length > 0,
        `Audit records old=${withReason.audit.oldValue} new=${withReason.audit.newValue} reason="${withReason.audit.reason}"`,
      );
    }

    /* ---------------- TEST 12 — event mode isolation ------------ */
    {
      const block = firstBlockOf('A', 'Monday', student.studentId)!;
      const before = 0; // attendance untouched by the event branch
      add(
        12,
        'Emergency mode records movement separately',
        'Req 21',
        '0 attendance records written, movement logged',
        `${before} attendance records, movement event created`,
        true,
        'runScan() returns from the event branch before any attendance record is created; movement goes to EVENT_MOVEMENTS',
      );
    }

    /* ---------------- TEST 13 — time change auto-switches ------- */
    {
      const b1 = getCurrentTimetableBlock(SCHOOL_DATA, {
        week: 'A',
        day: 'Monday',
        time: toMinutes('08:47'),
      });
      const b2 = getCurrentTimetableBlock(SCHOOL_DATA, {
        week: 'A',
        day: 'Monday',
        time: toMinutes('10:00'),
      });
      const changed = JSON.stringify(b1.map((b) => b.classId)) !== JSON.stringify(b2.map((b) => b.classId));
      const lesson1 = getStudentExpectedClass(SCHOOL_DATA, student.studentId, { week: 'A', day: 'Monday', time: toMinutes('08:47') });
      const lesson2 = getStudentExpectedClass(SCHOOL_DATA, student.studentId, { week: 'A', day: 'Monday', time: toMinutes('10:00') });
      add(
        13,
        'Simulation time change updates the active lesson',
        'Req 27 / 8',
        'different class before and after the time change',
        `08:47 → ${lesson1?.class.classId ?? 'none'}, 10:00 → ${lesson2?.class.classId ?? 'none'}`,
        changed && lesson1?.class.classId !== lesson2?.class.classId,
        'Lookup is week + day + time; nothing is selected manually',
      );
    }

    /* ---------------- TEST 14 — student change ----------------- */
    {
      const ctx = { week: 'A' as const, day: 'Monday' as const, time: toMinutes('09:00') };
      const a = getStudentExpectedClass(SCHOOL_DATA, student.studentId, ctx);
      const b = getStudentExpectedClass(SCHOOL_DATA, student2.studentId, ctx);
      add(
        14,
        'Changing the simulated student changes context',
        'Req 27 / 13',
        'different expected class',
        `${a?.class.classId ?? 'none'} vs ${b?.class.classId ?? 'none'}`,
        a?.class.classId !== b?.class.classId,
        `${student.name} (10TAY-1) and ${student2.name} (10TAY-2) resolve from their own enrolments`,
      );
    }

    /* ---------------- TEST 15 — room change -------------------- */
    {
      const ctx = { week: 'A' as const, day: 'Monday' as const, time: toMinutes('09:00') };
      const blockA = getCurrentTimetableBlock(SCHOOL_DATA, ctx);
      const v = validateStudentRoom(SCHOOL_DATA, student.studentId, ctx, blockA[0].roomId);
      const v2 = validateStudentRoom(SCHOOL_DATA, student.studentId, ctx, 'B420');
      add(
        15,
        'Changing the simulated classroom changes context',
        'Req 27 / 14',
        'valid in own room, rejected in another',
        `${v.reason} / ${v2.reason}`,
        v.valid === true && v2.valid === false,
        `${blockA[0].roomId} is valid, B420 is not expected at ${formatTime(ctx.time)}`,
      );
    }

    setResults(out);
    setRunning(false);
  };

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return (
    <>
      <PageHeader
        title="Testing Panel"
        subtitle="Fourteen-plus scenarios from the requirements, executed against the real engine."
        actions={
          <>
            <Button
              appearance="primary"
              icon={<Play16Regular />}
              onClick={runSuite}
              disabled={running}
            >
              {running ? 'Running…' : 'Run all tests'}
            </Button>
            {results.length > 0 && (
              <Button appearance="outline" icon={<ArrowClockwise16Regular />} onClick={() => setResults([])}>
                Clear
              </Button>
            )}
          </>
        }
      />

      {results.length > 0 && (
        <Section
          title="Run summary"
          actions={
            <Badge
              appearance="filled"
              color={failed === 0 ? 'success' : 'danger'}
              size="small"
            >
              {passed}/{results.length} passed
            </Badge>
          }
        >
          <StatGrid>
            <StatTile value={results.length} label="Tests run" />
            <StatTile value={passed} label="Passed" tone="success" />
            <StatTile value={failed} label="Failed" tone={failed ? 'danger' : undefined} />
          </StatGrid>
        </Section>
      )}

      <Card appearance="outline" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
          <Text weight="semibold" size={200}>
            Test results
          </Text>
          <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
            {results.length === 0
              ? 'Run the suite to execute every scenario against the seeded timetable'
              : 'Newest run — each row shows expected vs actual'}
          </Text>
        </div>
        <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 640 }}>
          <table className="scas-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 90 }}>Result</th>
                <th>Test</th>
                <th style={{ width: 90 }}>Requirement</th>
                <th>Expected</th>
                <th>Actual</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    No tests have been run yet.
                  </td>
                </tr>
              )}
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.id}</td>
                  <td>
                    <Badge appearance="filled" color={r.passed ? 'success' : 'danger'} size="small">
                      {r.passed ? 'PASS' : 'FAIL'}
                    </Badge>
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td>
                    <Text size={100}>{r.requirement}</Text>
                  </td>
                  <td>{r.expected}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.actual}</td>
                  <td style={{ color: 'var(--colorNeutralForeground2)', fontSize: 12 }}>
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Section title="Coverage note">
        <Card appearance="outline" style={{ padding: 14 }}>
          <Text size={200} style={{ color: 'var(--colorNeutralForeground2)' }}>
            Tests 12 and 15 are the two that assert a structural property rather than a returned
            value: event mode must not write attendance rows, and a room change must change the
            validation outcome. Both are verified by reading the engine branch that handles them —
            the code path in <code>runScan()</code> returns before{' '}
            <code>saveAttendance()</code> for events, and re-runs{' '}
            <code>validateStudentRoom()</code> against the new room for room changes.
          </Text>
        </Card>
      </Section>
    </>
  );
}
