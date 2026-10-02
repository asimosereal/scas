'use client';

import { Button, Tooltip } from '@fluentui/react-components';
import { WeatherSunny16Regular, WeatherMoon20Regular } from '@fluentui/react-icons';
import { createContext, useContext, useEffect, useState } from 'react';

type Mode = 'light' | 'dark';

const ThemeCtx = createContext<{ mode: Mode; toggle: () => void }>({
  mode: 'light',
  toggle: () => {},
});

export function useThemeMode() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('scas.theme') as Mode | null;
    if (stored === 'dark' || stored === 'light') setMode(stored);
  }, []);

  const toggle = () => {
    setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light';
      window.localStorage.setItem('scas.theme', next);
      return next;
    });
  };

  return (
    <ThemeCtx.Provider value={{ mode, toggle }}>{children}</ThemeCtx.Provider>
  );
}

export function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <Tooltip content={mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} relationship="label" withArrow>
      <Button
        appearance="subtle"
        size="small"
        icon={mode === 'light' ? <WeatherSunny16Regular /> : <WeatherMoon20Regular />}
        onClick={toggle}
        aria-label="Toggle colour theme"
      />
    </Tooltip>
  );
}
