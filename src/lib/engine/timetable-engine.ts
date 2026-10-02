/**
 * TIMETABLE LOOKUP ENGINE
 * ==================================================================
 * These are the functions listed in requirement 28. They are pure,
 * side-effect free and deliberately small so they can be transcribed
 * directly into IGCSE pseudocode / flowcharts later.
 *
 *   getCurrentTimetableBlock()
 *   getBlocksForDay()
 *   getBlockForRoom()
 *   getStudentExpectedClass()
 *   getStudentTimetable()
 *   getExpectedStudents()
 *   validateStudentRoom()
 *   getTeacherClasses()
 *   getCurrentTeacherBlock()
 */

import type {
  Class,
  Day,
  Room,
  SchoolData,
  Student,
  StudentLesson,
  Subject,
  Teacher,
  TimetableBlock,
  Week,
} from '../types';

/* ------------------------------------------------------------------ */
/* Central timetable lookup — week + day + time                        */
/* ------------------------------------------------------------------ */

export interface TimeContext {
  week: Week;
  day: Day;
  time: number;
}

/**
 * getCurrentTimetableBlock()
 * ------------------------------------------------------------------
 * Returns every block that is running at the given simulation time,
 * across the whole year group. Several classes run in parallel in
 * different rooms — that is the whole point of the central timetable.
 *
 * A block is ACTIVE when:  startTime <= currentTime < endTime
 */
export function getCurrentTimetableBlock(
  data: SchoolData,
  ctx: TimeContext,
): TimetableBlock[] {
  return data.timetableBlocks.filter(
    (b) =>
      b.week === ctx.week &&
      b.day === ctx.day &&
      ctx.time >= b.startTime &&
      ctx.time < b.endTime,
  );
}

/**
 * getBlocksForDay()
 * All blocks for one week + day, sorted by start time. Used by the
 * Office central timetable grid.
 */
export function getBlocksForDay(
  data: SchoolData,
  week: Week,
  day: Day,
): TimetableBlock[] {
  return data.timetableBlocks
    .filter((b) => b.week === week && b.day === day)
    .sort((a, b) => a.startTime - b.startTime || a.roomId.localeCompare(b.roomId));
}

/**
 * getBlockForRoom()
 * The single block running in a given room at the given time, or null
 * when the room has no lesson (free period, break, before school).
 */
