/**
 * REFERENCE DATA — Taylor's International Kuala Lumpur, Year 10 (10TAY)
 * ==================================================================
 * SOURCE OF TRUTH
 *   1. "10TAY.PDF"            — central 10TAY two-week class grid (Week 1 / Week 2)
 *   2. "CHEN-ZiChun_(10).pdf" — Zichun Chen's iSAMS individual timetable (Week 1 / Week 2)
 *   3. Shu Min's (KL3946) individual timetable, supplied with the brief
 *
 * Subject codes, room codes and teacher names are reproduced exactly as
 * printed in the sources. Subject names not printed in the source keep
 * the printed code as their name (PP, AG, ABL, IGPE).
 */

import type { Class, Room, Subject, Teacher } from '../types';

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

interface SubjectSeed {
  code: string;
  name: string;
  abbr: string;
}

const SUBJECT_SEED: SubjectSeed[] = [
  { code: 'HR', name: 'Homeroom', abbr: 'HR' },
  { code: 'CHE', name: 'Chemistry', abbr: 'Che' },
  { code: 'MN', name: 'Mandarin Chinese', abbr: 'Mn' },
  { code: 'ABL', name: 'ABL', abbr: 'ABL' },
  { code: 'EC', name: 'Economics', abbr: 'Ec' },
  { code: 'GEO', name: 'Geography', abbr: 'Geo' },
  { code: 'ENG', name: 'English Language', abbr: 'Eng' },
  { code: 'BS', name: 'Business Studies', abbr: 'BS' },
  { code: 'PHY', name: 'Physics', abbr: 'Phy' },
  { code: 'BIO', name: 'Biology', abbr: 'Bio' },
  { code: 'AM', name: 'Additional Mathematics', abbr: 'AM' },
  { code: 'GP', name: 'Global Perspectives', abbr: 'GP' },
  { code: 'HIS', name: 'History', abbr: 'His' },
  { code: 'IT', name: 'ICT', abbr: 'IT' },
  { code: 'CS', name: 'Computer Science', abbr: 'CS' },
  { code: 'BM', name: 'Bahasa Melayu', abbr: 'BM' },
  { code: 'MATH', name: 'Mathematics', abbr: 'Math' },
  { code: 'DR', name: 'Drama', abbr: 'Dr' },
  { code: 'PE', name: 'Physical Education', abbr: 'PE' },
  { code: 'PSHE', name: 'PSHE', abbr: 'PSHE' },
  { code: 'AG', name: 'AG', abbr: 'AG' },
  { code: 'PP', name: 'PP', abbr: 'PP' },
  { code: 'MU', name: 'Music', abbr: 'Mu' },
  { code: 'SC', name: 'Combined Science', abbr: 'Sc' },
  { code: 'ART', name: 'Art & Design', abbr: 'Art' },
  { code: 'IGPE', name: 'IGPE', abbr: 'IGPE' },
  { code: 'CCA', name: 'CCA (Enrichment)', abbr: 'CCA' },
  { code: 'ASM', name: 'Assembly', abbr: 'ASM' },
];

export const SUBJECTS: Subject[] = SUBJECT_SEED.map((s) => ({
  subjectId: `SUB-${s.code}`,
  name: s.name,
  abbreviation: s.abbr,
}));

export const SUBJECT_BY_CODE: Record<string, Subject> = Object.fromEntries(
  SUBJECT_SEED.map((s) => [s.code, SUBJECTS.find((x) => x.subjectId === `SUB-${s.code}`)!]),
);

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

const ROOM_SEED: [string, string][] = [
  ['A302', 'A302'],
  ['A303', 'A303'],
  ['A304', 'A304'],
  ['A305', 'A305'],
  ['A306', 'A306'],
  ['A501', 'A501'],
  ['A502', 'A502'],
  ['A503', 'A503'],
  ['B208', 'B208'],
  ['B209', 'B209'],
  ['B211', 'B211'],
  ['B212', 'B212'],
  ['B214', 'B214'],
  ['B215', 'B215'],
  ['B216', 'B216'],
  ['B307', 'B307'],
  ['B308', 'B308'],
  ['B309', 'B309'],
  ['B311', 'B311'],
  ['B314', 'B314'],
  ['B315', 'B315'],
  ['B317', 'B317'],
  ['B318', 'B318'],
  ['B320', 'B320'],
  ['B323', 'B323'],
  ['B324', 'B324'],
  ['B401', 'B401'],
  ['B402', 'B402'],
  ['B403', 'B403'],
  ['B404', 'B404'],
  ['B407', 'B407'],
  ['B408', 'B408'],
  ['B409', 'B409'],
  ['B410', 'B410'],
  ['B415', 'B415'],
  ['B416', 'B416'],
  ['B418', 'B418'],
  ['B420', 'B420'],
  ['B421', 'B421'],
  ['B422', 'B422'],
  ['B425', 'B425'],
  ['B426', 'B426'],
  ['B428', 'B428'],
  ['BAD', 'Badminton Hall'],
  ['FLD', 'Field'],
  ['SPH', 'Sport Hall'],
  ['SCX', 'Sports Complex'],
  ['HLZ', 'Hall'],
];

