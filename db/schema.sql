-- ==================================================================
-- SCAS — Student Classroom Attendance System
-- PostgreSQL schema (Neon)
--
-- The application runs in "seeded in-memory" mode by default so the
-- prototype works with zero configuration. This file is the canonical
-- relational schema for a Neon deployment.
--
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql
-- Seed with:   psql "$DATABASE_URL" -f db/seed.sql
-- ==================================================================

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS event_movements CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS terminals CASCADE;
DROP TABLE IF EXISTS scan_events CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS timetable_blocks CASCADE;
DROP TABLE IF EXISTS student_enrolments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- ------------------------------------------------------------------
-- Reference tables
-- ------------------------------------------------------------------

CREATE TABLE students (
  student_id      TEXT PRIMARY KEY,
  student_number  TEXT NOT NULL UNIQUE,   -- ID printed on the RFID card
  name            TEXT NOT NULL,
  year_group      TEXT NOT NULL,
  teaching_group  TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  -- Biometric representation only (template/embedding surrogate).
  -- Per requirement 16, camera photographs are NEVER stored.
  face_template_id TEXT NOT NULL,
  backup_pin      TEXT NOT NULL
);

CREATE TABLE teachers (
  teacher_id  TEXT PRIMARY KEY,
  name        TEXT NOT NULL
);

CREATE TABLE subjects (
  subject_id    TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  abbreviation  TEXT NOT NULL
);

CREATE TABLE rooms (
  room_id    TEXT PRIMARY KEY,
  room_name  TEXT NOT NULL
);

-- A class = a subject taught by a teacher to a teaching group.
CREATE TABLE classes (
  class_id    TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(subject_id),
  teacher_id  TEXT NOT NULL REFERENCES teachers(teacher_id),
  "group"     TEXT NOT NULL
);

-- Which class a student takes in a given week.
CREATE TABLE student_enrolments (
  student_id  TEXT NOT NULL REFERENCES students(student_id),
  class_id    TEXT NOT NULL REFERENCES classes(class_id),
  week        CHAR(1) NOT NULL CHECK (week IN ('A','B')),
  PRIMARY KEY (student_id, class_id, week)
);

-- One occurrence of a class at one time in one room.
CREATE TABLE timetable_blocks (
  block_id    TEXT PRIMARY KEY,
  week        CHAR(1) NOT NULL CHECK (week IN ('A','B')),
  day         TEXT NOT NULL,
  start_time  INTEGER NOT NULL,   -- minutes since midnight
  end_time    INTEGER NOT NULL,
  class_id    TEXT NOT NULL REFERENCES classes(class_id),
  room_id     TEXT NOT NULL REFERENCES rooms(room_id)
);

CREATE INDEX idx_blocks_lookup ON timetable_blocks (week, day, start_time, end_time);
CREATE INDEX idx_blocks_room   ON timetable_blocks (room_id, week, day);

-- ------------------------------------------------------------------
-- Runtime tables
-- ------------------------------------------------------------------

CREATE TABLE terminals (
  terminal_id   TEXT PRIMARY KEY,
  room_id       TEXT NOT NULL REFERENCES rooms(room_id),
  label         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ONLINE'
                  CHECK (status IN ('ONLINE','OFFLINE','SYNCING')),
  mode          TEXT NOT NULL DEFAULT 'NORMAL'
                  CHECK (mode IN ('NORMAL','EVENT')),
  event_id      TEXT,
  queued_scans  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attendance (
  attendance_id          TEXT PRIMARY KEY,
  student_id             TEXT NOT NULL REFERENCES students(student_id),
  class_id               TEXT NOT NULL REFERENCES classes(class_id),
  room_id                TEXT NOT NULL REFERENCES rooms(room_id),
  block_id               TEXT NOT NULL REFERENCES timetable_blocks(block_id),
  week                   CHAR(1) NOT NULL,
  day                    TEXT NOT NULL,
  entry_time             INTEGER,
  exit_time              INTEGER,
  status                 TEXT NOT NULL
                           CHECK (status IN ('PRESENT','LATE','ABSENT','REVIEW','PENDING_SYNC')),
  late_minutes           INTEGER NOT NULL DEFAULT 0,
  verification_method    TEXT NOT NULL,
  verification_confidence NUMERIC(5,2),
  review_status          TEXT NOT NULL DEFAULT 'NONE'
                           CHECK (review_status IN ('NONE','PENDING','CONFIRMED','OVERRIDDEN')),
  override_reason        TEXT,
  break_minutes          INTEGER NOT NULL DEFAULT 0,
  pending_sync           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_att_student ON attendance (student_id, week, day);
CREATE INDEX idx_att_class   ON attendance (class_id, week, day, block_id);

CREATE TABLE scan_events (
  scan_id        TEXT PRIMARY KEY,
  terminal_id    TEXT NOT NULL REFERENCES terminals(terminal_id),
  student_id     TEXT,
  -- simulation time, NOT wall-clock time (requirement 13)
  week           CHAR(1) NOT NULL,
  day            TEXT NOT NULL,
  timestamp      INTEGER NOT NULL,
  result         TEXT NOT NULL,
  verification_confidence NUMERIC(5,2),
  message        TEXT,
  synced         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_scans_terminal ON scan_events (terminal_id, timestamp);

CREATE TABLE events (
  event_id    TEXT PRIMARY KEY,
  event_name  TEXT NOT NULL,
  event_type  TEXT NOT NULL
                CHECK (event_type IN ('FIRE_EVACUATION','EMERGENCY_LEAVE','MASS_MOVEMENT')),
  created_by  TEXT NOT NULL,
  week        CHAR(1) NOT NULL,
  day         TEXT NOT NULL,
  start_time  INTEGER NOT NULL,
  end_time    INTEGER,
  active      BOOLEAN NOT NULL DEFAULT FALSE,
  terminal_ids TEXT[] NOT NULL DEFAULT '{}'
);

-- Emergency movement is recorded SEPARATELY so ordinary attendance
-- records are never corrupted (requirement 21).
CREATE TABLE event_movements (
  movement_id    TEXT PRIMARY KEY,
  event_id       TEXT NOT NULL REFERENCES events(event_id),
  student_id     TEXT NOT NULL REFERENCES students(student_id),
  terminal_id    TEXT NOT NULL REFERENCES terminals(terminal_id),
  timestamp      INTEGER NOT NULL,
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('ENTER','EXIT','MOVE'))
);

CREATE TABLE audit_log (
  audit_id    TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  user_role   TEXT NOT NULL,
  action      TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  reason      TEXT,
  week        CHAR(1) NOT NULL,
  day         TEXT NOT NULL,
  timestamp   INTEGER NOT NULL
);

CREATE INDEX idx_audit_record ON audit_log (record_id);
