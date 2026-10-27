import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getCountries } from '@/lib/endpoints';

/** Slug lạ → 404 thật; cùng cách làm với `app/the-loai/[slug]/layout.tsx`. */
export default async function CountryLayout({
  params,
  children,
}: {
  params: { slug: string };
  children: ReactNode;
}) {
  const countries = await getCountries().catch(() => []);
  if (countries.length > 0 && !countries.some((item) => item.slug === params.slug)) notFound();

  return children;
}