export const ROOMS: Room[] = ROOM_SEED.map(([id, name]) => ({ roomId: id, roomName: name }));

export const ROOM_BY_ID: Record<string, Room> = Object.fromEntries(
  ROOMS.map((r) => [r.roomId, r]),
);

/* ------------------------------------------------------------------ */
/* Teachers — names exactly as printed in the sources                  */
/* ------------------------------------------------------------------ */

const TEACHER_SEED: [string, string][] = [
  ['T-SAK', 'Ms Nur Sakinah Shokri'],
  ['T-ADI', 'Ms Adibah'],
  ['T-NOO', 'Ms Noorainuriza'],
  ['T-SIL', 'Mr Silvaraj David'],
  ['T-SIT', 'Ms Siti Afirah'],
  ['T-LIM', 'Ms Bee Lan Lim'],
  ['T-MAKC', 'Ms Mak Choy Fun'],
  ['T-CHO', 'Ms Chong Sin Li'],
  ['T-SAN', 'Ms Sandhi'],
  ['T-GAY', 'Ms Gaya'],
  ['T-HID', 'Ms Hidayah'],
  ['T-MIR', 'Ms Miriam'],
  ['T-FER', 'Mr Fergus Brennan'],
  ['T-LET', 'Ms Letitia'],
  ['T-ELU', 'Ms Elucia Siew Lean Yong'],
  ['T-AND', 'Ms Andrea'],
  ['T-FAZ', 'Mr Fazeeq'],
  ['T-KAR', 'Mr Kartiban'],
  ['T-TEN', 'Mr Ten Wei Ping'],
  ['T-SAT', 'Mr Satya'],
  ['T-SAF', 'Mr Safwan'],
  ['T-CAR', 'Ms Carolyin Hoong'],
  ['T-REE', 'Ms Reeinna'],
  ['T-WEN', 'Ms Wendy Nga'],
  ['T-JUD', 'Ms Judith Juni'],
  ['T-PAR', 'Ms Parveen'],
  ['T-GLO', 'Ms Glory Kong'],
  ['T-RIC', 'Mr Riclan Maridas'],
  ['T-VIV', 'Ms Vivien Wong'],
  ['T-SHE', 'Ms Sheena'],
  ['T-JUM', 'Ms Jumaidah'],
  ['T-NAJ', 'Ms Najwa'],
  ['T-RAM', 'Mr Ramesh Subramaniam'],
  ['T-INT', 'Ms Intan Chempaka Abu Bakar'],
  ['T-BEL', 'Ms Belinda'],
  ['T-WIL', 'Mr Will'],
  ['T-AID', 'Mr Aidil Fariz'],
  ['T-NORA', 'Ms Noraida'],
  ['T-NAM', 'Ms Nor Amirah'],
  ['T-WPS', 'Mr Wong Peng Soon'],
  ['T-RAD', 'Mr Radin'],
  ['T-IQB', 'Mr Iqbal'],
  ['T-FAW', 'Ms Fawwaz'],
  ['T-RAJ', 'Ms Raja Norasikir'],
  ['T-TBC', 'Staff TBC'],
];

export const TEACHERS: Teacher[] = TEACHER_SEED.map(([id, name]) => ({ teacherId: id, name }));

export const TEACHER_BY_ID: Record<string, Teacher> = Object.fromEntries(
  TEACHERS.map((t) => [t.teacherId, t]),
);

/* ------------------------------------------------------------------ */
/* Class map — (subject code, room) -> class set + teacher             */
/* ------------------------------------------------------------------ */
/**
 * Every (subject, room) pair in the 10TAY grid maps to exactly one
 * teaching set. Class ids are `<SUBJ>-<set number>`. Where the two
 * demo students' individual timetables place a subject in a room that
 * the grid does not cover (BIO B401) the teacher is printed as
 * "Staff TBC" rather than invented.
 */
