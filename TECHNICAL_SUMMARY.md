# SCAS — Technical Summary

**Student Classroom Attendance System**
IGCSE Computer Science project prototype

---

## A. Application Architecture

### Layering

The system is deliberately layered so that the business logic can be extracted for flowcharts and
pseudocode without touching any UI code.

```
┌──────────────────────────────────────────────────────────┐
│  PRESENTATION  (Next.js App Router + Fluent UI React v9)  │
│  /  /device  /teacher  /teacher/review  /office/*  /data  │
└───────────────────────────┬──────────────────────────────┘
                            │  reads state, dispatches intents
┌───────────────────────────▼──────────────────────────────┐
│  SIMULATION STORE  (src/lib/store/sim-store.tsx)         │
│  clock · simulator inputs · runtime records · scan pipeline│
└───────────────────────────┬──────────────────────────────┘
                            │  calls pure functions only
┌───────────────────────────▼──────────────────────────────┐
│  ATTENDANCE ENGINE  (src/lib/engine/)                     │
│  timetable-engine · identity-engine · attendance-engine    │
│  Pure functions, no React, no I/O — pseudocode ready.     │
└───────────────────────────┬──────────────────────────────┘
                            │  reads
┌───────────────────────────▼──────────────────────────────┐
│  DATA  (src/lib/data/  +  db/schema.sql)                  │
│  reference · timetable · students  →  SchoolData snapshot │
└──────────────────────────────────────────────────────────┘
```

### Technology decisions

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15.5 App Router + React 19 | SSR + client components in one app; deploys to Vercel |
| Language | TypeScript (strict) | The engine functions are typed, so the pseudocode extraction is type-checked |
| UI | `@fluentui/react-components` v9 | Official Fluent 2 web implementation — not a lookalike |
| Theme | `createLightTheme` / `createDarkTheme` over a Fluent brand ramp | Colours, radii, spacing all come from Fluent tokens |
| Fonts | Segoe UI Variable → Segoe UI → system-ui | Fluent 2 system font; correct on Windows 11 without a webfont download |
| State | React context + reducer | No extra dependency; keeps the engine framework-agnostic |
| Persistence | `localStorage` (dev) / PostgreSQL (prod) | Prototype runs with zero configuration; schema is ready for Neon |
| Styling | Fluent tokens via CSS variables + a small stylesheet | No Tailwind, no custom design system — Fluent is the design system |

### Why the engine is separate from the store

`sim-store.tsx` is the only file that knows about React. The engine files import nothing from React.
This is what makes requirement 32 practical: the flowchart author reads `attendance-engine.ts` and
sees `calculateAttendanceStatus(scanTime, lessonStart)`, not a React component.

---

## B. Database Schema

Full DDL: [`db/schema.sql`](./db/schema.sql)

| Table | Purpose | Key columns |
|---|---|---|
| `students` | Student register | `student_id`, `student_number`, `name`, `year_group`, `teaching_group`, `face_template_id`, `backup_pin` |
| `teachers` | Staff | `teacher_id`, `name` |
| `subjects` | Subject catalogue | `subject_id`, `name`, `abbreviation` |
| `rooms` | Physical rooms | `room_id`, `room_name` |
| `classes` | A subject taught by a teacher to a group | `class_id`, `subject_id`, `teacher_id`, `group` |
| `student_enrolments` | Which class a student takes in a week | `student_id`, `class_id`, `week` |
| `timetable_blocks` | One occurrence of a class at a time in a room | `block_id`, `week`, `day`, `start_time`, `end_time`, `class_id`, `room_id` |
| `attendance` | One student's attendance for one lesson | `student_id`, `class_id`, `room_id`, `block_id`, `entry_time`, `exit_time`, `status`, `late_minutes`, `verification_method`, `verification_confidence`, `review_status`, `override_reason`, `break_minutes`, `pending_sync` |
| `scan_events` | Every tap processed by a terminal | `terminal_id`, `student_id`, `timestamp`, `result`, `verification_confidence`, `synced` |
| `terminals` | Classroom devices | `terminal_id`, `room_id`, `status`, `mode`, `event_id`, `queued_scans` |
| `events` | Emergency / mass movement | `event_name`, `event_type`, `start_time`, `end_time`, `active`, `terminal_ids[]` |
| `event_movements` | Movement during an event — **separate from attendance** | `event_id`, `student_id`, `terminal_id`, `timestamp`, `movement_type` |
| `audit_log` | Every manual change | `user_id`, `action`, `record_id`, `old_value`, `new_value`, `reason`, `timestamp` |

