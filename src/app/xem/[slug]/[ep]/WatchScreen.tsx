'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PLAYER } from '@/lib/constants';
import { episodeLabel, resolveEpisode } from '@/lib/derive';
import type { MockDetail } from '@/mocks';
import { Button } from '@/components/ui/Button';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { EpisodePicker } from '@/components/feature/DetailModal/EpisodePicker';

/** §12.2 — VideoPlayer code-split, không nằm trong bundle initial. */
const VideoPlayer = dynamic(
  () => import('@/components/feature/VideoPlayer/VideoPlayer').then((m) => m.VideoPlayer),
  {
    ssr: false,
    loading: () => <div className="skeleton aspect-backdrop w-full rounded-card" />,
  },
);

interface WatchScreenProps {
  detail: MockDetail;
  episodeSlug: string;
}

export function WatchScreen({ detail, episodeSlug }: WatchScreenProps) {
  const router = useRouter();
  const { movie, episodes } = detail;

  const server = episodes[0];
  const list = server?.episodes ?? [];
  // §8.2 trỏ Play về `/xem/{slug}/1`, nhưng slug tập thật là "tap-01" — phân giải cả hai.
  const episode = resolveEpisode(list, episodeSlug);
  const index = episode ? list.indexOf(episode) : -1;
  const next = index >= 0 ? list[index + 1] : undefined;

  /** §10.6 — auto next có countdown 10s và nút huỷ. */
  const [countdown, setCountdown] = useState<number | null>(null);

  const onEnded = useCallback(() => {
    if (next) setCountdown(PLAYER.autoNextCountdown);
  }, [next]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (next) router.push(`/xem/${movie.slug}/${next.slug}`);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, next, router, movie.slug]);

  if (!episode) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-32 text-center">
        <p className="text-lg text-text-primary">Tập này chưa có nguồn phát.</p>
        <Button href={`/phim/${movie.slug}`} variant="accent" className="mt-6">
          Về trang phim
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-16">
      <div className="mx-auto grid max-w-[110rem] gap-6 p-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <VideoPlayer
            slug={movie.slug}
            episodeSlug={episode.slug}
            title={`${movie.name} — ${episodeLabel(episode.name)}`}
            linkM3u8={episode.linkM3u8}
            linkEmbed={episode.linkEmbed}
            onEnded={onEnded}
          />

          {countdown !== null && next && (
            <div className="flex flex-wrap items-center gap-3 rounded-card bg-bg-elevated p-3 text-sm">
              <span className="text-text-secondary">
                Tự động chuyển sang {episodeLabel(next.name).toLowerCase()} sau {countdown}s
              </span>
              <Button size="sm" variant="accent" href={`/xem/${movie.slug}/${next.slug}`}>
                Xem ngay
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCountdown(null)}>
                Huỷ
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <Link
              href={`/phim/${movie.slug}`}
              className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors duration-micro ease-standard hover:text-text-primary"
            >
              <ArrowLeftIcon />
              Về trang phim
            </Link>
            <h1 className="text-xl font-bold tracking-[-0.01em]">
              {movie.name} — {episodeLabel(episode.name)}
            </h1>
            <p className="text-sm text-text-muted">{movie.originName}</p>
          </div>
        </div>

        {/* §10.6 — sidebar chọn server + grid tập, tập đang xem highlight */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <EpisodePicker
            slug={movie.slug}
            servers={episodes}
            currentEpisode={episode.slug}
            layout="list"
          />
        </aside>
      </div>
    </main>
  );
}
