/**
 * Standalone verification of the real 10TAY timetable + engine.
 * Run with: npm run verify
 */
import { SCHOOL_DATA, timetableProblems } from '../src/lib/data/index';
import { STUDENTS, getStudentGroup } from '../src/lib/data/students';
import { DAYS, type Day, type Week } from '../src/lib/types';
import { formatTime } from '../src/lib/time';
import {
  getStudentExpectedClass,
  getStudentTimetable,
  getExpectedStudents,
  validateStudentRoom,
  getCurrentTimetableBlock,
} from '../src/lib/engine/timetable-engine';
import {
  calculateAttendanceStatus,
  calculateLateMinutes,
  markAbsentStudents,
} from '../src/lib/engine/attendance-engine';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

console.log('=== SCAS timetable + engine verification (10TAY real data) ===\n');

/* 1. integrity */
const problems = timetableProblems();
check('No room/teacher double-bookings (1 documented exception)', problems.length === 0, problems.slice(0, 3).join('; '));

const blocks = SCHOOL_DATA.timetableBlocks;
console.log(`\nBlocks: ${blocks.length} | Classes: ${SCHOOL_DATA.classes.length} | Students: ${STUDENTS.length} | Enrolments: ${SCHOOL_DATA.enrolments.length}\n`);

/* 2. demo students */
const shuMin = STUDENTS.find((s) => s.studentNumber === 'KL3946')!;
const zichun = STUDENTS.find((s) => s.studentNumber === 'KL5195')!;
check('Shu Min (KL3946) seeded', !!shuMin);
check('Zichun Chen (KL5195) seeded', !!zichun);
check('Shu Min in form 10TAY-1 (HR A303)', getStudentGroup(shuMin.studentId) === '10TAY-1');
check('Zichun in form 10TAY-2 (HR B403)', getStudentGroup(zichun.studentId) === '10TAY-2');