### Design notes

- **Times are integers** (minutes since midnight), not `TIME` columns. This makes the attendance
  comparison a plain integer subtraction and removes every timezone edge case.
- **Week is `CHAR(1)`** with a `CHECK (week IN ('A','B'))` constraint, matching the two-week rotation.
- **`pending_sync`** on `attendance` is the offline queue marker. A queued row is fully visible in the
  teacher review and audit views — nothing is hidden while offline.
- **`event_movements` is a separate table** so an evacuation can never corrupt lesson attendance
  (requirement 21).
- **Face data is an abstract template reference.** No camera photograph is ever persisted
  (requirement 16).
- **The central timetable is never merged with student timetables.** `timetable_blocks` holds the
  school-wide grid; `student_enrolments` + `timetable_blocks` derive the individual timetable at
  query time.

### Seed data provenance — the real 10TAY timetable

The dataset is now transcribed from the supplied sources:

1. **`10TAY.PDF`** — the central Year 10 class grid. Every cell (subject, room, teacher) is
   reproduced; rows without a homeroom cell are parallel option groups. When a grid cell maps to a
   teaching set that already meets that day, the cell is routed to a **sibling set** of the same
   subject + teacher (e.g. `CHE-3`), which is how the grid's parallel bands are represented in a
   class-level enrolment model.
2. **Shu Min (KL3946)** — individual timetable supplied with the brief. Authoritative; all 54
   cells verified by `npm run verify`.
3. **`CHEN-ZiChun_(10).pdf`** — Zichun Chen (KL5195) iSAMS print. Authoritative; spot-verified.

Structural rules all hold: real start/end times (never "Period 1/2/3"), Friday periods shorter
than Monday–Thursday, several classes in parallel, one teacher per set, and no room/teacher
double-booking — enforced by `validateTimetable()` at load time.

**Documented source discrepancy (requirement 33.5 — kept, not silently changed):** Week B Friday
P3 (10:25–11:10), room B308, Ms Sheela Sanjivee. Shu Min's print says *Additional Math*; Zichun's
iSAMS print and the central grid say *Maths*. Both records exist as printed (`AM-3` and `MATH-9`);
the single key `B|Friday|625` is whitelisted in `DOCUMENTED_CLASHES`.

**iSAMS vs grid times:** iSAMS prints periods as 08:40–09:40 etc.; the 10TAY grid prints
08:40–09:35 etc. The grid times (matching the brief) are used throughout.

---

## C. Core Attendance Algorithms

Source: [`src/lib/engine/attendance-engine.ts`](./src/lib/engine/attendance-engine.ts)

### PRESENT / LATE

```
FUNCTION calculateAttendanceStatus(scanTime, lessonStart)
    IF scanTime <= lessonStart
        RETURN PRESENT
    ELSE
        RETURN LATE
    ENDIF
ENDFUNCTION

FUNCTION calculateLateMinutes(scanTime, lessonStart)
    RETURN MAX(0, scanTime - lessonStart)
ENDFUNCTION
```

### DUPLICATE SCAN

```
FUNCTION checkDuplicateScan(records, studentId, blockId)
    FOR EACH record IN records
        IF record.studentId = studentId AND record.blockId = blockId
            RETURN record            // duplicate — do not create
        ENDIF
    ENDFOR
    RETURN NONE                        // safe to create
ENDFUNCTION
```

The "attendance context" is `(studentId, blockId)` — one student in one lesson. A second tap in the
same lesson is acknowledged to the terminal and logged as `DUPLICATE_IGNORED`, but no second record
is written.

### AUTO-TRANSFER

