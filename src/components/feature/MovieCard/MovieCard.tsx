'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { HOVER_DELAY, PLACEHOLDER_BACKDROP, PLACEHOLDER_POSTER } from '@/lib/constants';
import { cardQualityLabel, episodeBadgeLabel, matchScore, parseEpisodeBadge } from '@/lib/derive';
import type { CardMovie } from '@/types/movie';
import { useWatchRatio } from '@/store/useWatchStore';
import { useHoverDelay } from '@/hooks/useHoverDelay';
import { usePresence } from '@/hooks/usePresence';
import { useDevice, useHoverPreviewEnabled } from '@/hooks/useDevice';
import { MatchScore } from '@/components/ui/Chip';
import { routes } from '@/lib/routes';
import { useInTitleModal } from '../DetailModal/modal-context';
import { HoverPreview } from '../HoverPreview/HoverPreview';

interface MovieCardProps {
  movie: CardMovie;
  /** `row` dùng thumb 16:9 (carousel), `grid` dùng poster 2:3 (trang danh sách) — §7.5 */
  variant?: 'row' | 'grid';
  /** §8.4 — edge-aware transform-origin, do ContentRow tính và truyền xuống */
  transformOrigin?: string;
  /** Tắt HoverPreview ở nơi không đủ chỗ phóng to (grid, my-list) */
  enableHoverPreview?: boolean;
  /**
   * Ghi đè `sizes` của ảnh khi card đứng trong bố cục khác row / grid mặc định —
   * row poster trang chủ hẹp hơn ô grid, dùng `sizes` của grid là tải ảnh to hơn cần.
   */
  sizes?: string;
  priority?: boolean;
  /**
   * `loading="eager"` mà KHÔNG kèm preload như `priority` — cho trang card đầu
   * của row đầu trang chủ, xem `ContentRow`.
   */
  eager?: boolean;
  className?: string;
  /** §13.1 — roving tabindex do ContentRow điều phối */
  tabIndex?: number;
  onFocusCard?: () => void;
}