/* 3. Shu Min's printed timetable, checked cell by cell */
const SHU_EXPECTED: [Week, Day, number, string, string, string][] = [
  // week, day, time, classId, room, subject abbr
  ['A', 'Monday', 520, 'CHE-1', 'B209', 'Che'],
  ['A', 'Monday', 580, 'MN-1', 'B315', 'Mn'],
  ['A', 'Monday', 640, 'ABL-3', 'A305', 'ABL'],
  ['A', 'Monday', 750, 'EC-2', 'B409', 'Ec'],
  ['A', 'Monday', 810, 'CS-1', 'B323', 'CS'],
  ['A', 'Monday', 870, 'ENG-4', 'B420', 'Eng'],
  ['A', 'Tuesday', 520, 'PE-1', 'BAD', 'PE'],
  ['A', 'Tuesday', 580, 'PSHE-2', 'A503', 'PSHE'],
  ['A', 'Tuesday', 640, 'CS-1', 'B323', 'CS'],
  ['A', 'Tuesday', 750, 'MATH-1', 'B308', 'Math'],
  ['A', 'Tuesday', 810, 'AM-2', 'B308', 'AM'],
  ['A', 'Tuesday', 870, 'EC-2', 'B409', 'Ec'],
  ['A', 'Wednesday', 520, 'CS-1', 'B323', 'CS'],
  ['A', 'Wednesday', 580, 'AM-2', 'B308', 'AM'],
  ['A', 'Wednesday', 640, 'PHY-3', 'B211', 'Phy'],
  ['A', 'Wednesday', 750, 'EC-2', 'B409', 'Ec'],
  ['A', 'Wednesday', 810, 'MATH-1', 'B308', 'Math'],
  ['A', 'Wednesday', 870, 'ENG-4', 'B420', 'Eng'],
  ['A', 'Thursday', 520, 'BIO-3', 'B401', 'Bio'],
  ['A', 'Thursday', 580, 'MATH-1', 'B308', 'Math'],
  ['A', 'Thursday', 640, 'MN-1', 'B315', 'Mn'],
  ['A', 'Thursday', 750, 'ENG-4', 'B420', 'Eng'],
  ['A', 'Thursday', 810, 'CHE-1', 'B209', 'Che'],
  ['A', 'Friday', 520, 'AM-2', 'B308', 'AM'],
  ['A', 'Friday', 570, 'BIO-3', 'B401', 'Bio'],
  ['A', 'Friday', 625, 'EC-2', 'B409', 'Ec'],
  ['A', 'Friday', 720, 'PHY-3', 'B211', 'Phy'],
  ['B', 'Monday', 520, 'CHE-1', 'B209', 'Che'],
  ['B', 'Monday', 580, 'MATH-1', 'B308', 'Math'],
  ['B', 'Monday', 640, 'ENG-4', 'B420', 'Eng'],
  ['B', 'Monday', 750, 'BIO-3', 'B401', 'Bio'],
  ['B', 'Monday', 810, 'PHY-3', 'B211', 'Phy'],
  ['B', 'Monday', 870, 'MN-1', 'B315', 'Mn'],
  ['B', 'Tuesday', 520, 'PE-1', 'BAD', 'PE'],
  ['B', 'Tuesday', 580, 'PSHE-2', 'A503', 'PSHE'],
  ['B', 'Tuesday', 640, 'CHE-1', 'B209', 'Che'],
  ['B', 'Tuesday', 750, 'ENG-4', 'B420', 'Eng'],
  ['B', 'Tuesday', 810, 'MN-1', 'B315', 'Mn'],
  ['B', 'Tuesday', 870, 'MATH-1', 'B308', 'Math'],
  ['B', 'Wednesday', 520, 'AM-2', 'B308', 'AM'],
  ['B', 'Wednesday', 580, 'CS-1', 'B323', 'CS'],
  ['B', 'Wednesday', 640, 'EC-2', 'B409', 'Ec'],
  ['B', 'Wednesday', 750, 'PHY-3', 'B211', 'Phy'],
  ['B', 'Wednesday', 810, 'BIO-3', 'B401', 'Bio'],
  ['B', 'Wednesday', 870, 'ENG-4', 'B420', 'Eng'],
  ['B', 'Thursday', 520, 'MATH-1', 'B308', 'Math'],
  ['B', 'Thursday', 580, 'AM-2', 'B308', 'AM'],
  ['B', 'Thursday', 640, 'CS-1', 'B323', 'CS'],
  ['B', 'Thursday', 750, 'BIO-3', 'B401', 'Bio'],
  ['B', 'Thursday', 810, 'PHY-3', 'B211', 'Phy'],
  ['B', 'Friday', 520, 'MN-1', 'B315', 'Mn'],
  ['B', 'Friday', 570, 'CHE-1', 'B209', 'Che'],
  ['B', 'Friday', 625, 'AM-3', 'B308', 'AM'],
  ['B', 'Friday', 720, 'ENG-4', 'B420', 'Eng'],
];
let shuBad = 0;
for (const [week, day, time, classId, roomId, abbr] of SHU_EXPECTED) {
  const lesson = getStudentExpectedClass(SCHOOL_DATA, shuMin.studentId, { week, day, time });
  const ok = lesson && lesson.block.classId === classId && lesson.block.roomId === roomId && lesson.subject.abbreviation === abbr;
  if (!ok) {
    shuBad++;
    console.log(`   mismatch: ${week} ${day} ${formatTime(time)} expected ${classId}@${roomId}, got ${lesson ? `${lesson.block.classId}@${lesson.block.roomId}` : 'none'}`);
  }
}
check('Shu Min timetable matches the printed source (54 cells)', shuBad === 0, `${shuBad} mismatches`);

/* 4. Zichun spot checks from the iSAMS print */
const ZI_EXPECTED: [Week, Day, number, string, string][] = [
  ['A', 'Monday', 520, 'CHE-1', 'B209'],
  ['A', 'Monday', 580, 'MN-1', 'B315'],
  ['A', 'Monday', 640, 'ASM-1', 'B403'],
  ['A', 'Monday', 750, 'IT-1', 'B324'],
  ['A', 'Monday', 810, 'CS-1', 'B323'],
  ['A', 'Monday', 870, 'ENG-2', 'B421'],
  ['A', 'Tuesday', 520, 'PE-2', 'FLD', ],
  ['A', 'Tuesday', 580, 'PSHE-1', 'B420'],
  ['A', 'Tuesday', 640, 'CS-1', 'B323'],
  ['A', 'Tuesday', 870, 'IT-1', 'B324'],
  ['A', 'Thursday', 520, 'BIO-2', 'B216'],
  ['A', 'Friday', 625, 'IT-1', 'B324'],
  ['B', 'Tuesday', 640, 'CHE-1', 'B209'],
  ['B', 'Wednesday', 750, 'PHY-3', 'B211'],
  ['B', 'Thursday', 810, 'PHY-3', 'B211'],
  ['B', 'Friday', 625, 'MATH-9', 'B308'],
  ['B', 'Friday', 720, 'ENG-2', 'B421'],
];
let ziBad = 0;
for (const [week, day, time, classId, roomId] of ZI_EXPECTED) {
  const lesson = getStudentExpectedClass(SCHOOL_DATA, zichun.studentId, { week, day, time });
  const ok = lesson && lesson.block.classId === classId && lesson.block.roomId === roomId;
  if (!ok) {
    ziBad++;
    console.log(`   mismatch: ${week} ${day} ${formatTime(time)} expected ${classId}@${roomId}, got ${lesson ? `${lesson.block.classId}@${lesson.block.roomId}` : 'none'}`);
  }
}
check('Zichun timetable matches the iSAMS print (spot checks)', ziBad === 0, `${ziBad} mismatches`);

