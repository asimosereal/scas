# SCAS — Student Classroom Attendance System

Interactive prototype of a classroom attendance system, built as an IGCSE Computer Science project.

The system simulates RFID-based classroom attendance against a two-week rotating Year 10 timetable,
with a full device simulator so every algorithm can be tested and demonstrated.

**Built with:** Next.js 15 · React 19 · TypeScript · Fluent UI React v9 (Fluent 2) · PostgreSQL / Neon

**Live preview:** http://localhost:3300

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | Strict TypeScript check |
| `npx tsx scripts/verify.ts` | Verify the seeded timetable and engine (22 checks) |

The prototype runs with **zero configuration** — the timetable, students and reference data are
seeded in code and the simulation persists to `localStorage`.

---

## The 30-second demo

1. Open <http://localhost:3000> — the simulation clock starts at **08:47, Week A, Monday**.
2. Go to **Device Simulator**. The *Engine prediction* panel already shows:
   Shu Min (KL3946) is expected in **B209 for Chemistry**, and the predicted result is
   **LATE by 7 minutes** (lesson started 08:40).
3. Press **Simulate RFID tap** → the record is created and marked LATE.
4. Tick **Duplicate scan**, tap again → blocked, no second record.
5. Change the time to **09:40** → the prediction, the teacher lesson and the Office context all
   change automatically. Nothing is selected by hand.
6. Open **Teacher** → the roster is generated from the students enrolled in that class only.
7. Open **Testing Panel** → **Run all tests** to execute all 15 scenarios against the real engine.

---

## Routes

| Route | Purpose |
|---|---|
| `/` | System dashboard — live roll-up, terminal health, recent scans |
| `/device` | Virtual SCAS terminal + the full simulation control bank |
| `/teacher` | Class-specific teacher dashboard with the expected roster |
| `/teacher/review` | End-of-day review, confirm / override, audit log |
| `/office` | System-wide office dashboard |
| `/office/timetable` | Central Year 10 timetable grid (room × time) |
| `/office/students` | Students, enrolments, derived individual timetables |
| `/office/events` | Emergency / event mode activation and movement log |
| `/office/terminals` | Terminal fleet, offline simulation, queue sync |
| `/data` | Raw attendance, scan events and audit records (CSV export) |
| `/tests` | 15-scenario test panel |

---

## Architecture at a glance

```
Presentation (Next.js + Fluent v9)
        │
Simulation store (sim-store.tsx)          ← the only React-aware file
        │
Attendance engine (src/lib/engine/)        ← pure functions, no React
        │
Seeded data (src/lib/data/) + db/schema.sql
```

The engine layer imports nothing from React. That is deliberate: requirement 32 says the website is
intentionally more complicated than the eventual IGCSE algorithm, so the business logic must be
liftable on its own. Every core function in the requirements is implemented as a small named
function — see section J of [TECHNICAL_SUMMARY.md](./TECHNICAL_SUMMARY.md) for the full list with
flowchart annotations.

---

## Core algorithm functions

| Function | File |
|---|---|
| `getCurrentTimetableBlock()` | `src/lib/engine/timetable-engine.ts` |
| `getStudentExpectedClass()` | `src/lib/engine/timetable-engine.ts` |
| `getExpectedStudents()` | `src/lib/engine/timetable-engine.ts` |
| `validateStudentRoom()` | `src/lib/engine/timetable-engine.ts` |
| `identifyStudent()` | `src/lib/engine/identity-engine.ts` |
| `verifyIdentity()` | `src/lib/engine/identity-engine.ts` |
| `calculateAttendanceStatus()` | `src/lib/engine/attendance-engine.ts` |
| `calculateLateMinutes()` | `src/lib/engine/attendance-engine.ts` |
| `checkDuplicateScan()` | `src/lib/engine/attendance-engine.ts` |
| `processAutoTransfer()` | `src/lib/engine/attendance-engine.ts` |
| `processBreak()` | `src/lib/engine/attendance-engine.ts` |
| `markAbsentStudents()` | `src/lib/engine/attendance-engine.ts` |
| `processManualOverride()` | `src/lib/engine/attendance-engine.ts` |
| `syncOfflineScans()` | `src/lib/engine/attendance-engine.ts` |

---

## Timetable data — the real 10TAY timetable

The timetable now loaded is the **real Year 10 (10TAY) two-week rotation** from Taylor's
International Kuala Lumpur, transcribed cell-by-cell from:

1. `10TAY.PDF` — the central class grid (Week 1 / Week 2), including every parallel option group
2. Shu Min's (KL3946) individual timetable, supplied with the brief
3. `CHEN-ZiChun_(10).pdf` — Zichun Chen's (KL5195) iSAMS individual timetable

- Homeroom 08:20–08:35; Monday–Thursday have six periods (08:40–09:35, 09:40–10:35, 10:40–11:40,
  12:30–13:25, 13:30–14:25, 14:30–15:30); **Friday has four shorter periods** (08:40–09:25,
  09:30–10:20, 10:25–11:10, 12:00–12:50)
- 333 timetable blocks, 73 teaching sets, real teachers and real rooms (B209 Chemistry, B315
  Mandarin, B323 Computer Science, B420/B421 English, B308 Maths, Badminton Hall PE …)
- Shu Min's 54 timetable cells and Zichun's iSAMS print are verified cell-by-cell by
  `npm run verify`
- A 24-student synthetic cohort rides on the two students' real set choices so class rolls are
  realistic; no synthetic student is ever double-booked

**One documented source discrepancy (kept, not silently changed):** for Week B Friday P3
(10:25–11:10) room B308, Shu Min's print says *Additional Math* while Zichun's iSAMS print and the
central grid say *Maths* (same teacher, Ms Sheela Sanjivee). Both records are kept as printed —
AM-3 and MATH-9 — and `validateTimetable()` whitelists this single key. See section B of the
technical summary.

---

## Database

`db/schema.sql` contains the full PostgreSQL DDL for a Neon deployment: `students`, `teachers`,
`subjects`, `rooms`, `classes`, `student_enrolments`, `timetable_blocks`, `attendance`,
`scan_events`, `terminals`, `events`, `event_movements`, `audit_log` — with foreign keys, check
constraints and indexes on the lookup paths.

The running prototype uses the in-memory seeded snapshot rather than a live connection (no Neon
credentials were available). The types in `src/lib/types.ts` map 1:1 to these tables, so wiring a
live database is a data-access-layer change, not an engine change.

---

## Privacy note

Face verification is simulated with a configurable confidence value. **No camera photograph is ever
stored.** The system retains only an abstract template reference (`face_template_id`) and the
confidence score, per the brief's privacy requirement. RFID is the primary identification method;
face verification is strictly secondary and a low-confidence result routes to teacher review rather
than being accepted.

---

## Documentation

**[TECHNICAL_SUMMARY.md](./TECHNICAL_SUMMARY.md)** — architecture, schema, algorithms, lookup logic,
simulation architecture, teacher and office workflows, test scenarios, known limitations, and the
full list of core functions for the flowchart/pseudocode stage.
