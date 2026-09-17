import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDetail, nullOn404 } from '@/lib/endpoints';
import { episodeLabel, resolveEpisode } from '@/lib/derive';
import { WatchScreen } from './WatchScreen';

interface Props {
  params: { slug: string; ep: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail?.movie.slug) return { title: 'Trình phát' };

  const episode = resolveEpisode(detail.episodes[0]?.episodes ?? [], params.ep);
  const label = episode ? episodeLabel(episode.name) : `Tập ${params.ep}`;

  return { title: `${detail.movie.name} — ${label}` };
}

/** Trang phát video (§10). Chỉ cần `/phim/{slug}`: episodes nằm ngay trong đó. */
export default async function WatchPage({ params }: Props) {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail || !detail.movie.slug) notFound();

  return <WatchScreen detail={detail} episodeSlug={params.ep} />;
}
