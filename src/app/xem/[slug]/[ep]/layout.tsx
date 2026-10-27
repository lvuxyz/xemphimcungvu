import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getDetail, nullOn404 } from '@/lib/endpoints';

/**
 * Kiểm slug ở layout để `notFound()` ra 404 thật, đứng ngoài Suspense của
 * `loading.tsx` — lý do đầy đủ ở `app/phim/[slug]/layout.tsx`. `getDetail` gộp
 * chung request với page.
 */
export default async function WatchLayout({
  params,
  children,
}: {
  params: { slug: string };
  children: ReactNode;
}) {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail?.movie.slug) notFound();

  return children;
}
