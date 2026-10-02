'use client';

/**
 * APPLICATION SHELL
 * ------------------------------------------------------------------
 * A Windows 11 / Fluent 2 style shell:
 *   left navigation rail  +  command bar header  +  status strip
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tab,
  TabList,
  Text,
  Tooltip,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import {
  CalendarLtr16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  ClipboardTaskListLtrRegular,
  DataTrending24Regular,
  Desktop16Regular,
  ErrorCircle16Regular,
  Grid24Regular,
  PeopleTeam24Regular,
  Person24Regular,
  Play16Regular,
  RecordStop16Regular,
  ShieldTask16Regular,
  WeatherSunny16Regular,
  ArrowSync16Regular,
  Bug16Regular,
} from '@fluentui/react-icons';
import { DAYS } from '@/lib/types';
import { formatTime, toMinutes } from '@/lib/time';
import { useSim } from '@/lib/store/sim-store';
import { getCurrentTimetableBlock } from '@/lib/engine/timetable-engine';
import { SCHOOL_DATA } from '@/lib/data';
import { toLesson } from '@/lib/engine/timetable-engine';
import { ThemeToggle } from './ThemeToggle';

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const NAV = [
  { href: '/', label: 'Dashboard', icon: <DataTrending24Regular /> },
  { href: '/device', label: 'Device Simulator', icon: <Desktop16Regular /> },
  { href: '/teacher', label: 'Teacher', icon: <Person24Regular /> },
  { href: '/teacher/review', label: 'End-of-Day Review', icon: <ClipboardTaskListLtrRegular /> },
  { href: '/office', label: 'Office', icon: <Grid24Regular /> },
  { href: '/office/timetable', label: 'Timetable', icon: <CalendarLtr16Regular /> },
  { href: '/office/students', label: 'Students', icon: <PeopleTeam24Regular /> },
  { href: '/office/events', label: 'Events', icon: <ShieldTask16Regular /> },
  { href: '/office/terminals', label: 'Terminals', icon: <Desktop16Regular /> },
  { href: '/data', label: 'Attendance & Audit', icon: <RecordStop16Regular /> },
  { href: '/tests', label: 'Testing Panel', icon: <Bug16Regular /> },
];

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '7px 12px',
        margin: '1px 8px',
        borderRadius: 'var(--borderRadiusMedium)',
        textDecoration: 'none',
        color: active
          ? 'var(--colorNeutralForegroundOnBrand)'
          : 'var(--colorNeutralForeground1)',
        background: active ? 'var(--colorNeutralBackground1Selected)' : 'transparent',
        fontSize: 13.5,
        lineHeight: '20px',
        fontWeight: active ? 600 : 400,
        borderLeft: active
          ? '2px solid var(--colorBrandForeground1)'
          : '2px solid transparent',
        transition: 'background-color 120ms ease-out',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          color: active
            ? 'var(--colorBrandForeground1)'
            : 'var(--colorNeutralForeground2)',
        }}
      >
        {icon}
      </span>
      <span className="scas-nav-label">{label}</span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Week selector (tab-like, Fluent style)                              */
/* ------------------------------------------------------------------ */

type WeekTab = 'A' | 'B';

const WeekTabs: React.FC<{ value: WeekTab; onChange: (v: WeekTab) => void }> = ({
  value,
  onChange,
}) => {
  const onTabSelect = (_e: SelectTabEvent, data: SelectTabData) => {
    onChange(data.value as WeekTab);
  };
  return (
    <TabList
      selectedValue={value}
      onTabSelect={onTabSelect}
      size="small"
      appearance="subtle"
    >
      <Tab value="A">Week A</Tab>
      <Tab value="B">Week B</Tab>
    </TabList>
  );
};

/* ------------------------------------------------------------------ */
/* Status strip                                                        */
/* ------------------------------------------------------------------ */

