import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { parseYear } from './parse-year';

/** Năm ngoài khoảng → 404 thật, ngoài Suspense của `loading.tsx` — xem `app/phim/[slug]/layout.tsx`. */
export default function YearLayout({
  params,
  children,
}: {
  params: { year: string };
  children: ReactNode;
}) {
  if (parseYear(params.year) === null) notFound();

  return children;
}
