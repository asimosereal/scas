'use client';

/**
 * EMERGENCY / EVENT MODE
 * ==================================================================
 * The Office user creates an event, selects terminals and activates it.
 * While a terminal is in EVENT mode, student movement is written to a
 * SEPARATE log so ordinary lesson attendance is never corrupted.
 */

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Radio,
  Text,
} from '@fluentui/react-components';
import {
  Warning20Regular,
  ShieldTask16Regular,
  Dismiss16Regular,
} from '@fluentui/react-icons';
import { KV, PageHeader, Section, StatGrid, StatTile, TerminalPill } from '@/components/ui';
import { useSim } from '@/lib/store/sim-store';
import { formatTime } from '@/lib/time';
import type { EventType, ScasEvent } from '@/lib/types';

const EVENT_TYPES: { value: EventType; label: string; description: string }[] = [
  {
    value: 'FIRE_EVACUATION',
    label: 'Fire evacuation',
    description: 'All selected terminals evacuate. Movement tracked separately from lessons.',
  },
  {
    value: 'EMERGENCY_LEAVE',
    label: 'Emergency leave',
    description: 'Students leaving site are logged against the active event.',
  },
  {
    value: 'MASS_MOVEMENT',
    label: 'Mass student movement',
    description: 'Large-scale relocation between rooms under event supervision.',
  },
];

