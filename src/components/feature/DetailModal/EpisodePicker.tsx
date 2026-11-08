'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/hooks/useDevice';
import { cn } from '@/lib/cn';
import { episodeLabel } from '@/lib/derive';
import { preloadPlayer } from '@/lib/player-preload';
import { getMovieProgress } from '@/lib/storage';
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
   *
   * MỘT lượt đọc cho cả phim, không phải một lượt cho mỗi tập: bản trước gọi
   * `getWatchProgress` trong vòng lặp, nên mở sidebar một bộ 40 tập là 40 lần
   * `getItem` + `JSON.parse` đồng bộ — mỗi lần đổi server lại làm thêm một lượt.
   * Xem `lib/storage.ts` mục index tiến độ xem.
   */
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => setProgress(getMovieProgress(slug)), [slug]);

  /**
   * Link tập KHÔNG tự prefetch. `/xem/[slug]/[ep]` là route tĩnh nên mỗi link
   * lọt vào viewport kéo về NGUYÊN payload trang phát: mở modal một bộ 40 tập là
   * vài chục request RSC xếp hàng trong 5 slot prefetch của router — đứng trước
   * cả nút Phát lẫn tập kế tiếp, đúng hai thứ người xem sắp bấm nhất. Hai thứ đó
   * có prefetch riêng (nút Phát là `<Link>` thường; tập kế do `WatchScreen`).
   *
   * Thay bằng prefetch theo ý định: chuột lướt tới, focus bàn phím, hoặc ngón tay
   * chạm xuống — `prefetch={false}` tắt luôn cả prefetch hover sẵn có của Link,
   * nên phải tự gắn. Mạng yếu thì thôi, như `MovieCard`.
   *
   * Cùng cú ý định đó làm ấm luôn chunk trình phát + hls.js (`preloadPlayer`): bấm
   * vào tập là tới thẳng player, payload RSC có sẵn mà chunk chưa về thì vẫn phải
   * đứng nhìn skeleton thêm hai vòng mạng.
   */
  const router = useRouter();
  const { tier } = useDevice();
  const prefetched = useRef(new Set<string>());
  const prefetch = useCallback(
    (href: string, hasM3u8: boolean) => {
      if (tier === 'low' || prefetched.current.has(href)) return;
      prefetched.current.add(href);
      router.prefetch(href);
      preloadPlayer({ hls: hasM3u8 });
    },
    [router, tier],
  );

  if (servers.length === 0) return null;

  return (
    <section aria-labelledby="episodes-heading" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="episodes-heading" className="mr-2 text-sm font-bold text-text-primary">
          Chọn tập
        </h3>

        {servers.map((server, index) => (
          <button
            /**
             * Key theo VỊ TRÍ chứ không theo tên: tên server do API đặt và
             * không có gì bảo đảm là duy nhất (đúng nguồn ấy đã từng trả hai
             * tập cùng slug — xem `dedupeEpisodes`). Danh sách này không bao
             * giờ bị chèn, xoá hay đảo thứ tự ở phía client, và bản thân
             * `serverIndex` cũng đang định danh server bằng vị trí.
             */
            key={index}
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
          const href = routes.watch(slug, episode.slug);
          const warm = () => prefetch(href, Boolean(episode.linkM3u8));

          return (
            <li key={episode.slug}>
              <Link
                href={href}
                replace={replaceOnSelect}
                prefetch={false}
                onPointerEnter={warm}
                onFocus={warm}
                onTouchStart={warm}
                aria-current={isCurrent ? 'true' : undefined}
                className={cn(
                  'relative block overflow-hidden truncate rounded-card px-2 py-2 text-center text-xs',
                  'transition-colors duration-micro ease-standard',
                  layout === 'list' && 'text-left',
                  isCurrent
                    ? 'bg-[color:var(--accent-soft)] font-medium text-accent-hover ring-1 ring-accent'
                    : 'bg-raised text-text-secondary hover:bg-raised-hover hover:text-text-primary',
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

/**
 * Bọc nút Phát của `DetailContent` (server component, không gắn được handler) để
 * làm ấm chunk trình phát + hls.js khi người dùng CÓ Ý bấm: lướt chuột tới, focus
 * bàn phím, chạm xuống. Không làm lúc modal mở — người chỉ xem thông tin rồi đóng
 * không phải trả ~55KB+ tranh băng thông với ảnh của modal.
 *
 * Payload RSC của nút Phát đã có prefetch mặc định của `<Link>`; thứ còn thiếu là
 * hai chunk JS mà payload đó không kéo theo. `contents` để wrapper không đổi bố
 * cục hàng nút; enter/focus/touch của React vẫn tới được nó từ thẻ `<a>` bên trong.
 */
export function PlayIntent({ hasM3u8, children }: { hasM3u8: boolean; children: ReactNode }) {
  const { tier } = useDevice();
  const done = useRef(false);
  const warm = () => {
    if (tier === 'low' || done.current) return;
    done.current = true;
    preloadPlayer({ hls: hasM3u8 });
  };

  return (
    <span className="contents" onPointerEnter={warm} onFocus={warm} onTouchStart={warm}>
      {children}
    </span>
  );
}