```
FUNCTION processAutoTransfer(records, studentId, newRoomId, now)
    totalTransferMinutes = 0
    FOR EACH record IN records WHERE record.studentId = studentId
                                       AND record.exitTime = NONE
                                       AND record.roomId ≠ newRoomId
        minutesInRoom = now - record.entryTime
        record.exitTime = now                 // close previous lesson
        totalTransferMinutes = totalTransferMinutes + minutesInRoom
    ENDFOR
    RETURN totalTransferMinutes
ENDFUNCTION
```

Students moving between classrooms do **not** tap out. Scanning into the next expected classroom
closes the previous session automatically.

### BREAK

```
FUNCTION processBreak(state, now)
    IF state.onBreak = FALSE
        state.onBreak = TRUE
        state.breakStartedAt = now
        RETURN BREAK_START
    ELSE
        minutes = now - state.breakStartedAt
        state.onBreak = FALSE
        state.accumulatedMinutes = state.accumulatedMinutes + minutes
        RETURN BREAK_END
    ENDIF
ENDFUNCTION
```

Break time is **accumulated onto** the attendance record; it does not close the lesson.

### ABSENT FINALISATION

```
FUNCTION markAbsentStudents(expectedStudentIds, existingRecords, block)
    FOR EACH studentId IN expectedStudentIds
        IF studentId HAS NO record in existingRecords
            CREATE attendance(status = ABSENT, entryTime = NONE, exitTime = block.endTime)
        ENDIF
    ENDFOR
ENDFUNCTION
```

Triggered when `hasFinished(block, now)` is true, i.e. `now >= block.endTime`. Runs on every scan
against every block that has already ended on the simulated day, so absence accrues progressively.

### MANUAL OVERRIDE

```
FUNCTION processManualOverride(record, newStatus, reason, teacherId)
    IF reason IS EMPTY
        RETURN REJECTED "A REASON IS REQUIRED FOR EVERY OVERRIDE"
    ENDIF
    IF newStatus = record.status
        RETURN REJECTED "THE SELECTED STATUS MATCHES THE EXISTING STATUS"
    ENDIF

    WRITE audit_log(userId = teacherId, action = ATTENDANCE_OVERRIDE,
                    oldValue = record.status, newValue = newStatus, reason = reason,
                    timestamp = now)
    record.status = newStatus
    record.reviewStatus = OVERRIDDEN
    record.overrideReason = reason
    record.verificationMethod = TEACHER_OVERRIDE
    RETURN record
ENDFUNCTION
```

There is **no silent modification path**. The UI enforces the reason; the engine enforces it again.

### OFFLINE SYNCHRONISATION

```
FUNCTION syncOfflineScans(queuedScans, records, now)
    sortedQueue = SORT queuedScans BY timestamp ASCENDING
    FOR EACH record IN records WHERE record.pendingSync = TRUE
                                     AND record.id IN sortedQueue
        record.pendingSync = FALSE
        record.status = NORMALISE(record.status)   // PENDING_SYNC → real status
    ENDFOR
    RETURN syncedCount
ENDFUNCTION
```

---

## D. Timetable Lookup Logic

Source: [`src/lib/engine/timetable-engine.ts`](./src/lib/engine/timetable-engine.ts)

### The three information sources are kept separate

| Source | What it is | Where it lives |
|---|---|---|
| **A. Central timetable** | Every class happening in Year 10 at a given time | `timetable_blocks` |
| **B. Individual timetable** | What *this* student must attend | **Derived** — `timetable_blocks` ∩ `student_enrolments` |
| **C. Simulation state** | The scenario under test | `sim-store` (never written to A or B) |

### Primary lookup

```
FUNCTION getCurrentTimetableBlock(week, day, currentTime)
    RETURN all blocks WHERE
        block.week = week
        AND block.day = day
        AND currentTime >= block.startTime
        AND currentTime < block.endTime
ENDFUNCTION
```

Returns **an array**, because several classes run in parallel. This is the key distinction from a
single-student schedule.

### Student's expected class

```
FUNCTION getStudentExpectedClass(studentId, week, day, currentTime)
    enrolledClassIds = enrolments WHERE studentId AND week
    lessons = timetable_blocks WHERE block.week = week
                                      AND block.day = day
                                      AND block.classId IN enrolledClassIds
    RETURN the lesson WHERE currentTime is within [startTime, endTime)
ENDFUNCTION
```