export const CLASS_MAP: Record<string, { classId: string; teacherId: string; group: string }> = {
  // Homeroom forms
  'HR@A303': { classId: 'HR-1', teacherId: 'T-ADI', group: '10TAY-1' },
  'HR@B403': { classId: 'HR-2', teacherId: 'T-SAK', group: '10TAY-2' },
  'HR@A305': { classId: 'HR-3', teacherId: 'T-NOO', group: '10TAY-3' },
  // Sciences
  'CHE@B209': { classId: 'CHE-1', teacherId: 'T-SIL', group: '' },
  'CHE@B212': { classId: 'CHE-2', teacherId: 'T-SIT', group: '' },
  'BIO@B214': { classId: 'BIO-1', teacherId: 'T-PAR', group: '' },
  'BIO@B216': { classId: 'BIO-2', teacherId: 'T-JUD', group: '' },
  'BIO@B401': { classId: 'BIO-3', teacherId: 'T-TBC', group: '' },
  'PHY@B422': { classId: 'PHY-1', teacherId: 'T-TEN', group: '' },
  'PHY@B215': { classId: 'PHY-2', teacherId: 'T-GLO', group: '' },
  'PHY@B211': { classId: 'PHY-3', teacherId: 'T-RIC', group: '' },
  'SC@B212': { classId: 'SC-1', teacherId: 'T-SIT', group: '' },
  // Languages
  'ENG@B416': { classId: 'ENG-1', teacherId: 'T-MIR', group: '' },
  'ENG@B421': { classId: 'ENG-2', teacherId: 'T-FER', group: '' },
  'ENG@B418': { classId: 'ENG-3', teacherId: 'T-LET', group: '' },
  'ENG@B420': { classId: 'ENG-4', teacherId: 'T-ELU', group: '' },
  'ENG@B410': { classId: 'ENG-5', teacherId: 'T-AND', group: '' },
  'ENG@B415': { classId: 'ENG-6', teacherId: 'T-FAZ', group: '' },
  'MN@B315': { classId: 'MN-1', teacherId: 'T-LIM', group: '' },
  'MN@B314': { classId: 'MN-2', teacherId: 'T-MAKC', group: '' },
  'MN@B311': { classId: 'MN-3', teacherId: 'T-CHO', group: '' },
  'BM@A305': { classId: 'BM-1', teacherId: 'T-NOO', group: '' },
  'BM@A306': { classId: 'BM-2', teacherId: 'T-RAJ', group: '' },
  'BM@A303': { classId: 'BM-3', teacherId: 'T-ADI', group: '' },
  // Humanities / options
  'EC@B407': { classId: 'EC-1', teacherId: 'T-SAN', group: '' },
  'EC@B409': { classId: 'EC-2', teacherId: 'T-GAY', group: '' },
  'GEO@B402': { classId: 'GEO-1', teacherId: 'T-HID', group: '' },
  'HIS@B428': { classId: 'HIS-1', teacherId: 'T-JUM', group: '' },
  'HIS@B403': { classId: 'HIS-2', teacherId: 'T-SAK', group: '' },
  'GP@B426': { classId: 'GP-1', teacherId: 'T-VIV', group: '' },
  'GP@B425': { classId: 'GP-2', teacherId: 'T-SHE', group: '' },
  'BS@B408': { classId: 'BS-1', teacherId: 'T-KAR', group: '' },
  'BS@B320': { classId: 'BS-2', teacherId: 'T-SAF', group: '' },
  'AG@A302': { classId: 'AG-1', teacherId: 'T-NORA', group: '' },
  'PP@B320': { classId: 'PP-1', teacherId: 'T-SAF', group: '' },
  // Mathematics
  'MATH@B308': { classId: 'MATH-1', teacherId: 'T-SHE', group: '' },
  'MATH@B317': { classId: 'MATH-2', teacherId: 'T-SAT', group: '' },
  'MATH@B320': { classId: 'MATH-3', teacherId: 'T-SAF', group: '' },
  'MATH@B307': { classId: 'MATH-4', teacherId: 'T-CAR', group: '' },
  'MATH@B309': { classId: 'MATH-5', teacherId: 'T-REE', group: '' },
  'AM@B318': { classId: 'AM-1', teacherId: 'T-WEN', group: '' },
  'AM@B308': { classId: 'AM-2', teacherId: 'T-SHE', group: '' },
  // Zichun's iSAMS print shows "Maths B308 Ms Sheela" at Week B Friday P3,
  // while Shu Min's print shows "Add Math B308" at the same slot. Both are
  // kept: MATH-9 is the Week B Friday P3 Maths set (see timetable.ts header).
  'MATH9@B308': { classId: 'MATH-9', teacherId: 'T-SHE', group: '' },
  // Shu Min's Add Math set for the same disputed slot (see MATH-9 note).
  'AM9@B308': { classId: 'AM-3', teacherId: 'T-SHE', group: '' },
  // Computing
  'CS@B323': { classId: 'CS-1', teacherId: 'T-INT', group: '' },
  'IT@B324': { classId: 'IT-1', teacherId: 'T-RAM', group: '' },
  // Arts / PE / other
  'ART@B208': { classId: 'ART-1', teacherId: 'T-IQB', group: '' },
  'MU@A502': { classId: 'MU-1', teacherId: 'T-FAW', group: '' },
  'MU@A503': { classId: 'MU-2', teacherId: 'T-RAD', group: '' },
  'DR@A501': { classId: 'DR-1', teacherId: 'T-BEL', group: '' },
  'PE@BAD': { classId: 'PE-1', teacherId: 'T-WIL', group: '' },
  'PE@FLD': { classId: 'PE-2', teacherId: 'T-AID', group: '' },
  'PE@SPH': { classId: 'PE-3', teacherId: 'T-NAM', group: '' },
  'PE@SCX': { classId: 'PE-4', teacherId: 'T-WPS', group: '' },
  'PSHE@B420': { classId: 'PSHE-1', teacherId: 'T-ELU', group: '' },
  'PSHE@A503': { classId: 'PSHE-2', teacherId: 'T-RAD', group: '' },
  'PSHE@B402': { classId: 'PSHE-3', teacherId: 'T-HID', group: '' },
  'IGPE@HLZ': { classId: 'IGPE-1', teacherId: 'T-WIL', group: '' },
  'IGPE@B404': { classId: 'IGPE-1', teacherId: 'T-WIL', group: '' },
  'IGPE@B426': { classId: 'IGPE-1', teacherId: 'T-WIL', group: '' },
  'ABL@B403': { classId: 'ABL-1', teacherId: 'T-SAK', group: '' },
  'ABL@A303': { classId: 'ABL-2', teacherId: 'T-ADI', group: '' },
  'ABL@A305': { classId: 'ABL-3', teacherId: 'T-NOO', group: '' },
  'ABL@A304': { classId: 'ABL-4', teacherId: 'T-NAJ', group: '' },
  'ABL@A306': { classId: 'ABL-5', teacherId: 'T-RAJ', group: '' },
  'CCA@B323': { classId: 'CCA-1', teacherId: 'T-INT', group: '' },
  'ASM@B403': { classId: 'ASM-1', teacherId: 'T-SAK', group: '' },
};