function StatusStrip() {
  const { state } = useSim();
  const online = state.terminals.filter((t) => t.status === 'ONLINE').length;
  const offline = state.terminals.filter((t) => t.status === 'OFFLINE').length;
  const syncing = state.terminals.filter((t) => t.status === 'SYNCING').length;
  const queued = state.terminals.reduce((n, t) => n + t.queuedScans, 0);
  const activeEvents = state.events.filter((e) => e.active).length;

  return (
    <div
      style={{
        height: 'var(--scas-status-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '0 16px',
        borderTop: '1px solid var(--colorNeutralStroke2)',
        background: 'var(--colorNeutralBackground2)',
        fontSize: 12,
        color: 'var(--colorNeutralForeground2)',
        flexShrink: 0,
      }}
    >
      <span>
        <span className="scas-dot scas-dot-online" />
        {online} online
      </span>
      <span>
        <span className="scas-dot scas-dot-offline" />
        {offline} offline
      </span>
      {syncing > 0 && (
        <span>
          <span className="scas-dot scas-dot-syncing" />
          {syncing} syncing
        </span>
      )}
      {queued > 0 && (
        <span>
          <ArrowSync16Regular style={{ verticalAlign: '-2px', marginRight: 4 }} />
          {queued} queued scan{queued === 1 ? '' : 's'}
        </span>
      )}
      {activeEvents > 0 && (
        <span style={{ color: 'var(--colorPaletteCrimsonForeground1)', fontWeight: 600 }}>
          <span className="scas-dot scas-dot-event" />
          EVENT MODE ACTIVE
        </span>
      )}
      <span className="scas-spacer" />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        Simulation clock · {state.week} / {state.day} · {formatTime(state.time)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, dispatch, setClock, data } = useSim();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  const activeBlocks = useMemo(
    () => getCurrentTimetableBlock(data, { week: state.week, day: state.day, time: state.time }),
    [data, state.week, state.day, state.time],
  );
  const currentRoomLesson = activeBlocks.find((b) => b.roomId === state.sim.roomId);
  const lessonLabel = currentRoomLesson ? toLesson(data, currentRoomLesson) : null;

  const roleLabel =
    state.role === 'office' ? 'Office' : state.role === 'teacher' ? 'Teacher' : 'Student';

  return (
    <div className="scas-shell">
      {/* ---------------- Left navigation ---------------- */}
      <nav
        className="scas-nav"
        style={{
          background: 'var(--colorNeutralBackground2)',
          borderRight: '1px solid var(--colorNeutralStroke2)',
        }}
      >
        <div
          style={{
            height: 'var(--scas-header-height)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: 'var(--colorBrandForeground1)',
              color: 'var(--colorNeutralForegroundOnBrand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              flexShrink: 0,
            }}
          >
            SC
          </div>
          <Text
            weight={"semibold"}
            size={500}
            style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}
            className="scas-nav-label"
          >
            SCAS
          </Text>
        </div>

        <Divider style={{ opacity: 0.6 }} />

        <div style={{ paddingTop: 6, overflowY: 'auto', flex: '1 1 auto' }}>
          <Text
            size={100}
            weight={"semibold"}
            style={{
              display: 'block',
              padding: '8px 20px 4px',
              color: 'var(--colorNeutralForeground4)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
            className="scas-nav-label"
          >
            Workspace
          </Text>
          {NAV.slice(0, 4).map((n) => (
            <NavItem
              key={n.href}
              {...n}
              active={pathname === n.href}
            />
          ))}

          <Text
            size={100}
            weight={"semibold"}
            style={{
              display: 'block',
              padding: '14px 20px 4px',
              color: 'var(--colorNeutralForeground4)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
            className="scas-nav-label"
          >
            Office
          </Text>
          {NAV.slice(4, 9).map((n) => (
            <NavItem key={n.href} {...n} active={pathname === n.href} />
          ))}

          <Text
            size={100}
            weight={"semibold"}
            style={{
              display: 'block',
              padding: '14px 20px 4px',
              color: 'var(--colorNeutralForeground4)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
            className="scas-nav-label"
          >
            Records
          </Text>
          {NAV.slice(9).map((n) => (
            <NavItem key={n.href} {...n} active={pathname === n.href} />
          ))}
        </div>

        <div style={{ padding: 8, flexShrink: 0 }}>
          <Button
            appearance="subtle"
            icon={<Bug16Regular />}
            onClick={() => dispatch({ type: 'RESET_DAY' })}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <span className="scas-nav-label">Clear simulated day</span>
          </Button>
        </div>
      </nav>

      {/* ---------------- Main column ---------------- */}
      <div className="scas-main">
        {/* Command bar */}
        <header
          style={{
            height: 'var(--scas-header-height)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            background: 'var(--colorNeutralBackground1)',
            borderBottom: '1px solid var(--colorNeutralStroke2)',
            flexShrink: 0,
          }}
        >
          <Badge
            appearance="filled"
            color="brand"
            size="small"
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            {state.mode}
          </Badge>

          <div className="scas-row-tight">
            <Tooltip content="Previous day" relationship="label" withArrow>
              <Button
                appearance="subtle"
                size="small"
                icon={<ChevronLeft16Regular />}
                onClick={() => {
                  const i = DAYS.indexOf(state.day);
                  setClock({ day: DAYS[(i + 4) % 5] });
                }}
              />
            </Tooltip>
            <Text
              weight={"semibold"}
              size={300}
              style={{ minWidth: 96, display: 'inline-block' }}
            >
              {state.day.slice(0, 3).toUpperCase()} · {state.week}
            </Text>
            <Tooltip content="Next day" relationship="label" withArrow>
              <Button
                appearance="subtle"
                size="small"
                icon={<ChevronRight16Regular />}
                onClick={() => {
                  const i = DAYS.indexOf(state.day);
                  setClock({ day: DAYS[(i + 1) % 5] });
                }}
              />
            </Tooltip>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--colorNeutralStroke2)' }} />

          <Tooltip content={state.running ? 'Pause simulated clock' : 'Run simulated clock'} relationship="label" withArrow>
            <Button
              appearance={state.running ? 'primary' : 'subtle'}
              size="small"
              icon={state.running ? <RecordStop16Regular /> : <Play16Regular />}
              onClick={() => dispatch({ type: 'SET_CLOCK', patch: { running: !state.running } })}
            >
              {formatTime(state.time)}
            </Button>
          </Tooltip>

          <div style={{ width: 1, height: 20, background: 'var(--colorNeutralStroke2)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {lessonLabel ? (
              <Tooltip
                content={`${lessonLabel.subject.name} · ${lessonLabel.class.classId} · ${formatTime(lessonLabel.block.startTime)}–${formatTime(lessonLabel.block.endTime)}`}
                relationship="label"
                withArrow
              >
                <Badge appearance="tint" color="brand" size="small">
                  {state.sim.roomId} · {lessonLabel.subject.abbreviation}
                </Badge>
              </Tooltip>
            ) : (
              <Badge appearance="outline" size="small">
                {state.sim.roomId} · no lesson
              </Badge>
            )}
          </div>

          <span className="scas-spacer" />

          <WeekTabs
            value={state.week}
            onChange={(v) => setClock({ week: v })}
          />

          <div style={{ width: 1, height: 20, background: 'var(--colorNeutralStroke2)' }} />

          <Button
            appearance="subtle"
            size="small"
            icon={<Person24Regular />}
            onClick={() => setRoleDialogOpen(true)}
          >
            {roleLabel}
          </Button>

          <ThemeToggle />
        </header>

        {/* Content */}
        <div className="scas-content">
          <div className="scas-content-inner">{children}</div>
        </div>

        <StatusStrip />
      </div>

      <RoleDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Role / login dialog                                                 */
/* ------------------------------------------------------------------ */

function RoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { state, dispatch, data } = useSim();

  // A teacher may only sign in as a teacher who actually appears in the
  // loaded timetable (requirement 6 / 23).
  const availableTeachers = useMemo(
    () => data.teachers.filter((t) => data.classes.some((c) => c.teacherId === t.teacherId)),
    [data],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(_, d) => onOpenChange(d.open)}
      modalType="modal"
    >
      <DialogSurface aria-label="Switch role">
        <DialogBody>
          <DialogTitle>Sign in as</DialogTitle>
          <DialogContent>
            <div style={{ display: 'grid', gap: 12, marginTop: 4 }}>
              <div className="scas-row" style={{ gap: 8 }}>
                {(['office', 'teacher', 'student'] as const).map((r) => (
                  <Button
                    key={r}
                    appearance={state.role === r ? 'primary' : 'outline'}
                    onClick={() =>
                      dispatch({
                        type: 'SET_ROLE',
                        role: r,
                        teacherId:
                          r === 'teacher'
                            ? availableTeachers.find((t) => t.teacherId === state.currentTeacherId)
                                ?.teacherId ?? availableTeachers[0].teacherId
                            : state.currentTeacherId,
                      })
                    }
                  >
                    {r === 'office' ? 'Office' : r === 'teacher' ? 'Teacher' : 'Student'}
                  </Button>
                ))}
              </div>

              {state.role === 'teacher' && (
                <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                  <Text size={200} weight={"semibold"} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    TEACHER — constrained to staff timetabled in Year 10
                  </Text>
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 2 }}>
                    {availableTeachers.map((t) => {
                      const classes = data.classes.filter((c) => c.teacherId === t.teacherId);
                      return (
                        <Button
                          key={t.teacherId}
                          appearance={state.currentTeacherId === t.teacherId ? 'primary' : 'subtle'}
                          onClick={() => dispatch({ type: 'SET_ROLE', role: 'teacher', teacherId: t.teacherId })}
                          style={{ justifyContent: 'space-between', width: '100%' }}
                        >
                          <span>{t.name}</span>
                          <span style={{ opacity: 0.75, fontSize: 12 }}>
                            {classes.map((c) => c.classId).join(' · ')}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {state.role === 'student' && (
                <MessageHint text="Student view uses the simulator identity. Open Device Simulator to change the student or ID." />
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function MessageHint({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        padding: '8px 10px',
        borderRadius: 'var(--borderRadiusMedium)',
        background: 'var(--colorNeutralBackground2)',
        fontSize: 12.5,
        color: 'var(--colorNeutralForeground2)',
      }}
    >
      <ErrorCircle16Regular style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{text}</span>
    </div>
  );
}