export function getBlockForRoom(
  data: SchoolData,
  ctx: TimeContext,
  roomId: string,
): TimetableBlock | null {
  const active = getCurrentTimetableBlock(data, ctx);
  return active.find((b) => b.roomId === roomId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Individual student timetable — derived, never stored                */
/* ------------------------------------------------------------------ */

/**
 * getStudentExpectedClass()
 * ------------------------------------------------------------------
 * Given student + week + day + time, work out the lesson THAT student
 * is required to attend. The student is NOT expected to attend every
 * class in the central timetable — only the ones they are enrolled in.
 *
 * Returns null if the student has no lesson (free period / break).
 */
export function getStudentExpectedClass(
  data: SchoolData,
  studentId: string,
  ctx: TimeContext,
): StudentLesson | null {
  const lessons = getStudentTimetable(data, studentId, ctx.week, ctx.day);
  const found = lessons.find(
    (l) => ctx.time >= l.block.startTime && ctx.time < l.block.endTime,
  );
  return found ?? null;
}

/**
 * getStudentTimetable()
 * The full individual timetable for one student on one day — this is
 * the "STUDENT TIMETABLE" view in Office (requirement 10).
 */
export function getStudentTimetable(
  data: SchoolData,
  studentId: string,
  week: Week,
  day: Day,
): StudentLesson[] {
  const enrolledClassIds = new Set(
    data.enrolments
      .filter((e) => e.studentId === studentId && e.week === week)
      .map((e) => e.classId),
  );

  return data.timetableBlocks
    .filter(
      (b) => b.week === week && b.day === day && enrolledClassIds.has(b.classId),
    )
    .map((b) => toLesson(data, b))
    .sort((a, b) => a.block.startTime - b.block.startTime);
}

/* ------------------------------------------------------------------ */
/* Class membership                                                    */
/* ------------------------------------------------------------------ */

/**
 * getExpectedStudents()
 * ------------------------------------------------------------------
 * The students who are REQUIRED to be in this class right now. This is
 * what the teacher dashboard roster is built from — it never lists the
 * whole year group.
 */
export function getExpectedStudents(
  data: SchoolData,
  classId: string,
  week: Week,
): Student[] {
  const ids = new Set(
    data.enrolments
      .filter((e) => e.classId === classId && e.week === week)
      .map((e) => e.studentId),
  );
  return data.students.filter((s) => ids.has(s.studentId));
}

/**
 * validateStudentRoom()
 * ------------------------------------------------------------------
 * Is this student actually supposed to be in this room at this time?
 * Returns a structured reason so the terminal can display a precise
 * message and the engine can decide whether to raise an exception.
 */
export interface RoomValidation {
  valid: boolean;
  reason:
    | 'OK'
    | 'NO_LESSON_FOR_STUDENT'
    | 'DIFFERENT_CLASS'
    | 'NO_LESSON_IN_ROOM'
    | 'UNKNOWN_STUDENT';
  expectedLesson: StudentLesson | null;
  roomBlock: TimetableBlock | null;
  message: string;
}

export function validateStudentRoom(
  data: SchoolData,
  studentId: string,
  ctx: TimeContext,
  roomId: string,
): RoomValidation {
  const student = data.students.find((s) => s.studentId === studentId);

  if (!student) {
    return {
      valid: false,
      reason: 'UNKNOWN_STUDENT',
      expectedLesson: null,
      roomBlock: null,
      message: 'STUDENT ID NOT RECOGNISED',
    };
  }

  const roomBlock = getBlockForRoom(data, ctx, roomId);
  const expectedLesson = getStudentExpectedClass(data, studentId, ctx);

  if (!expectedLesson) {
    return {
      valid: false,
      reason: 'NO_LESSON_FOR_STUDENT',
      expectedLesson: null,
      roomBlock,
      message: 'STUDENT HAS NO EXPECTED LESSON AT THIS TIME',
    };
  }

  if (expectedLesson.block.roomId === roomId) {
    return {
      valid: true,
      reason: 'OK',
      expectedLesson,
      roomBlock,
      message: 'STUDENT EXPECTED IN THIS ROOM',
    };
  }

  if (!roomBlock) {
    return {
      valid: false,
      reason: 'NO_LESSON_IN_ROOM',
      expectedLesson,
      roomBlock: null,
      message: 'NO LESSON SCHEDULED IN THIS ROOM AT THIS TIME',
    };
  }

  return {
    valid: false,
    reason: 'DIFFERENT_CLASS',
    expectedLesson,
    roomBlock,
    message: `STUDENT NOT EXPECTED IN THIS ROOM — EXPECTED ${expectedLesson.room.roomName} (${expectedLesson.subject.abbreviation})`,
  };
}

/* ------------------------------------------------------------------ */
/* Teacher-scoped lookup                                               */
/* ------------------------------------------------------------------ */

/**
 * getTeacherClasses()
 * Every class this teacher is timetabled to teach. The teacher role
 * selector is constrained to this list (requirement 6 / 23) — a teacher
 * can never pick an unrelated class.
 */
export function getTeacherClasses(
  data: SchoolData,
  teacherId: string,
): { cls: Class; subject: Subject; group: string }[] {
  return data.classes
    .filter((c) => c.teacherId === teacherId)
    .map((c) => ({
      cls: c,
      subject: data.subjects.find((s) => s.subjectId === c.subjectId)!,
      group: c.group,
    }));
}

/**
 * getCurrentTeacherBlock()
 * What is this teacher teaching right now, in the given room?
 * Used to auto-switch the teacher dashboard as simulation time moves.
 */
export function getCurrentTeacherBlock(
  data: SchoolData,
  teacherId: string,
  ctx: TimeContext,
  roomId?: string,
): TimetableBlock | null {
  const active = getCurrentTimetableBlock(data, ctx);
  const classIds = new Set(
    data.classes.filter((c) => c.teacherId === teacherId).map((c) => c.classId),
  );
  const mine = active.filter((b) => classIds.has(b.classId));
  if (roomId) {
    return mine.find((b) => b.roomId === roomId) ?? mine[0] ?? null;
  }
  return mine[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function toLesson(data: SchoolData, block: TimetableBlock): StudentLesson {
  const cls = data.classes.find((c) => c.classId === block.classId)!;
  const subject = data.subjects.find((s) => s.subjectId === cls.subjectId)!;
  const room = data.rooms.find((r) => r.roomId === block.roomId)!;
  const teacher = data.teachers.find((t) => t.teacherId === cls.teacherId)!;
  return { block, class: cls, subject, room, teacher };
}

export function findRoom(data: SchoolData, roomId: string): Room | null {
  return data.rooms.find((r) => r.roomId === roomId) ?? null;
}

export function findTeacher(data: SchoolData, teacherId: string): Teacher | null {
  return data.teachers.find((t) => t.teacherId === teacherId) ?? null;
}
