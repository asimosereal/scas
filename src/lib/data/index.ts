/**
 * SCHOOL DATA ASSEMBLY
 * ------------------------------------------------------------------
 * Builds the complete, immutable SchoolData snapshot from the seed
 * modules. This object is what every engine function receives.
 */

import type { SchoolData, StudentEnrolment } from '../types';
import {
  CLASSES as BASE_CLASSES,
  FORMS,
  ROOMS,
  SUBJECTS,
  TEACHERS,
} from './reference';
import { getStudentPackage, STUDENTS } from './students';
import { EXTRA_CLASSES, TIMETABLE_BLOCKS, validateTimetable } from './timetable';
import { PACKAGE_CLASSES } from './students';

/** Static class definitions + sibling sets created by the grid builder. */
export const CLASSES = [...BASE_CLASSES, ...EXTRA_CLASSES];

/** Build enrolments from each student's class package, for both weeks. */
function buildEnrolments(): StudentEnrolment[] {
  const out: StudentEnrolment[] = [];
  for (const student of STUDENTS) {
    const pkg = PACKAGE_CLASSES[getStudentPackage(student.studentId)];
    for (const classId of pkg) {
      out.push({ studentId: student.studentId, classId, week: 'A' });
      out.push({ studentId: student.studentId, classId, week: 'B' });
    }
  }
  return out;
}

export const SCHOOL_DATA: SchoolData = {
  subjects: SUBJECTS,
  rooms: ROOMS,
  teachers: TEACHERS,
  classes: CLASSES,
  students: STUDENTS,
  enrolments: buildEnrolments(),
  timetableBlocks: TIMETABLE_BLOCKS,
};

/** Blocks that are actual teaching (homeroom and assembly excluded). */
export const TEACHING_BLOCKS = TIMETABLE_BLOCKS.filter(
  (b) => !b.classId.startsWith('HR-') && !b.classId.startsWith('ASM-'),
);

export function timetableProblems(): string[] {
  return validateTimetable(TIMETABLE_BLOCKS);
}

export { FORMS };
