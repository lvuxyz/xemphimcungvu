'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { episodeLabel } from '@/lib/derive';
import { getWatchProgress } from '@/lib/storage';
import { routes } from '@/lib/routes';
import type { EpisodeServer } from '@/types/movie';

interface EpisodePickerProps {
  slug: string;
  servers: EpisodeServer[];
  /** Tập đang xem — highlight bằng --accent (§10.6) */
  currentEpisode?: string;
  /** Bố cục dọc cho sidebar trang phát, ngang cho modal */
  layout?: 'grid' | 'list';
  /**
   * Trong trang phát, đổi tập là đổi trạng thái của CÙNG một điểm dừng, không
   * phải một đích đến mới (§2.3) — nếu không, xem hết bộ 40 tập là 40 entry
   * giống nhau trong lịch sử. Ở modal chi tiết thì ngược lại: bấm vào một tập là
   * rời trang, nên vẫn `push`.
   */
  replaceOnSelect?: boolean;
}

/**
 * §8.5 mục 7 — tabs chọn server + grid chọn tập.
 * Dùng lại cho sidebar trang phát (§10.6).
 */
export function EpisodePicker({
  slug,
  servers,
  currentEpisode,
  layout = 'grid',
  replaceOnSelect = false,
}: EpisodePickerProps) {
  const [serverIndex, setServerIndex] = useState(0);
  const active = servers[serverIndex];

  /**
   * §10.6 — "tập đã xem có thanh tiến độ mỏng phía dưới".
   * localStorage chỉ đọc được phía client, nên đọc trong effect để server và
   * client render giống nhau ở lượt đầu (tránh hydration mismatch).
   */
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!active) return;

    const next: Record<string, number> = {};
    for (const episode of active.episodes) {
      const saved = getWatchProgress(slug, episode.slug);
      if (saved && saved.duration > 0) {
        next[episode.slug] = Math.min(1, saved.position / saved.duration);
      }
    }
    setProgress(next);
  }, [slug, active]);

  if (servers.length === 0) return null;

  return (
    <section aria-labelledby="episodes-heading" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="episodes-heading" className="mr-2 text-sm font-bold text-text-primary">
          Chọn tập
        </h3>

        {servers.map((server, index) => (
          <button
            key={server.serverName}
            type="button"
            onClick={() => setServerIndex(index)}
            aria-pressed={index === serverIndex}
            className={cn(
              'rounded-pill px-3 py-1 text-xs transition-colors duration-micro ease-standard',
              index === serverIndex
                ? 'bg-[color:var(--accent-soft)] text-accent-hover ring-1 ring-accent/50'
                : 'text-text-muted ring-1 ring-white/15 hover:text-text-primary',
            )}
          >
            {server.serverName}
          </button>
        ))}
      </div>

      <ul
        role="list"
        className={cn(
          'gap-2',
          layout === 'grid'
            ? 'grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))]'
            : 'flex max-h-[60vh] flex-col overflow-y-auto pr-1',
        )}
      >
        {active?.episodes.map((episode) => {
          const isCurrent = currentEpisode === episode.slug;
          const watched = progress[episode.slug];

          return (
            <li key={episode.slug}>
              <Link
                href={routes.watch(slug, episode.slug)}
                replace={replaceOnSelect}
                aria-current={isCurrent ? 'true' : undefined}
                className={cn(
                  'relative block overflow-hidden truncate rounded-card px-2 py-2 text-center text-xs',
                  'transition-colors duration-micro ease-standard',
                  layout === 'list' && 'text-left',
                  isCurrent
                    ? 'bg-[color:var(--accent-soft)] font-medium text-accent-hover ring-1 ring-accent'
                    : 'bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                {layout === 'list' ? episodeLabel(episode.name) : episode.name}

                {/* §10.6 — thanh tiến độ mỏng cho tập đã xem dở */}
                {watched !== undefined && watched > 0.01 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-white/15"
                  >
                    <span
                      className="block h-full bg-accent"
                      style={{ width: `${Math.round(watched * 100)}%` }}
                    />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
