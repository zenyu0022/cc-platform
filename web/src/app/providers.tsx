'use client';

import { DataProvider } from '@/providers/DataContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      {children}
    </DataProvider>
  );
}
