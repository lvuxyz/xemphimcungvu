'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLAYER } from '@/lib/constants';
import { episodeLabel, resolveEpisode } from '@/lib/derive';
import { routes } from '@/lib/routes';
import { readStartTime } from '@/lib/search-params';
import type { MovieDetailResult } from '@/types/movie';
import { useAppNavigation } from '@/hooks/useAppNavigation';
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
  detail: MovieDetailResult;
  episodeSlug: string;
}

export function WatchScreen({ detail, episodeSlug }: WatchScreenProps) {
  const { playTitle, goBackOrHome } = useAppNavigation();
  const { movie, episodes } = detail;

  /**
   * §2.4 — giây lấy từ `?t=`, đọc một lần lúc mount.
   *
   * Đọc ở đây chứ không nhận từ props server: xem chú thích trong `page.tsx` về
   * chuyện `searchParams` làm mất cache CDN của cả trang.
   *
   * Lazy initializer chứ không phải `useEffect`: `VideoPlayer` cần giá trị này
   * ngay ở lần render ĐẦU của nó (`skipResumePrompt`), muộn hơn là hộp thoại
   * "xem tiếp" đã kịp hiện rồi mới bị mốc `?t=` ghi đè.
   *
   * Cố ý KHÔNG đọc lại khi đổi tập: `goToEpisode` dùng `replace` nên URL tập mới
   * không còn `?t=`, mà mốc thời gian của tập cũ thì không có nghĩa gì ở tập mới.
   */
  const [startAt] = useState(readStartTime);

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

  /**
   * Đổi tập là `replace`, KHÔNG phải `push` (§2.3).
   *
   * Xem hết một bộ 40 tập bằng `push` thì lịch sử có 40 entry giống hệt nhau:
   * bấm Back từ tập 40 là lùi về tập 39 chứ không ra được trang phim, và người
   * xem phải bấm đúng 40 lần mới thoát khỏi nhánh này. Một bộ phim là MỘT điểm
   * dừng trong lịch sử, tập nào đang xem là trạng thái bên trong nó.
   */
  const goToEpisode = useCallback(
    (slug: string) => playTitle(movie.slug, { episodeSlug: slug, replace: true }),
    [playTitle, movie.slug],
  );

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (next) goToEpisode(next.slug);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, next, goToEpisode]);

  // Đổi tập xong thì phải dẹp countdown của tập cũ, nếu không nó đếm tiếp trên tập mới.
  useEffect(() => setCountdown(null), [episodeSlug]);

  const onNext = useCallback(() => {
    if (next) goToEpisode(next.slug);
  }, [next, goToEpisode]);

  /**
   * Ảnh chụp ghi kèm tiến độ xem.
   *
   * Đây là NƠI DUY NHẤT trong app vừa biết người ta đang xem tập nào, vừa đang
   * giữ dữ liệu phim — nên cũng là nơi duy nhất trả được câu hỏi "vẽ card cho
   * phim này bằng gì" mà không phải gọi lại `/phim/{slug}`. Không chụp ở đây thì
   * mọi chỗ muốn hiện "đang xem" đều phải tự đi fetch.
   */
  const watchSnapshot = useMemo(
    () => ({
      name: movie.name,
      originName: movie.originName,
      poster: movie.poster,
      thumb: movie.thumb,
      year: movie.year,
      quality: movie.quality,
      episodeCurrent: movie.episodeCurrent,
      episodeName: episode?.name ?? '',
      // Ba field cho trọng số sở thích, xem `lib/taste.ts`.
      type: movie.type,
      categories: movie.categories.map((c) => c.slug),
      countries: movie.countries.map((c) => c.slug),
    }),
    [movie, episode?.name],
  );

  if (!episode) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-32 text-center">
        <p className="text-lg text-text-primary">Tập này chưa có nguồn phát.</p>
        {/* `hard` — xem `useLeavesPlayer` về việc modal đè lên player. */}
        <Button href={routes.detail(movie.slug)} hard variant="accent" className="mt-6">
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
            startAt={startAt}
            /**
             * §2.3 — thoát player phải về ĐÚNG TRANG TRƯỚC, giữ nguyên scroll và
             * vị trí row. `goBackOrHome` lùi lại khi có lịch sử của app, và chỉ
             * rơi về trang chủ khi người dùng mở thẳng link này trong tab mới.
             */
            onBack={goBackOrHome}
            onNext={next ? onNext : undefined}
            nextLabel={next ? episodeLabel(next.name) : undefined}
            watchSnapshot={watchSnapshot}
          />

          {countdown !== null && next && (
            <div className="flex flex-wrap items-center gap-3 rounded-card bg-bg-elevated p-3 text-sm">
              <span className="text-text-secondary">
                Tự động chuyển sang {episodeLabel(next.name).toLowerCase()} sau {countdown}s
              </span>
              <Button size="sm" variant="accent" onClick={onNext}>
                Xem ngay
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCountdown(null)}>
                Huỷ
              </Button>
            </div>
          )}

          <div className="space-y-1">
            {/*
              `<a>` chứ không phải `<Link>`: điều hướng mềm từ đây sẽ khớp
              intercepting route và mở modal ĐÈ LÊN player đang chạy (§1.4 L1).
              Xem `hooks/useLeavesPlayer.ts`.
            */}
            <a
              href={routes.detail(movie.slug)}
              className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors duration-micro ease-standard hover:text-text-primary"
            >
              <ArrowLeftIcon />
              Về trang phim
            </a>
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
            /** Trong player, đổi tập là đổi trạng thái tại chỗ — xem `goToEpisode`. */
            replaceOnSelect
          />
        </aside>
      </div>
    </main>
  );
}