Returns `null` for a free period — the system never assumes a student attends every class.

### Room validation

```
FUNCTION validateStudentRoom(studentId, week, day, currentTime, roomId)
    expectedLesson = getStudentExpectedClass(...)
    roomBlock     = getCurrentTimetableBlock(...) filtered to roomId

    IF studentId NOT FOUND          → INVALID, "STUDENT ID NOT RECOGNISED"
    IF expectedLesson IS NONE       → INVALID, "NO EXPECTED LESSON AT THIS TIME"
    IF expectedLesson.roomId = roomId → VALID
    IF roomBlock IS NONE            → INVALID, "NO LESSON SCHEDULED IN THIS ROOM"
    ELSE                            → INVALID, "STUDENT NOT EXPECTED IN THIS ROOM"
ENDFUNCTION
```

### Why real times, not period numbers

The grid is defined by `DAY_PATTERNS`: Monday–Thursday have five 55-minute blocks starting at
08:40, Friday has four 45-minute blocks. The engine compares `startTime`/`endTime` integers, so the
different day shapes need no special-casing anywhere. There is no `"Period 1"` anywhere in the
codebase.

---

## E. Simulation Architecture

### Independence from the computer clock

Every timestamp in the system is `state.time` — an integer of simulated minutes. `new Date()` is
never used for business logic. The device panel shows:

- the **real** computer time (for contrast)
- the **simulation** time (used by the engine)

### Controls

| Control | Effect |
|---|---|
| Week A / B | Changes the central timetable rotation |
| Day Mon–Fri | Changes the day (Friday has different block lengths) |
| Date | Free-text simulation date |
| Time | Manual entry, `+1 min`, `−1 min`, Reset, Run/Pause (1 min per second) |

### Scenario flags

Each flag drives one branch of `runScan()`:

| Flag | Engine branch exercised |
|---|---|
| Duplicate scan | `checkDuplicateScan()` |
| Wrong face | `identifyStudent()` → confidence 52 → review |
| Forgotten card | `identifyStudent()` → ID + backup PIN path |
| Camera failure | `identifyStudent()` → RFID-only, manual verification |
| Network failure | `pendingSync = true`, terminal queue increments |
| Not expected in room | `validateStudentRoom()` → `DIFFERENT_CLASS` + audit entry |
| Emergency mode | event branch returns before `saveAttendance()` |

### Automatic propagation (requirement 27)

The store derives, via `useMemo` on `[week, day, time]`:

1. `activeBlocks` — classes running now
2. `roomBlock` — lesson in the simulator's room
3. `teacherBlock` — the selected teacher's current lesson
4. `expectedLesson` — the selected student's expected lesson
5. `validation` — is that student allowed in that room

Every screen reads these, so moving the clock updates the teacher dashboard, the expected roster,
the simulator prediction panel and the Office context in one render pass.

---

## F. Teacher Workflow

1. Sign in as **Teacher** (the picker lists only staff actually timetabled in Year 10 — requirement 6).
2. The dashboard finds the teacher's block from **teacher + week + day + time + room**.
3. The roster is generated by `getExpectedStudents(classId, week)` — never the whole year group.
4. The **Engine prediction** panel in the simulator shows the outcome *before* a tap.
5. Records needing attention surface in **End-of-Day Review**:
   - `REVIEW` / `PENDING` → **Confirm** or **Override**
   - `ABSENT` → **Override** to PRESENT with a reason
6. Every override writes an audit entry with the old value, new value, reason, teacher and
   simulation timestamp.

---

## G. Office Workflow

1. **Office Dashboard** — live roll-up across every running class, terminal fleet health, day schedule.
2. **Central Timetable** — room × time grid, Week A/B tabs, day picker, group filter. Click any cell
   for subject, room, teacher, group, time and the live attendance snapshot.
3. **Students** — directory, then the **derived** individual timetable, enrolments and class rosters.
4. **Terminals** — fleet status; take terminals offline, restore them, synchronise queued scans.
5. **Events** — create an event, select terminals, activate. Movement is logged to a separate table.
6. **Attendance & Audit** — every record, scan event and audit entry; CSV export.

---

## H. Test Scenarios

