import type { Metadata } from 'next';
import { Providers } from './Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'SCAS — Student Classroom Attendance System',
  description:
    'Interactive prototype of a classroom attendance system for IGCSE Computer Science.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
