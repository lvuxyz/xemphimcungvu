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

/**
 * Cùng lý do với `app/phim/[slug]/page.tsx`: có hàm này thì route mới được cache.
 * Ở đây khoản lãi lớn hơn — đây là trang người ta thực sự ở lại để xem phim, và
 * `revalidate` của nó là 1800s chứ không phải 300s.
 *
 * Đo trên build prod: `private, no-store` / TTFB 136–240ms → `s-maxage=1800,
 * stale-while-revalidate` / 7–16ms khi HIT.
 */
export async function generateStaticParams() {
  return [];
}

/** Trang phát video (§10). Chỉ cần `/phim/{slug}`: episodes nằm ngay trong đó. */
export default async function WatchPage({ params }: Props) {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail || !detail.movie.slug) notFound();

  /**
   * §2.4 — `?t=` KHÔNG đọc ở đây nữa, mà ở `VideoPlayer` phía client.
   *
   * Chạm vào `searchParams` trong Server Component là đủ để Next coi cả route là
   * dynamic, và khi đó `generateStaticParams` bên trên thành vô nghĩa: header
   * quay lại `no-store`. Giá phải trả cho một tham số tuỳ chọn mà chỉ trình phát
   * dùng là quá đắt — trình phát vốn đã `ssr: false` nên giá trị đó không bao giờ
   * tham gia vào HTML server render.
   */
  return <WatchScreen detail={detail} episodeSlug={params.ep} />;
}
