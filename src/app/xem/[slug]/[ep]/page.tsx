import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDetail, nullOn404 } from '@/lib/endpoints';
import { episodeLabel, resolveEpisode } from '@/lib/derive';
import { parseStartTime, type RawSearchParams } from '@/lib/search-params';
import { WatchScreen } from './WatchScreen';

interface Props {
  params: { slug: string; ep: string };
  searchParams: RawSearchParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail?.movie.slug) return { title: 'Trình phát' };

  const episode = resolveEpisode(detail.episodes[0]?.episodes ?? [], params.ep);
  const label = episode ? episodeLabel(episode.name) : `Tập ${params.ep}`;

  return { title: `${detail.movie.name} — ${label}` };
}

/** Trang phát video (§10). Chỉ cần `/phim/{slug}`: episodes nằm ngay trong đó. */
export default async function WatchPage({ params, searchParams }: Props) {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail || !detail.movie.slug) notFound();

  return (
    <WatchScreen
      detail={detail}
      episodeSlug={params.ep}
      /** §2.4 — `?t=` mở đúng phút đã chia sẻ, và F5 không mất chỗ đang xem. */
      startAt={parseStartTime(searchParams)}
    />
  );
}