export function MovieCard({
  movie,
  variant = 'row',
  transformOrigin = 'center',
  enableHoverPreview = true,
  sizes,
  priority = false,
  eager = false,
  className,
  tabIndex,
  onFocusCard,
}: MovieCardProps) {
  const router = useRouter();
  /**
   * Card "Có thể bạn thích" bên trong modal thì ĐỔI nội dung modal tại chỗ thay
   * vì chồng thêm một entry lịch sử. Xem `DetailModal/modal-context.ts`.
   */
  const inModal = useInTitleModal();
  const { canHover, reducedMotion, tier } = useDevice();
  const hoverPreviewEnabled = useHoverPreviewEnabled();
  const { isHovered, onMouseEnter, onMouseLeave, cancel } = useHoverDelay();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef(false);

  const href = routes.detail(movie.slug);
  const isRow = variant === 'row';

  /**
   * Preview chỉ có nghĩa khi có chuột thật. Trên điện thoại, `onMouseEnter` vẫn
   * bắn ra lúc chạm (trình duyệt giả lập chuột) → card phóng to 1.35 rồi mới điều
   * hướng, vừa giật vừa che mất hàng bên cạnh. Mạng yếu cũng tắt: preview tải
   * thêm một ảnh thumb nữa cho mỗi card người dùng lướt qua.
   */
  const previewEnabled = enableHoverPreview && hoverPreviewEnabled;
  const { mounted, visible } = usePresence(previewEnabled && isHovered);

  /**
   * §11.4 — hover 200ms thì prefetch route chi tiết.
   * Mạng yếu / tiết kiệm dữ liệu thì KHÔNG: tải trước một trang người dùng chưa
   * chắc mở là đúng thứ làm nghẽn nốt băng thông ít ỏi còn lại.
   */
  const prefetchEnabled = canHover && tier !== 'low';

  const clearPrefetchTimer = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  };

  const handleEnter = useCallback(() => {
    if (previewEnabled) onMouseEnter();

    if (prefetchEnabled && !prefetchedRef.current) {
      clearPrefetchTimer();
      prefetchTimerRef.current = setTimeout(() => {
        prefetchedRef.current = true;
        router.prefetch(href);
      }, HOVER_DELAY.prefetch);
    }
  }, [previewEnabled, onMouseEnter, prefetchEnabled, router, href]);

  const handleLeave = useCallback(() => {
    clearPrefetchTimer();
    if (previewEnabled) onMouseLeave();
  }, [previewEnabled, onMouseLeave]);

  useEffect(() => clearPrefetchTimer, []);

  /**
   * §1.4 L7 — cùng một ý định "mở chi tiết" mà trước đây có hai đường: ảnh card
   * là `<Link>`, còn nút ⌄ của HoverPreview là `router.push()`. Hai đường đó
   * khác nhau ở những chỗ thấy được: `<Link>` cho ctrl/cmd + bấm để mở tab mới,
   * `router.push` thì không; và chỉ một trong hai được prefetch.
   *
   * Giờ nút ⌄ bấm hộ đúng cái link của card, nên mọi lối vào chi tiết đi chung
   * một đường duy nhất.
   */
  const linkRef = useRef<HTMLAnchorElement>(null);

  const openDetail = () => {
    cancel();
    linkRef.current?.click();
  };

  const badgeLabel = episodeBadgeLabel(parseEpisodeBadge(movie.episodeCurrent));
  const qualityLabel = cardQualityLabel(movie.quality);

  /**
   * Đọc từ store dùng chung, không phải từ localStorage: trang chủ có hơn trăm
   * card, mỗi card tự đọc storage là hơn trăm lượt chạm đồng bộ ngay lúc hydrate.
   * Store nạp index một lần, ở đây chỉ còn một phép tìm trong RAM — và card nào
   * chưa xem thì selector trả về đúng `0`, không render lại.
   */
  const watchRatio = useWatchRatio(movie.slug);

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <Link
        ref={linkRef}
        href={href}
        replace={inModal}
        prefetch={false}
        data-card=""
        tabIndex={tabIndex}
        onFocus={() => onFocusCard?.()}
        className={cn(
          'group block overflow-hidden rounded-card bg-raised',
          'transition-[box-shadow,transform,opacity] duration-standard ease-standard',
          'focus-visible:outline-offset-4',
          // Ngón tay không có hover: phản hồi chạm là cách duy nhất báo "đã nhận"
          'active:scale-[0.98]',
          visible && 'opacity-0',
        )}
      >
        <div className={cn('relative', isRow ? 'aspect-backdrop' : 'aspect-poster')}>
          <SmartImage
            src={isRow ? movie.thumb : movie.poster}
            fallbackSrc={isRow ? PLACEHOLDER_BACKDROP : PLACEHOLDER_POSTER}
            alt={`${movie.name} (${movie.year})`}
            fill
            sizes={sizes ?? (isRow ? IMAGE_SIZES.rowCard : IMAGE_SIZES.gridCard)}
            priority={priority}
            loading={eager && !priority ? 'eager' : undefined}
            /*
              `low` KHÔNG phải để card tải chậm lại, mà để chặn hai thứ:
                · React tự chèn `<link rel=preload>` cho MỌI <img> không phải
                  `lazy` — trừ khi `fetchPriority="low"`. Đo trên HTML đã build:
                  thiếu dòng này là 6 thẻ preload card đứng cạnh preload của hero.
                · Chrome nâng ảnh trong viewport lên High sau layout, tức là tranh
                  băng thông đúng lúc hero (LCP, `fetchpriority=high`) còn đang tải.
            */
            fetchPriority={eager && !priority ? 'low' : undefined}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />

          {qualityLabel && (
            <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-bg-base/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-primary backdrop-blur-sm">
              {qualityLabel}
            </span>
          )}

          {badgeLabel && (
            <span className="absolute bottom-1.5 right-1.5 rounded-[3px] bg-accent/90 px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--accent-contrast)]">
              {badgeLabel}
            </span>
          )}

          {/*
            §10.5 — phim đang xem dở. Nằm đè lên đáy ảnh (`absolute`) nên nó xuất
            hiện sau hydrate mà không dịch một pixel nào của bố cục.
          */}
          {watchRatio > 0 && (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
              <span
                className="block h-full bg-accent"
                style={{ width: `${Math.max(2, Math.round(watchRatio * 100))}%` }}
              />
            </span>
          )}
        </div>

        {/*
          Tên phim luôn hiện sẵn, kể cả card ngang có HoverPreview: nhiều phim dùng
          chung một ảnh (các phần của cùng một bộ, ảnh mặc định của KKPhim) nên chỉ
          nhìn ảnh thì không phân biệt được — phải rê chuột từng card mới biết.
        */}
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium text-text-primary">{movie.name}</p>
          <p className="truncate text-[11px] text-text-muted">{movie.originName}</p>
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            {movie.year > 0 && <span>{movie.year}</span>}
            <MatchScore score={matchScore(movie)} className="text-[10px]" />
          </div>
        </div>
      </Link>

      {mounted && (
        <HoverPreview
          movie={movie}
          transformOrigin={transformOrigin}
          reducedMotion={reducedMotion}
          visible={visible}
          onOpenDetail={openDetail}
          onCancelHover={cancel}
        />
      )}
    </div>
  );
}
