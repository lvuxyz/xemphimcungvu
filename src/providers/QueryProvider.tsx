'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  // getQueryClient() tự xử lý singleton phía browser / instance mới phía server.
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
