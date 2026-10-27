import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isTypeList } from '@/types/filters';

/** Loại lạ → 404 thật, ngoài Suspense của `loading.tsx` — xem `app/phim/[slug]/layout.tsx`. */
export default function ListByTypeLayout({
  params,
  children,
}: {
  params: { type: string };
  children: ReactNode;
}) {
  if (!isTypeList(params.type)) notFound();

  return children;
}