Source: [`src/app/tests/page.tsx`](./src/app/tests/page.tsx) — all tests execute the **real** engine
against the **real** seeded timetable, in isolation from the simulation store.

| # | Test | Requirement | Assertion |
|---|---|---|---|
| 1 | Arrives before class | 15.1 | `PRESENT` |
| 2 | Arrives after start | 15.2 | `LATE` with correct duration |
| 3 | Never scans | 15.3 | every expected student marked ABSENT at lesson end |
| 4 | Duplicate RFID | 15.4 | duplicate detected, no second record |
| 5 | Scans into next classroom | 15.5 | previous lesson closed, minutes in room correct |
| 6 | Wrong room | 14 / 15 | rejected, `DIFFERENT_CLASS` |
| 7 | Low face confidence (52%) | 16 | `requiresReview = true` |
| 8 | High face confidence (96%) | 16 | auto-verified |
| 9 | Forgotten card | 19 | valid ID+PIN accepted, wrong PIN rejected |
| 10 | Offline terminal | 20 | 2 queued → 2 synced, 0 pending |
| 11 | Override without reason | 17 | rejected; with reason → accepted + audit |
| 12 | Emergency mode | 21 | no attendance row written, movement logged |
| 13 | Simulation time change | 27 / 8 | active lesson changes automatically |
| 14 | Student change | 27 / 13 | expected class changes |
| 15 | Room change | 27 / 14 | valid in own room, rejected elsewhere |

---

## I. Known Limitations

| Limitation | Detail |
|---|---|
| **No live database connection** | The prototype runs on the seeded in-memory `SchoolData` snapshot, persisted to `localStorage`. The full PostgreSQL schema is provided in `db/schema.sql` and the data model maps to it 1:1, but no Neon credentials were available to wire up a live connection. Switching to Neon is a data-access-layer change, not an engine change. |
| **One timetable slot is disputed in the sources** | Week B Friday P3, room B308: Shu Min's print says Additional Math, Zichun's iSAMS print and the grid say Maths. Both are kept (AM-3 / MATH-9) and the slot is whitelisted in `DOCUMENTED_CLASHES`. |
| **Face verification is simulated** | A configurable confidence value replaces real biometric matching, as the brief permits. Only a template reference and confidence are stored — never an image. No client-side ML model is bundled. |
| **Single-node state** | The simulation store is in-browser. Two browsers would not see each other's scans. A real deployment needs server-side state (the schema supports it). |
| **No authentication** | The role selector is a demo switch, per requirement 23. |
| **Timetable editor is read-only in the UI** | The schema and data layer support editing; the admin editing UI is out of scope for this pass. The brief ranked it as a supporting feature behind the attendance engine. |
| **Break state is per-student but not surfaced in the terminal UI** | `processBreak()` is implemented and `break_minutes` is stored and displayed in the review table; the tap-to-toggle control is not on the terminal face. |
| **Auto-transfer is evaluated per scan** | A transfer is only detected when the student scans into the next room. There is no background sweep closing stale sessions. |

---

## J. Functions Representing the Core Attendance Logic

> **This is the section for the flowchart and pseudocode stage.** Each function maps to one or more
> flowchart elements. Source locations are given so the pseudocode author can read the reference
> implementation.

### J.1 Timetable lookup — `src/lib/engine/timetable-engine.ts`

| Function | Flowchart element | Description |
|---|---|---|
| `getCurrentTimetableBlock(data, {week, day, time})` | **Input / Process** | Find all classes running at the simulation time. Central timetable lookup. |
| `getBlocksForDay(data, week, day)` | **Process** | All blocks on one day, sorted. Feeds the Office grid. |
| `getBlockForRoom(data, ctx, roomId)` | **Decision** | The single block running in a room, or none. |
| `getStudentExpectedClass(data, studentId, ctx)` | **Process** | The lesson *this student* must attend right now. |
| `getStudentTimetable(data, studentId, week, day)` | **Process** | The full derived individual timetable for a day. |
| `getExpectedStudents(data, classId, week)` | **Process** | Who is required in this class. Feeds the teacher roster. |
| `validateStudentRoom(data, studentId, ctx, roomId)` | **Decision (5 outcomes)** | Is the student supposed to be in this room? |
| `getTeacherClasses(data, teacherId)` | **Input constraint** | Which classes a teacher may select. |
| `getCurrentTeacherBlock(data, teacherId, ctx, roomId?)` | **Process** | What the teacher is teaching right now. |

