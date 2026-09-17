import type { ReactNode } from 'react';
import { AppBootstrap } from './AppBootstrap';
import { NavigationTracker } from './NavigationTracker';
import { QueryProvider } from './QueryProvider';

/** Gom mọi provider vào một chỗ để `app/layout.tsx` giữ được dạng Server Component. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AppBootstrap />
      <NavigationTracker />
      {children}
    </QueryProvider>
  );
}
