/**
 * STUDENT DATA — 10TAY cohort
 * ------------------------------------------------------------------
 * The two students named in the brief are seeded exactly as printed in
 * their timetable sources:
 *   - Shu Min  (KL3946), form 10TAY-1, homeroom A303 (Ms Adibah)
 *   - Zichun Chen (KL5195), form 10TAY-2, homeroom B403 (Ms Nur Sakinah Shokri)
 *
 * The class needs a realistic roll for the teacher dashboard, so a
 * deterministic synthetic cohort is generated around them. Each
 * synthetic student follows one of four class packages; packages A and
 * C mirror Shu Min's set choices, B and D mirror Zichun's, with the
 * parallel English / Biology sets varied. Because every package is a
 * real student's printed schedule, no synthetic student is ever
 * double-booked.
 */

import type { Student } from '../types';
import {
  PACKAGE_A_CLASSES,
  PACKAGE_B_CLASSES,
  PACKAGE_C_CLASSES,
  PACKAGE_D_CLASSES,
} from './reference';

export const FORMS = ['10TAY-1', '10TAY-2'];

interface BuiltStudent extends Student {
  form: string;
  package: 'A' | 'B' | 'C' | 'D';
}

const REAL_STUDENTS: BuiltStudent[] = [
  {
    studentId: 'S-KL3946',
    studentNumber: 'KL3946',
    name: 'Shu Min',
    yearGroup: '10',
    active: true,
    faceTemplateId: 'FT-KL3946',
    backupPin: '3946',
    form: '10TAY-1',
    package: 'A',
  },
  {
    studentId: 'S-KL5195',
    studentNumber: 'KL5195',
    name: 'Zichun Chen',
    yearGroup: '10',
    active: true,
    faceTemplateId: 'FT-KL5195',
    backupPin: '5195',
    form: '10TAY-2',
    package: 'B',
  },
];

/** Deterministic filler names — the same list every load. */
const FILLER_NAMES = [
  'Aidan Lim', 'Beverly Ng', 'Caleb Tan', 'Danish Rahman', 'Elena Wong', 'Farhan Adam',
  'Grace Neo', 'Hannah Yeo', 'Isaac Leong', 'Julia Koh', 'Kai Zheng', 'Liyana Hassan',
  'Marcus Sim', 'Nurul Priscillia', 'Owen Chia', 'Priya Ananda', 'Qiao Wen', 'Ryan Goh',
  'Siti Nurhaliza', 'Tan Wei Jie', 'Umair Faisal', 'Vivian Hoo', 'Wong Kang Hao', 'Xavier Lee',
];

const PACKAGE_PLAN: { pkg: 'A' | 'B' | 'C' | 'D'; form: string; count: number }[] = [
  { pkg: 'A', form: '10TAY-1', count: 6 },
  { pkg: 'B', form: '10TAY-2', count: 6 },
  { pkg: 'C', form: '10TAY-1', count: 6 },
  { pkg: 'D', form: '10TAY-2', count: 6 },
];

function buildCohort(): BuiltStudent[] {
  const out: BuiltStudent[] = [...REAL_STUDENTS];
  let filler = 0;
  let serial = 6300;

  for (const plan of PACKAGE_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      const name = FILLER_NAMES[filler % FILLER_NAMES.length];
      const round = Math.floor(filler / FILLER_NAMES.length);
      filler += 1;
      serial += 7;
      const studentNumber = `KL${serial}`;
      out.push({
        studentId: `S-${studentNumber}`,
        studentNumber,
        name: round === 0 ? name : `${name} ${round + 1}`,
        yearGroup: '10',
        active: true,
        faceTemplateId: `FT-${studentNumber}`,
        backupPin: String(1000 + ((Number(studentNumber.slice(2)) + i * 37) % 9000)),
        form: plan.form,
        package: plan.pkg,
      });
    }
  }
  return out;
}

const COHORT = buildCohort();

export const STUDENTS: Student[] = COHORT.map(({ form: _f, package: _p, ...s }) => s);

export const STUDENT_BY_ID: Record<string, Student> = Object.fromEntries(
  STUDENTS.map((s) => [s.studentId, s]),
);

export const STUDENT_BY_NUMBER: Record<string, Student> = Object.fromEntries(
  STUDENTS.map((s) => [s.studentNumber, s]),
);

const FORM_OF: Record<string, string> = Object.fromEntries(
  COHORT.map((s) => [s.studentId, s.form]),
);
const PACKAGE_OF: Record<string, 'A' | 'B' | 'C' | 'D'> = Object.fromEntries(
  COHORT.map((s) => [s.studentId, s.package]),
);

/** The student's homeroom form, e.g. '10TAY-1'. */
export function getStudentGroup(studentId: string): string {
  return FORM_OF[studentId] ?? '10TAY-1';
}

export function studentsInForm(form: string): Student[] {
  return COHORT.filter((s) => s.form === form).map(({ form: _f, package: _p, ...s }) => s);
}

/** The class package a student follows (drives enrolments). */
export function getStudentPackage(studentId: string): 'A' | 'B' | 'C' | 'D' {
  return PACKAGE_OF[studentId] ?? 'A';
}

/** The two students named explicitly in the project brief. */
export const DEMO_STUDENT_IDS = ['S-KL3946', 'S-KL5195'];

export const PACKAGE_CLASSES: Record<string, string[]> = {
  A: PACKAGE_A_CLASSES,
  B: PACKAGE_B_CLASSES,
  C: PACKAGE_C_CLASSES,
  D: PACKAGE_D_CLASSES,
};
