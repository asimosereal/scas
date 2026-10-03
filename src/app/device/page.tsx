'use client';

/**
 * DEVICE SIMULATOR
 * ==================================================================
 * Two clearly separated surfaces:
 *   1. The operational terminal — what a real classroom device shows.
 *   2. Simulation controls — the clock, identity, failure scenarios and
 *      engine prediction used to drive the prototype. These are hidden
 *      by default and revealed on demand (progressive disclosure) so the
 *      terminal never looks like a developer console.
 *
 * None of the controls mutate the underlying timetable.
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
  Play20Filled,
  Timer20Regular,
  Wifi1Regular,
} from '@fluentui/react-icons';
import { KV, PageHeader, ScanResultBadge, Section, StatusPill } from '@/components/ui';
import { Select } from '@/components/Select';
import { useSim } from '@/lib/store/sim-store';
import { formatDuration, formatTime, toMinutes } from '@/lib/time';
import { DEMO_STUDENT_IDS, getStudentGroup } from '@/lib/data/students';
import { DAYS } from '@/lib/types';
import { FACE_VERIFY_THRESHOLD } from '@/lib/engine/identity-engine';
import { calculateAttendanceStatus, calculateLateMinutes } from '@/lib/engine/attendance-engine';

export default function DeviceSimulatorPage() {
  const { state, dispatch, runScan, data, expectedLesson, validation, roomBlock, breakState, toggleBreak } =
    useSim();
  const [timeInput, setTimeInput] = useState(formatTime(state.time));
  const [dateInput, setDateInput] = useState(state.date);
  const [showControls, setShowControls] = useState(true);

  const sc = state.sim.scenario;
  const terminal = state.terminals.find((t) => t.roomId === state.sim.roomId);
  const roomLesson = roomBlock;

  const simStudent = data.students.find((s) => s.studentId === state.sim.studentId);
  const isEventMode = terminal?.mode === 'EVENT';
  const onBreak = breakState[state.sim.studentId ?? '']?.onBreak ?? false;
  const hasRecord = state.attendance.some(
    (r) => r.studentId === state.sim.studentId && r.blockId === roomBlock?.blockId,
  );

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

  const setClockBy = (delta: number) => {
    const next = Math.max(0, Math.min(24 * 60 - 1, state.time + delta));
    dispatch({ type: 'SET_CLOCK', patch: { time: next } });
    setTimeInput(formatTime(next));
  };

  return (
    <>
      <PageHeader
        title="Device Simulator"
        subtitle="The classroom terminal is the operational view. Simulation controls drive the prototype."
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
            <Button
              appearance={showControls ? 'primary' : 'outline'}
              onClick={() => setShowControls((v) => !v)}
            >
              {showControls ? 'Hide simulation controls' : 'Open simulation controls'}
            </Button>
            <Button appearance="primary" icon={<Play20Filled />} onClick={runScan}>
              Simulate RFID tap
            </Button>
          </>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showControls
            ? 'minmax(320px, 440px) minmax(380px, 1fr)'
            : 'minmax(320px, 520px)',
          gap: 20,
          alignItems: 'start',
          justifyContent: showControls ? 'start' : 'center',
        }}
      >
        {/* ================= OPERATIONAL TERMINAL ================= */}
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
              SCAS terminal
            </Text>
            <span className="scas-spacer" />
            <span
              className={`scas-dot scas-dot-${
                isEventMode
                  ? 'event'
                  : terminal?.status === 'ONLINE'
                    ? 'online'
                    : 'offline'
              }`}
            />
            <Text size={200} weight="semibold">
              {isEventMode ? 'Event mode' : terminal?.status ?? 'Offline'}
            </Text>
          </div>

          <div style={{ padding: 14, display: 'grid', gap: 14 }}>
            {/* Room + lesson */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div className="scas-caption" style={{ marginBottom: 2 }}>
                  Room
                </div>
                <Text size={500} weight="semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {state.sim.roomId}
                </Text>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div className="scas-caption" style={{ marginBottom: 2 }}>
                  Lesson
                </div>
                <Text size={300} weight="semibold">
                  {roomLesson
                    ? data.classes.find((c) => c.classId === roomLesson.classId) &&
                      data.subjects.find(
                        (x) =>
                          x.subjectId ===
                          data.classes.find((c) => c.classId === roomLesson.classId)!.subjectId,
                      )?.abbreviation
                    : '—'}
                </Text>
              </div>
            </div>

            {/* Camera */}
            <div>
              <div className="scas-caption" style={{ marginBottom: 4 }}>
                Camera
              </div>
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
                    letterSpacing: '0.02em',
                  }}
                >
                  <Camera16Regular />
                  {sc.cameraFailure ? 'Camera fault' : 'Live preview (simulated)'}
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
                      state.sim.faceConfidence >= FACE_VERIFY_THRESHOLD ? '#6fdc8c' : '#ffd479',
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
                  RFID reader
                </Text>
                <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {sc.forgottenCard ? 'No card — awaiting manual ID' : state.sim.typedStudentNumber || 'No card'}
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
                {sc.forgottenCard ? 'ID only' : 'Ready'}
              </Text>
            </div>

            {/* Network */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
              <Wifi1Regular
                style={{
                  color: sc.networkFailure
                    ? 'var(--colorPaletteRedForeground1)'
                    : 'var(--colorPaletteGreenForeground1)',
                }}
              />
              <Text size={200} weight="semibold">
                Network
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
                {sc.networkFailure ? 'Offline' : 'Online'}
              </Text>
            </div>

            {/* Primary action + break */}
            <Button
              appearance="primary"
              size="large"
              icon={<Play20Filled />}
              onClick={runScan}
              style={{ width: '100%' }}
            >
              Simulate RFID tap
            </Button>
            {hasRecord && (
              <Button
                appearance="outline"
                icon={<Timer20Regular />}
                onClick={() => toggleBreak(state.sim.studentId!)}
                style={{ width: '100%' }}
              >
                {onBreak ? 'End break' : 'Begin break'}
              </Button>
            )}
          </div>
        </Card>

        {/* ================= SIMULATION CONTROLS ================= */}
        {showControls && (
          <Card appearance="outline" style={{ padding: 0 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
              <Text weight="semibold" size={300}>
                Simulation controls
              </Text>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 4 }}>
              {/* Clock */}
              <Section title="Simulation clock" description="Drives every screen — never uses the computer clock">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
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
              </Section>

              <Divider style={{ margin: '12px 0' }} />

              {/* Identity + room */}
              <Section title="Simulation inputs" description="Student and terminal under test">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 14,
                  }}
                >
                  <Field label="Student" style={{ display: 'grid', gap: 4 }}>
                    <Select
                      value={state.sim.studentId ?? ''}
                      options={data.students.map((s) => ({
                        key: s.studentId,
                        text: `${s.name} — ${s.studentNumber} (${getStudentGroup(s.studentId)})${
                          DEMO_STUDENT_IDS.includes(s.studentId) ? ' ★' : ''
                        }`,
                      }))}
                      onChange={(v) => {
                        const s = data.students.find((x) => x.studentId === v);
                        dispatch({
                          type: 'SET_SIM',
                          patch: { studentId: v, typedStudentNumber: s?.studentNumber ?? '' },
                        });
                      }}
                    />
                  </Field>

                  <Field label="Student ID (editable)" style={{ display: 'grid', gap: 4 }}>
                    <Input
                      value={state.sim.typedStudentNumber}
                      onChange={(_, d) =>
                        dispatch({ type: 'SET_SIM', patch: { typedStudentNumber: d.value } })
                      }
                    />
                  </Field>

                  <Field label="Classroom / terminal" style={{ display: 'grid', gap: 4 }}>
                    <Select
                      value={state.sim.roomId}
                      options={data.rooms.map((r) => ({ key: r.roomId, text: r.roomName }))}
                      onChange={(v) => dispatch({ type: 'SET_SIM', patch: { roomId: v } })}
                    />
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
              </Section>

              <Divider style={{ margin: '12px 0' }} />

              {/* Scenarios */}
              <Section title="Advanced scenarios" description="Each flag exercises a specific branch of the engine">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
              </Section>

              <Divider style={{ margin: '12px 0' }} />

              {/* Engine prediction */}
              <Section title="Engine prediction" description="What the algorithm will decide at the current settings">
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
                      [
                        'Expected lesson',
                        `${prediction.lesson.subject.name} · ${prediction.lesson.class.classId}`,
                      ],
                      [
                        'Lesson window',
                        `${formatTime(prediction.lesson.block.startTime)} – ${formatTime(prediction.lesson.block.endTime)}`,
                      ],
                      ['Predicted status', <StatusPill status={prediction.status} key="s" />],
                      [
                        'Late duration',
                        prediction.late > 0 ? formatDuration(prediction.late) : 'none',
                      ],
                      ['Identity', `${simStudent?.name} · card ${state.sim.typedStudentNumber}`],
                      [
                        'Face verification',
                        sc.wrongFace
                          ? 'Review required (52%)'
                          : sc.cameraFailure
                            ? 'Camera unavailable — RFID only'
                            : state.sim.faceConfidence >= FACE_VERIFY_THRESHOLD
                              ? `Verified (${state.sim.faceConfidence}%)`
                              : `Review required (${state.sim.faceConfidence}%)`,
                      ],
                    ]}
                  />
                ) : (
                  <Text style={{ color: 'var(--colorNeutralForeground3)' }}>
                    This student has no expected lesson at {formatTime(state.time)} — a tap will be
                    treated as a free period.
                  </Text>
                )}
              </Section>

              <Divider style={{ margin: '12px 0' }} />

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
                                <ScanResultBadge result={s.result} />
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
          </Card>
        )}
      </div>

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
          style={{ marginTop: 16, maxWidth: 720 }}
        >
          <MessageBarBody>{state.terminalMessage.text}</MessageBarBody>
        </MessageBar>
      )}
    </>
  );
}

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