export default function EventsPage() {
  const { state, dispatch, data } = useSim();
  const [name, setName] = useState('Fire Evacuation');
  const [type, setType] = useState<EventType>('FIRE_EVACUATION');
  const [selected, setSelected] = useState<string[]>(
    state.terminals.slice(0, 4).map((t) => t.terminalId),
  );
  const [eventSeq, setEventSeq] = useState(1);

  const active = state.events.filter((e) => e.active);
  const past = state.events.filter((e) => !e.active);

  const terminalsInEvent = useMemo(
    () => state.terminals.filter((t) => t.mode === 'EVENT'),
    [state.terminals],
  );

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const activate = () => {
    const ev: ScasEvent = {
      eventId: `EVT-${Date.now().toString(36)}-${eventSeq}`,
      eventName: name,
      eventType: type,
      createdBy: 'OFFICE',
      week: state.week,
      day: state.day,
      startTime: state.time,
      endTime: null,
      active: true,
      terminalIds: selected,
    };
    setEventSeq((n) => n + 1);
    dispatch({ type: 'ACTIVATE_EVENT', event: ev });
  };

  const endEvent = (id: string) => dispatch({ type: 'END_EVENT', eventId: id });

  const movementsByEvent = useMemo(() => {
    const map = new Map<string, number>();
    state.movements.forEach((m) => map.set(m.eventId, (map.get(m.eventId) ?? 0) + 1));
    return map;
  }, [state.movements]);

  return (
    <>
      <PageHeader
        title="Emergency & Event Mode"
        subtitle="Activate an event across selected terminals. Movement is recorded separately from lesson attendance."
      />

      {active.length > 0 && (
        <MessageBar intent="warning" style={{ marginBottom: 20 }}>
          <MessageBarBody>
            <MessageBarTitle>
              {active.length} event{active.length === 1 ? '' : 's'} active
            </MessageBarTitle>
            {active.map((e) => (
              <div key={e.eventId}>
                {e.eventName} — {terminalsInEvent.length} terminal
                {terminalsInEvent.length === 1 ? '' : 's'} switched to event mode. Ordinary
                attendance records are untouched; use the Device Simulator to record movement.
              </div>
            ))}
          </MessageBarBody>
        </MessageBar>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: 20, alignItems: 'start' }}>
        {/* ---------------- Create event ---------------- */}
        <Card appearance="outline" style={{ padding: 16 }}>
          <div className="scas-row" style={{ marginBottom: 12 }}>
            <Warning20Regular style={{ color: 'var(--colorPaletteMarigoldForeground1)' }} />
            <Text weight="semibold" size={300}>
              Create event
            </Text>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <Field label="Event name">
              <Input value={name} onChange={(_, d) => setName(d.value)} />
            </Field>

            <div style={{ display: 'grid', gap: 6 }}>
              <Text size={200} weight="semibold">
                Event type
              </Text>
              {EVENT_TYPES.map((t) => (
                <label
                  key={t.value}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '8px 10px',
                    borderRadius: 'var(--borderRadiusMedium)',
                    border: `1px solid ${
                      type === t.value
                        ? 'var(--colorBrandStroke1)'
                        : 'var(--colorNeutralStroke2)'
                    }`,
                    background:
                      type === t.value
                        ? 'var(--colorNeutralBackground1Selected)'
                        : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <Radio
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    value={t.value}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <Text size={200} weight="semibold" style={{ display: 'block' }}>
                      {t.label}
                    </Text>
                    <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {t.description}
                    </Text>
                  </span>
                </label>
              ))}
            </div>

            <div>
              <div className="scas-row" style={{ marginBottom: 6 }}>
                <Text size={200} weight="semibold">
                  Terminals ({selected.length} selected)
                </Text>
                <span className="scas-spacer" />
                <Button
                  size="small"
                  appearance="subtle"
                  onClick={() => setSelected(state.terminals.map((t) => t.terminalId))}
                >
                  Select all
                </Button>
                <Button size="small" appearance="subtle" onClick={() => setSelected([])}>
                  Clear
                </Button>
              </div>
              <div
                className="scas-scroll-y"
                style={{
                  maxHeight: 220,
                  border: '1px solid var(--colorNeutralStroke2)',
                  borderRadius: 'var(--borderRadiusMedium)',
                  padding: 8,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 4 }}>
                  {state.terminals.map((t) => (
                    <label
                      key={t.terminalId}
                      style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
                    >
                      <Checkbox
                        checked={selected.includes(t.terminalId)}
                        onChange={() => toggle(t.terminalId)}
                      />
                      <span>
                        <Text size={200}>{t.roomId}</Text>
                        <Text size={100} style={{ color: 'var(--colorNeutralForeground3)' }}>
                          {t.status}
                        </Text>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <Button
              appearance="primary"
              icon={<ShieldTask16Regular />}
              onClick={activate}
              disabled={selected.length === 0}
            >
              Activate event mode
            </Button>
          </div>
        </Card>

        {/* ---------------- Active + history ---------------- */}
        <div>
          <Section title="Currently active">
            <StatGrid>
              <StatTile value={active.length} label="Active events" tone={active.length ? 'danger' : undefined} />
              <StatTile value={terminalsInEvent.length} label="Terminals in event mode" tone={terminalsInEvent.length ? 'warning' : undefined} />
              <StatTile value={state.movements.length} label="Movements recorded" />
              <StatTile value={state.attendance.filter((r) => r.status !== 'ABSENT').length} label="Attendance records (untouched)" tone="success" />
            </StatGrid>
          </Section>

          <Section title="Event log">
            <Card appearance="outline" style={{ padding: 0 }}>
              <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 400 }}>
                <table className="scas-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Type</th>
                      <th>Started</th>
                      <th>Terminals</th>
                      <th style={{ textAlign: 'right' }}>Movements</th>
                      <th style={{ textAlign: 'right' }}>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.events.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ color: 'var(--colorNeutralForeground3)' }}>
                          No events created yet.
                        </td>
                      </tr>
                    )}
                    {[...active, ...past].map((e) => (
                      <tr key={e.eventId}>
                        <td style={{ fontWeight: 500 }}>{e.eventName}</td>
                        <td>{e.eventType.replace(/_/g, ' ')}</td>
                        <td className="scas-mono">
                          {formatTime(e.startTime)}
                          {e.endTime !== null && ` – ${formatTime(e.endTime)}`}
                        </td>
                        <td className="num">{e.terminalIds.length}</td>
                        <td className="num">{movementsByEvent.get(e.eventId) ?? 0}</td>
                        <td>
                          {e.active ? (
                            <Badge appearance="filled" color="danger" size="small">
                              Active
                            </Badge>
                          ) : (
                            <Badge appearance="outline" size="small">
                              Ended
                            </Badge>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {e.active && (
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={<Dismiss16Regular />}
                              onClick={() => endEvent(e.eventId)}
                            >
                              End
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>

          <Section title="Terminals currently in event mode">
            <Card appearance="outline" style={{ padding: 0 }}>
              <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 280 }}>
                <table className="scas-table">
                  <thead>
                    <tr>
                      <th>Terminal</th>
                      <th>Room</th>
                      <th>Status</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terminalsInEvent.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--colorNeutralForeground3)' }}>
                          No terminals are in event mode.
                        </td>
                      </tr>
                    )}
                    {terminalsInEvent.map((t) => (
                      <tr key={t.terminalId}>
                        <td>{t.terminalId}</td>
                        <td style={{ fontWeight: 500 }}>{t.roomId}</td>
                        <td>
                          <TerminalPill status={t.status} />
                        </td>
                        <td>
                          <Badge appearance="filled" color="danger" size="small">
                            Event
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>

          <Section title="Movement log (separate from attendance)">
            <Card appearance="outline" style={{ padding: 0 }}>
              <div className="scas-table-scroll" style={{ border: 0, borderRadius: 0, maxHeight: 280 }}>
                <table className="scas-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Student</th>
                      <th>Terminal</th>
                      <th>Movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.movements.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ color: 'var(--colorNeutralForeground3)' }}>
                          No movements recorded. Activate an event, set the simulator room to an
                          event-mode terminal, then simulate a tap.
                        </td>
                      </tr>
                    )}
                    {state.movements.map((m) => {
                      const stu = data.students.find((s) => s.studentId === m.studentId);
                      const ev = state.events.find((e) => e.eventId === m.eventId);
                      return (
                        <tr key={m.movementId}>
                          <td className="scas-mono">{formatTime(m.timestamp)}</td>
                          <td>{ev?.eventName ?? m.eventId}</td>
                          <td>
                            {stu ? `${stu.name} (${stu.studentNumber})` : m.studentId}
                          </td>
                          <td>{m.terminalId.replace('T-', '')}</td>
                          <td>{m.movementType}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>

          <Card appearance="outline" style={{ padding: 14 }}>
            <KV
              items={[
                ['Design rule', 'Event movement never writes to ATTENDANCE.'],
                [
                  'Enforced by',
                  'sim-store runScan() — event branch returns before any attendance record is created.',
                ],
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
