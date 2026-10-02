/**
 * SCAS DOMAIN TYPES
 * ------------------------------------------------------------------
 * These types map 1:1 to the database tables documented in the
 * requirements (section 22). They are the single source of truth for
 * the shape of data flowing through the attendance engine.
 *
 * Every type is intentionally flat and simple so that later
 * pseudocode conversion (requirement 28/34J) stays traceable.
 */

/** A two-week rotating timetable. Week A / Week B. */
export type Week = 'A' | 'B';

export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** Minutes since midnight. Used instead of Date objects so that
 *  simulation time is fully deterministic and comparable. */
export type Minutes = number;

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export interface Subject {
  subjectId: string;
  name: string;
  abbreviation: string;
}

export interface Room {
  roomId: string;
  roomName: string;
}

export interface Teacher {
  teacherId: string;
  name: string;
}

/**
 * A CLASS is a teaching group: a subject taught by a teacher to a
 * set of students. It is NOT a time slot — the time slot lives in
 * TimetableBlock.
 */
export interface Class {
  classId: string;
  subjectId: string;
  teacherId: string;
  /** e.g. "10A", "10B" — the teaching group within the year group */
  group: string;
}

export interface Student {
  studentId: string;
  /** The card / ID number printed on the RFID card, e.g. KL3946 */
  studentNumber: string;
  name: string;
  yearGroup: string;
  active: boolean;
  /**
   * Simulated biometric representation. IMPORTANT: this is an
   * abstract representation (a template/embedding surrogate), NOT a
   * photograph. No camera image is ever stored (requirement 16).
   */
  faceTemplateId: string;
  /** 4-digit backup PIN used in the Forgotten Card process (req 19) */
  backupPin: string;
}

export interface StudentEnrolment {
  studentId: string;
  classId: string;
  week: Week;
}

/**
 * A TIMETABLE BLOCK is one occurrence of a class at one time, in one
 * room. The central Year 10 timetable is the collection of ALL blocks.
 * Look-up is by week + day + current time (+ optional room filter).
 */
export interface TimetableBlock {
  blockId: string;
  week: Week;
  day: Day;
  startTime: Minutes;
  endTime: Minutes;
  classId: string;
  roomId: string;
}

/** An individual student's derived lesson for one block. */
export interface StudentLesson {
  block: TimetableBlock;
  class: Class;
  subject: Subject;
  room: Room;
  teacher: Teacher;
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'REVIEW'
  | 'PENDING_SYNC';

export type VerificationMethod =
  | 'RFID'
  | 'RFID_FACE'
  | 'MANUAL_ID_PIN'
  | 'BREAK_RETURN'
  | 'TEACHER_OVERRIDE';

export type ReviewStatus = 'NONE' | 'PENDING' | 'CONFIRMED' | 'OVERRIDDEN';

export interface AttendanceRecord {
  attendanceId: string;
  studentId: string;
  classId: string;
  roomId: string;
  blockId: string;
  week: Week;
  day: Day;
  /** entry = first accepted scan into the lesson */
  entryTime: Minutes | null;
  /** exit = set by auto-transfer, break end, or lesson finalisation */
  exitTime: Minutes | null;
  status: AttendanceStatus;
  lateMinutes: number;
  verificationMethod: VerificationMethod;
  /** face confidence 0-100, or null when face verification was not used */
  verificationConfidence: number | null;
  reviewStatus: ReviewStatus;
  overrideReason: string | null;
  /** total authorised break minutes inside the lesson */
  breakMinutes: number;
  /** true when this record is still sitting in the terminal's local queue */
  pendingSync: boolean;
}

export type ScanResult =
  | 'ACCEPTED'
  | 'DUPLICATE_IGNORED'
  | 'NOT_EXPECTED'
  | 'FACE_REVIEW'
  | 'INVALID_CARD'
  | 'TERMINAL_OFFLINE_QUEUED'
  | 'EVENT_MODE_QUEUED';

export interface ScanEvent {
  scanId: string;
  terminalId: string;
  /** null when the card could not be resolved to a student */
  studentId: string | null;
  /** simulation time, NOT wall-clock time */
  timestamp: Minutes;
  week: Week;
  day: Day;
  result: ScanResult;
  verificationConfidence: number | null;
  /** human-readable message shown on the terminal / in the log */
  message: string;
  synced: boolean;
}

export type TerminalStatus = 'ONLINE' | 'OFFLINE' | 'SYNCING';
export type TerminalMode = 'NORMAL' | 'EVENT';

export interface Terminal {
  terminalId: string;
  roomId: string;
  label: string;
  status: TerminalStatus;
  mode: TerminalMode;
  /** active emergency event id when mode === 'EVENT' */
  eventId: string | null;
  /** number of scans waiting in the local queue */
  queuedScans: number;
}

export type EventType = 'FIRE_EVACUATION' | 'EMERGENCY_LEAVE' | 'MASS_MOVEMENT';

export interface ScasEvent {
  eventId: string;
  eventName: string;
  eventType: EventType;
  createdBy: string;
  week: Week;
  day: Day;
  startTime: Minutes;
  endTime: Minutes | null;
  active: boolean;
  terminalIds: string[];
}

export type MovementType = 'ENTER' | 'EXIT' | 'MOVE';

export interface EventMovement {
  movementId: string;
  eventId: string;
  studentId: string;
  terminalId: string;
  timestamp: Minutes;
  movementType: MovementType;
}

export interface AuditEntry {
  auditId: string;
  userId: string;
  userRole: string;
  action: string;
  recordId: string;
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: Minutes;
  week: Week;
  day: Day;
}

/* ------------------------------------------------------------------ */
/* Simulation state                                                    */
/* ------------------------------------------------------------------ */

export type Role = 'office' | 'teacher' | 'student';

export type SimulationMode = 'SIMULATION' | 'LIVE';

export interface SimulationClock {
  week: Week;
  day: Day;
  /** simulated date string, e.g. 02/10/2026 */
  date: string;
  /** simulated time of day in minutes since midnight */
  time: Minutes;
  running: boolean;
}

export interface SimulatorState {
  studentId: string | null;
  /** editable ID number typed into the terminal (may not match a real student) */
  typedStudentNumber: string;
  roomId: string;
  faceConfidence: number;
  networkOnline: boolean;
  scenario: {
    duplicateScan: boolean;
    wrongFace: boolean;
    forgottenCard: boolean;
    cameraFailure: boolean;
    networkFailure: boolean;
    notExpectedInRoom: boolean;
    emergencyMode: boolean;
  };
}

/** The complete database snapshot used by the engine. */
export interface SchoolData {
  subjects: Subject[];
  rooms: Room[];
  teachers: Teacher[];
  classes: Class[];
  students: Student[];
  enrolments: StudentEnrolment[];
  timetableBlocks: TimetableBlock[];
}

/** Mutable runtime state layered on top of SchoolData. */
export interface RuntimeState {
  attendance: AttendanceRecord[];
  scanEvents: ScanEvent[];
  auditLog: AuditEntry[];
  terminals: Terminal[];
  events: ScasEvent[];
  eventMovements: EventMovement[];
}