/** Build the CLASSES table from the map (one row per unique class id). */
export const CLASSES: Class[] = Object.values(
  Object.fromEntries(
    Object.entries(CLASS_MAP).map(([key, v]) => {
      // strip the numeric disambiguator used for disputed slots (MATH9 -> MATH)
      const [code] = key.split('@').map((k) => k.replace(/\d+$/, ''));
      return [
        v.classId,
        {
          classId: v.classId,
          subjectId: `SUB-${code}`,
          teacherId: v.teacherId,
          group: v.group,
        } satisfies Class,
      ];
    }),
  ),
);

export const CLASS_BY_ID: Record<string, Class> = Object.fromEntries(
  CLASSES.map((c) => [c.classId, c]),
);

export function subjectCodeOfClassId(classId: string): string {
  return classId.replace(/-\d+$/, '');
}

/** Teaching groups (homeroom forms) represented in the seed data. */
export const FORMS = ['10TAY-1', '10TAY-2', '10TAY-3'];

/** Classes each teaching package is enrolled in (see students.ts). */
export const PACKAGE_A_CLASSES = [
  'HR-1', 'CHE-1', 'MN-1', 'ABL-3', 'EC-2', 'CS-1', 'ENG-4',
  'PE-1', 'PSHE-2', 'MATH-1', 'AM-2', 'AM-3', 'PHY-3', 'BIO-3', 'CCA-1',
];

export const PACKAGE_B_CLASSES = [
  'HR-2', 'CHE-1', 'MN-1', 'CS-1', 'IT-1', 'ENG-2',
  'PE-2', 'PSHE-1', 'MATH-1', 'MATH-9', 'AM-2', 'PHY-3', 'BIO-2', 'CCA-1', 'ASM-1',
];

/** Package C/D = A/B with a different English set and Biology set. */
export const PACKAGE_C_CLASSES = PACKAGE_A_CLASSES.map((c) =>
  c === 'ENG-4' ? 'ENG-1' : c === 'BIO-3' ? 'BIO-2' : c,
);

export const PACKAGE_D_CLASSES = PACKAGE_B_CLASSES.map((c) =>
  c === 'ENG-2' ? 'ENG-3' : c === 'BIO-2' ? 'BIO-3' : c,
);