### J.2 Identity verification — `src/lib/engine/identity-engine.ts`

| Function | Flowchart element | Description |
|---|---|---|
| `identifyStudent(data, ctx)` | **Process + 2 Decisions** | The full RFID → face → verdict chain. |
| `verifyIdentity(confidence)` | **Decision diamond** | `confidence >= 75 ? VERIFIED : REVIEW_REQUIRED` |

`FACE_VERIFY_THRESHOLD = 75`, `FACE_CAMERA_FAILURE_THRESHOLD = 20`.

### J.3 Attendance processing — `src/lib/engine/attendance-engine.ts`

| Function | Flowchart element | Description |
|---|---|---|
| `calculateAttendanceStatus(scanTime, lessonStart)` | **Decision diamond** | `scanTime <= lessonStart ? PRESENT : LATE` |
| `calculateLateMinutes(scanTime, lessonStart)` | **Process** | `MAX(0, scanTime - lessonStart)` |
| `checkDuplicateScan(records, studentId, blockId)` | **Decision** | Has this student already been recorded for this lesson? |
| `processAutoTransfer(records, studentId, newRoomId, now)` | **Process (loop)** | Close every open session in a different room. |
| `processBreak(state, now)` | **Process** | Start or end an authorised break, accumulate duration. |
| `hasFinished(block, now)` | **Decision diamond** | `now >= block.endTime` — trigger for absence. |
| `markAbsentStudents(expectedIds, existing, block)` | **Process (loop)** | Create ABSENT records for students with no record. |
| `processManualOverride(record, newStatus, reason, teacherId)` | **2 Decisions + audit write** | Reason mandatory; no silent changes. |
| `syncOfflineScans(queued, records, now)` | **Process (loop)** | Drain the local queue in timestamp order. |
| `summariseLesson(expectedIds, records)` | **Aggregation** | Present / Late / Absent / Review counters. |

### J.4 Orchestration — `src/lib/store/sim-store.tsx` → `runScan()`

The end-to-end scan pipeline, in order. This is the **subprocess flowchart**:

```
1.  READ CARD                    (RFID primary)
2.  IF NO CARD → manual ID + PIN
3.  RESOLVE STUDENT             or reject with INVALID_CARD
4.  IF terminal.mode = EVENT → log movement, RETURN     ← attendance untouched
5.  VALIDATE ROOM               → reject + audit entry if not expected
6.  CHECK DUPLICATE             → acknowledge, no new record
7.  CALCULATE STATUS            (PRESENT / LATE / REVIEW)
8.  CALCULATE LATE MINUTES
9.  BUILD ATTENDANCE RECORD
10. AUTO-TRANSFER               close previous open session
11. FINALISE ENDED LESSONS      mark remaining students ABSENT
12. APPLY OFFLINE FLAG          pendingSync if terminal is offline
13. WRITE SCAN EVENT + RECORD
```

---

## Running the project

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

### Suggested demo path

1. Dashboard — note the simulation clock at 08:47, Week A, Monday.
2. Device Simulator — check **Engine prediction** shows `LATE`, 7 min.
3. Press **Simulate RFID tap** → Shu Min (KL3946) is recorded LATE in B209.
4. Change time to 09:40 → the prediction and teacher lesson change automatically.
5. Teacher → Teacher — pick Ms Nurul Aisyah (Chemistry). The roster is 10A only.
6. Device Simulator → tick **Duplicate scan** → tap again → blocked, no new record.
7. Tick **Student not expected in room** → tap → rejected, audit entry written.
8. Teacher → End-of-Day Review → **Override** an absence; try to submit with a reason cleared.
9. Office → Central Timetable — click a cell to inspect it.
10. Office → Students — open Shu Min's derived individual timetable.
11. Office → Events — activate an event on four terminals, then tap in the simulator.
12. Office → Terminals — take one offline, tap, then synchronise the queue.
13. Testing Panel → **Run all tests** — 15/15 expected.
