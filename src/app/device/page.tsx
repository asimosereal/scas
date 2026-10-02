'use client';

/**
 * DEVICE SIMULATOR
 * ==================================================================
 * The most important screen for testing the algorithms. It presents a
 * realistic virtual SCAS classroom terminal plus a separate bank of
 * simulation controls (week / day / date / time / student / room /
 * network / face confidence / advanced scenarios).
 *
 * None of these controls mutate the underlying timetable.
 */

import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Divider,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Slider,
  Switch,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import {
  ArrowClockwise16Regular,
  Camera16Regular,
  ContactCard20Regular,
  ErrorCircle16Regular,
  Play16Filled,
  Wifi1Regular,
} from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatusPill } from '@/components/ui';
import { ScanResultPill } from '@/components/ScanResultPill';
import { useSim } from '@/lib/store/sim-store';
import { formatDuration, formatTime, toMinutes } from '@/lib/time';
import { DEMO_STUDENT_IDS, getStudentGroup } from '@/lib/data/students';
import { DAYS } from '@/lib/types';
import { FACE_VERIFY_THRESHOLD } from '@/lib/engine/identity-engine';
import { calculateAttendanceStatus, calculateLateMinutes } from '@/lib/engine/attendance-engine';

export default function DeviceSimulatorPage() {
  const { state, dispatch, runScan, data, expectedLesson, validation, roomBlock } = useSim();
  const [timeInput, setTimeInput] = useState(formatTime(state.time));
  const [dateInput, setDateInput] = useState(state.date);

  const sc = state.sim.scenario;
  const terminal = state.terminals.find((t) => t.roomId === state.sim.roomId);
  const roomLesson = roomBlock;

  const simStudent = data.students.find((s) => s.studentId === state.sim.studentId);
  const isEventMode = terminal?.mode === 'EVENT';

  /* Predicted outcome, computed live from the engine — shown BEFORE the
     tap so the tester can see what the algorithm will decide. */
  const prediction = useMemo(() => {
    if (!expectedLesson) return null;
    const status = calculateAttendanceStatus(state.time, expectedLesson.block.startTime);
    const late = calculateLateMinutes(state.time, expectedLesson.block.startTime);
    return { status, late, lesson: expectedLesson };
  }, [expectedLesson, state.time]);

  const setScenario = (patch: Partial<typeof sc>) =>
    dispatch({ type: 'SET_SCENARIO', patch });

  return (
    <>
      <PageHeader
        title="Device Simulator"
        subtitle="Virtual SCAS classroom terminal and the full simulation control bank."
        actions={
          <>
            <Button
              appearance="outline"
              icon={<ArrowClockwise16Regular />}
              onClick={() => {
                setTimeInput('08:47');
                dispatch({ type: 'SET_CLOCK', patch: { time: toMinutes('08:47'), running: false } });
              }}
            >
              Reset clock to 08:47
            </Button>
            <Button appearance="primary" icon={<Play16Filled />} onClick={runScan}>
              Simulate RFID tap
            </Button>
          </>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(340px, 420px) minmax(420px, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* ================= TERMINAL ================= */}
        <div>
          <Card appearance="outline" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--colorNeutralBackground2)',
                borderBottom: '1px solid var(--colorNeutralStroke2)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text weight="semibold" size={200}>
                SCAS TERMINAL
              </Text>
              <span className="scas-spacer" />
              <span className={`scas-dot scas-dot-${isEventMode ? 'event' : terminal?.status === 'ONLINE' ? 'online' : 'offline'}`} />
              <Text size={200} weight="semibold">
                {isEventMode ? 'EVENT MODE' : terminal?.status ?? 'OFFLINE'}
              </Text>
            </div>

            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              {/* Room */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Text size={100} style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
                    ROOM
                  </Text>
                  <Text size={500} weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {state.sim.roomId}
                  </Text>
                </div>
                <div style={{ flex: 1 }}>
                  <Text size={100} style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em' }}>
                    LESSON
                  </Text>
                  <Text size={300} weight="semibold">
                    {roomLesson
                      ? data.classes.find((c) => c.classId === roomLesson.classId)
                        && data.subjects.find(
                            (x) => x.subjectId === data.classes.find((c) => c.classId === roomLesson.classId)!.subjectId,
                          )?.abbreviation
                      : '—'}
                  </Text>
                </div>
              </div>

              {/* Camera */}
              <div>
                <Text size={100} style={{ color: 'var(--colorNeutralForeground3)', letterSpacing: '0.06em', marginBottom: 4 }}>
                  CAMERA
                </Text>
                <div className={`scas-camera${sc.cameraFailure || !state.sim.networkOnline ? ' is-offline' : ''}`}>
                  <div className="scas-camera-grid" />
                  <div className="scas-camera-frame">
                    <div className="scas-camera-silhouette" />
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      bottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.8)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    <Camera16Regular />
                    {sc.cameraFailure ? 'CAMERA FAULT' : 'LIVE PREVIEW (SIMULATED)'}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      fontSize: 11,
                      fontVariantNumeric: 'tabular-nums',
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.45)',
                      color:
                        state.sim.faceConfidence >= FACE_VERIFY_THRESHOLD
                          ? '#6fdc8c'
                          : '#ffd479',
                    }}
                  >
                    {state.sim.faceConfidence}%
                  </div>
                </div>
              </div>

              {/* RFID */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--borderRadiusMedium)',
                  background: 'var(--colorNeutralBackground2)',
                }}
              >
                <ContactCard20Regular style={{ color: 'var(--colorBrandForeground1)' }} />
                <div style={{ flex: 1 }}>
                  <Text size={200} weight="semibold">
                    RFID READER
                  </Text>
                  <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    {sc.forgottenCard ? 'NO CARD — AWAITING MANUAL ID' : state.sim.typedStudentNumber || 'NO CARD'}
                  </Text>
                </div>
                <Text
                  size={200}
                  weight="semibold"
                  style={{
                    color: sc.forgottenCard
                      ? 'var(--colorPaletteMarigoldForeground1)'
                      : 'var(--colorPaletteGreenForeground1)',
                  }}
                >
                  {sc.forgottenCard ? 'ID ONLY' : 'READY'}
                </Text>
              </div>

              {/* Network */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                }}
              >
                <Wifi1Regular
                  style={{
                    color: sc.networkFailure
                      ? 'var(--colorPaletteRedForeground1)'
                      : 'var(--colorPaletteGreenForeground1)',
                  }}
                />
                <Text size={200} weight="semibold">
                  NETWORK
                </Text>
                <span className="scas-spacer" />
                <Text
                  size={200}
                  style={{
                    color: sc.networkFailure
                      ? 'var(--colorPaletteRedForeground1)'
                      : 'var(--colorPaletteGreenForeground1)',
                    fontWeight: 600,
                  }}
                >
                  {sc.networkFailure ? 'OFFLINE' : 'ONLINE'}
                </Text>
              </div>

              {/* Tap button */}
              <Button
                appearance="primary"
                size="large"
                icon={<Play16Filled />}
                onClick={runScan}
                style={{ width: '100%' }}
              >
                Simulate RFID tap
              </Button>
            </div>
          </Card>

          {/* Terminal feedback */}
          {state.terminalMessage && (
            <MessageBar
              intent={
                state.terminalMessage.tone === 'success'
                  ? 'success'
                  : state.terminalMessage.tone === 'error'
                    ? 'error'
                    : state.terminalMessage.tone === 'warning'
                      ? 'warning'
                      : 'info'
              }
              style={{ marginTop: 12 }}
            >
              <MessageBarBody>{state.terminalMessage.text}</MessageBarBody>
            </MessageBar>
          )}
        </div>

        {/* ================= SIMULATION CONTROLS ================= */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Clock */}
          <Section title="Simulation clock" description="Drives every screen — never uses the computer clock">
            <Card appearance="outline" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 14,
                }}
              >
                <Field label="Week" style={{ display: 'grid', gap: 4 }}>
                  <div className="scas-row-tight">
                    {(['A', 'B'] as const).map((w) => (
                      <Button
                        key={w}
                        appearance={state.week === w ? 'primary' : 'outline'}
                        size="small"
                        onClick={() => dispatch({ type: 'SET_CLOCK', patch: { week: w } })}
                      >
                        Week {w}
                      </Button>
                    ))}
                  </div>
                </Field>

                <Field label="Day" style={{ display: 'grid', gap: 4 }}>
                  <div className="scas-row-tight">
                    {DAYS.map((d) => (
                      <Button
                        key={d}
                        appearance={state.day === d ? 'primary' : 'outline'}
                        size="small"
                        onClick={() => dispatch({ type: 'SET_CLOCK', patch: { day: d } })}
                      >
                        {d.slice(0, 3)}
                      </Button>
                    ))}
                  </div>
                </Field>

                <Field label="Date" style={{ display: 'grid', gap: 4 }}>
                  <Input
                    value={dateInput}
                    onChange={(_, d) => setDateInput(d.value)}
                    onBlur={() => dispatch({ type: 'SET_CLOCK', patch: { date: dateInput } })}
                    style={{ width: 140 }}
                  />
                </Field>

                <Field label="Time" style={{ display: 'grid', gap: 4 }}>
                  <Input
                    value={timeInput}
                    onChange={(_, d) => setTimeInput(d.value)}
                    onBlur={() => {
                      const m = /^(\d{1,2}):(\d{2})$/.exec(timeInput.trim());
                      if (m) {
                        const mins = Math.min(24 * 60 - 1, Number(m[1]) * 60 + Number(m[2]));
                        dispatch({ type: 'SET_CLOCK', patch: { time: mins } });
                      } else {
                        setTimeInput(formatTime(state.time));
                      }
                    }}
                    style={{ width: 120 }}
                  />
                </Field>
              </div>

              <Divider style={{ margin: '14px 0' }} />

              <div className="scas-row">
                <Text
                  size={200}
                  style={{ fontVariantNumeric: 'tabular-nums', minWidth: 62, fontWeight: 600 }}
                >
                  {formatTime(state.time)}
                </Text>
                <Button size="small" appearance="outline" onClick={() => setClockBy(-1)}>
                  −1 min
                </Button>
                <Button size="small" appearance="outline" onClick={() => setClockBy(1)}>
                  +1 min
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  onClick={() => dispatch({ type: 'SET_CLOCK', patch: { time: toMinutes('08:47') } })}
                >
                  Reset
                </Button>
                <Tooltip content="Advance one minute per second" relationship="label" withArrow>
                  <Switch
                    checked={state.running}
                    label="Run clock"
                    onChange={(_, d) =>
                      dispatch({ type: 'SET_CLOCK', patch: { running: d.checked } })
                    }
                  />
                </Tooltip>
              </div>
            </Card>
          </Section>

          {/* Identity + room */}
          <Section title="Simulation inputs" description="Student and terminal under test">
            <Card appearance="outline" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                <Field label="Student" style={{ display: 'grid', gap: 4 }}>
                  <select
                    value={state.sim.studentId ?? ''}
                    onChange={(e) => {
                      const s = data.students.find((x) => x.studentId === e.target.value);
                      dispatch({
                        type: 'SET_SIM',
                        patch: {
                          studentId: e.target.value,
                          typedStudentNumber: s?.studentNumber ?? '',
                        },
                      });
                    }}
                    style={selectStyle}
                  >
                    {data.students.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.name} — {s.studentNumber} ({getStudentGroup(s.studentId)})
                        {DEMO_STUDENT_IDS.includes(s.studentId) ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Student ID (editable)"
                  style={{ display: 'grid', gap: 4 }}
                >
                  <Input
                    value={state.sim.typedStudentNumber}
                    onChange={(_, d) =>
                      dispatch({ type: 'SET_SIM', patch: { typedStudentNumber: d.value } })
                    }
                  />
                </Field>

                <Field label="Classroom / Terminal" style={{ display: 'grid', gap: 4 }}>
                  <select
                    value={state.sim.roomId}
                    onChange={(e) => dispatch({ type: 'SET_SIM', patch: { roomId: e.target.value } })}
                    style={selectStyle}
                  >
                    {data.rooms.map((r) => (
                      <option key={r.roomId} value={r.roomId}>
                        {r.roomName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Divider style={{ margin: '14px 0' }} />

              <div style={{ maxWidth: 420 }}>
                <Field
                  label={`Face verification confidence — ${state.sim.faceConfidence}% (threshold ${FACE_VERIFY_THRESHOLD}%)`}
                >
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={state.sim.faceConfidence}
                    onChange={(_, d) =>
                      dispatch({ type: 'SET_SIM', patch: { faceConfidence: d.value } })
                    }
                  />
                </Field>
              </div>
            </Card>
          </Section>

          {/* Scenarios */}
          <Section title="Advanced scenarios" description="Each flag exercises a specific branch of the engine">
            <Card appearance="outline" style={{ padding: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '10px 20px',
                }}
              >
                <ScenarioCheck
                  label="Duplicate scan"
                  hint="Tap twice for the same lesson"
                  checked={sc.duplicateScan}
                  onChange={(v) => setScenario({ duplicateScan: v })}
                />
                <ScenarioCheck
                  label="Wrong face"
                  hint="Forces confidence to 52%"
                  checked={sc.wrongFace}
                  onChange={(v) => setScenario({ wrongFace: v })}
                />
                <ScenarioCheck
                  label="Forgotten card"
                  hint="Falls back to ID + backup PIN"
                  checked={sc.forgottenCard}
                  onChange={(v) => setScenario({ forgottenCard: v })}
                />
                <ScenarioCheck
                  label="Camera failure"
                  hint="No face data available"
                  checked={sc.cameraFailure}
                  onChange={(v) => setScenario({ cameraFailure: v })}
                />
                <ScenarioCheck
                  label="Network failure"
                  hint="Queues scans locally for sync"
                  checked={sc.networkFailure}
                  onChange={(v) => setScenario({ networkFailure: v })}
                />
                <ScenarioCheck
                  label="Student not expected in room"
                  hint="Redirects the tap to the wrong room"
                  checked={sc.notExpectedInRoom}
                  onChange={(v) => setScenario({ notExpectedInRoom: v })}
                />
              </div>
            </Card>
          </Section>

          {/* Engine prediction */}
          <Section title="Engine prediction" description="What the algorithm will decide at the current settings">
            <Card appearance="outline" style={{ padding: 16 }}>
              {validation && !validation.valid ? (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <ErrorCircle16Regular style={{ color: 'var(--colorPaletteRedForeground1)', marginTop: 2 }} />
                  <div>
                    <Text weight="semibold" style={{ color: 'var(--colorPaletteRedForeground1)' }}>
                      {validation.message}
                    </Text>
                    {validation.expectedLesson && (
                      <Text
                        size={200}
                        style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}
                      >
                        Expected instead: {validation.expectedLesson.subject.name} in{' '}
                        {validation.expectedLesson.room.roomName}
                      </Text>
                    )}
                  </div>
                </div>
              ) : prediction ? (
                <KV
                  items={[
                    ['Expected lesson', `${prediction.lesson.subject.name} · ${prediction.lesson.class.classId}`],
                    ['Lesson window', `${formatTime(prediction.lesson.block.startTime)} – ${formatTime(prediction.lesson.block.endTime)}`],
                    [
                      'Predicted status',
                      <StatusPill status={prediction.status} key="s" />,
                    ],
                    [
                      'Late duration',
                      prediction.late > 0 ? formatDuration(prediction.late) : 'none',
                    ],
                    ['Identity', `${simStudent?.name} · card ${state.sim.typedStudentNumber}`],
                    [
                      'Face verification',
                      sc.wrongFace
                        ? 'REVIEW REQUIRED (52%)'
                        : sc.cameraFailure
                          ? 'CAMERA UNAVAILABLE — RFID only'
                          : state.sim.faceConfidence >= FACE_VERIFY_THRESHOLD
                            ? `VERIFIED (${state.sim.faceConfidence}%)`
                            : `REVIEW REQUIRED (${state.sim.faceConfidence}%)`,
                    ],
                  ]}
                />
              ) : (
                <Text style={{ color: 'var(--colorNeutralForeground3)' }}>
                  This student has no expected lesson at {formatTime(state.time)} — a tap will be
                  treated as a free period.
                </Text>
              )}
            </Card>
          </Section>

          {/* Recent scans at this terminal */}
          <Section title="Scan log" description="Most recent events from this terminal">
            <div className="scas-table-scroll">
              <table className="scas-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Student</th>
                    <th>Result</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {state.scans.filter((s) => s.terminalId === terminal?.terminalId).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ color: 'var(--colorNeutralForeground3)' }}>
                        No scans from this terminal yet.
                      </td>
                    </tr>
                  )}
                  {state.scans
                    .filter((s) => s.terminalId === terminal?.terminalId)
                    .slice(0, 12)
                    .map((s) => {
                      const stu = data.students.find((x) => x.studentId === s.studentId);
                      return (
                        <tr key={s.scanId}>
                          <td className="scas-mono">{formatTime(s.timestamp)}</td>
                          <td>
                            {stu ? `${stu.name} (${stu.studentNumber})` : <em>unrecognised</em>}
                          </td>
                          <td>
                            <ScanResultPill result={s.result} />
                          </td>
                          <td className="num scas-mono">
                            {s.verificationConfidence !== null ? `${s.verificationConfidence}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </>
  );

  function setClockBy(delta: number) {
    const next = Math.max(0, Math.min(24 * 60 - 1, state.time + delta));
    dispatch({ type: 'SET_CLOCK', patch: { time: next } });
    setTimeInput(formatTime(next));
  }
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 8px',
  borderRadius: 'var(--borderRadiusMedium)',
  border: '1px solid var(--colorNeutralStroke1)',
  background: 'var(--colorNeutralBackground1)',
  color: 'var(--colorNeutralForeground1)',
  fontSize: 13,
  fontFamily: 'inherit',
};

function ScenarioCheck({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'pointer',
        padding: '4px 0',
      }}
    >
      <Checkbox checked={checked} onChange={(_, d) => onChange(!!d.checked)} />
      <span>
        <Text size={200} weight="semibold" style={{ display: 'block' }}>
          {label}
        </Text>
        <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
          {hint}
        </Text>
      </span>
    </label>
  );
}