/* 5. central grid has parallel classes */
const at0847 = getCurrentTimetableBlock(SCHOOL_DATA, { week: 'A', day: 'Monday', time: 8 * 60 + 47 });
check('Multiple parallel classes at Week A Monday 08:47', at0847.length >= 5, `${at0847.length} classes`);

/* 6. Friday structure differs */
const monP1 = blocks.find((b) => b.week === 'A' && b.day === 'Monday' && b.classId === 'CHE-1')!;
const friP1 = blocks.find((b) => b.week === 'A' && b.day === 'Friday' && b.classId === 'AM-2')!;
check('Friday blocks shorter than Monday', friP1.endTime - friP1.startTime < monP1.endTime - monP1.startTime,
  `Mon ${monP1.endTime - monP1.startTime}min vs Fri ${friP1.endTime - friP1.startTime}min`);

/* 7. every student has a timetable every day, no double-booking */
{
  let empty = 0;
  let overlaps = 0;
  for (const s of STUDENTS) {
    for (const week of ['A', 'B'] as Week[]) {
      for (const day of DAYS) {
        const tt = getStudentTimetable(SCHOOL_DATA, s.studentId, week, day).filter((l) => !l.block.classId.startsWith('HR-'));
        if (tt.length < 3) empty++;
        for (let i = 1; i < tt.length; i++) {
          if (tt[i].block.startTime < tt[i - 1].block.endTime) overlaps++;
        }
      }
    }
  }
  check('Every student has lessons every day', empty === 0, `${empty} empty days`);
  check('No student is expected in two places at once', overlaps === 0, `${overlaps} overlaps`);
}

/* 8. class rolls */
const che1 = getExpectedStudents(SCHOOL_DATA, 'CHE-1', 'A');
const eng4 = getExpectedStudents(SCHOOL_DATA, 'ENG-4', 'A');
const eng2 = getExpectedStudents(SCHOOL_DATA, 'ENG-2', 'A');
check('CHE-1 has a realistic roll (both demo students)', che1.length >= 20 && che1.some((s) => s.studentId === shuMin.studentId) && che1.some((s) => s.studentId === zichun.studentId), `${che1.length} students`);
check('ENG-4 (Shu Min English) excludes Zichun', eng4.some((s) => s.studentId === shuMin.studentId) && !eng4.some((s) => s.studentId === zichun.studentId), `${eng4.length} students`);
check('ENG-2 (Zichun English) excludes Shu Min', eng2.some((s) => s.studentId === zichun.studentId) && !eng2.some((s) => s.studentId === shuMin.studentId), `${eng2.length} students`);

/* 9. room validation */
{
  const ok = validateStudentRoom(SCHOOL_DATA, shuMin.studentId, { week: 'A', day: 'Monday', time: 8 * 60 + 47 }, 'B209');
  check('Shu Min accepted in B209 at Mon 08:47', ok.valid, ok.reason);
  const bad = validateStudentRoom(SCHOOL_DATA, shuMin.studentId, { week: 'A', day: 'Monday', time: 8 * 60 + 47 }, 'B421');
  check('Shu Min rejected in B421 (Zichun English room)', !bad.valid, bad.reason);
}

/* 10. attendance maths */
check('On time = PRESENT', calculateAttendanceStatus(520, 520) === 'PRESENT');
check('08:47 vs 08:40 = LATE 7 min', calculateAttendanceStatus(527, 520) === 'LATE' && calculateLateMinutes(527, 520) === 7);

/* 11. absence at lesson end */
{
  const lesson = getStudentExpectedClass(SCHOOL_DATA, shuMin.studentId, { week: 'A', day: 'Monday', time: 8 * 60 + 47 })!;
  const expected = getExpectedStudents(SCHOOL_DATA, lesson.block.classId, 'A').map((s) => s.studentId);
  const created = markAbsentStudents(expected, [], lesson.block);
  check('All CHE-1 students marked ABSENT at lesson end', created.length === expected.length, `${created.length}/${expected.length}`);
}

/* 12. weeks differ */
{
  const a = getStudentTimetable(SCHOOL_DATA, shuMin.studentId, 'A', 'Monday');
  const b = getStudentTimetable(SCHOOL_DATA, shuMin.studentId, 'B', 'Monday');
  const same = a.length === b.length && a.every((l, i) => l.block.classId === b[i]?.block.classId);
  check('Week A and Week B timetables differ', !same);
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`);
process.exit(failures === 0 ? 0 : 1);
