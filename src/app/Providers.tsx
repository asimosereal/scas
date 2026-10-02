'use client';

import { FluentProvider, webDarkTheme } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { SimProvider } from '@/lib/store/sim-store';
import { scasDark, scasLight } from '@/lib/theme';
import { ThemeProvider, useThemeMode } from '@/components/ThemeToggle';

function ThemedShell({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const [mounted, setMounted] = useState(false);

  // Avoid a theme flash / hydration mismatch on first paint.
  useEffect(() => setMounted(true), []);

  const theme = mode === 'dark' ? scasDark : scasLight;

  return (
    <FluentProvider theme={mounted ? theme : scasLight} style={{ height: '100vh' }}>
      <AppShell>{children}</AppShell>
    </FluentProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SimProvider>
        <ThemedShell>{children}</ThemedShell>
      </SimProvider>
    </ThemeProvider>
  );
}
