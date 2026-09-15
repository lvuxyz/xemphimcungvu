import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { findMockMovie, getMockDetail } from '@/mocks';
import { WatchScreen } from './WatchScreen';

interface Props {
  params: { slug: string; ep: string };
}

export function generateMetadata({ params }: Props): Metadata {
  const movie = findMockMovie(params.slug);
  return { title: movie ? `${movie.name} — Tập ${params.ep}` : 'Trình phát' };
}

/** Trang phát video (§10). */
export default function WatchPage({ params }: Props) {
  if (!findMockMovie(params.slug)) notFound();

  return <WatchScreen detail={getMockDetail(params.slug)} episodeSlug={params.ep} />;
}
