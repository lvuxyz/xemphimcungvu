'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { HOVER_DELAY, PLACEHOLDER_BACKDROP, PLACEHOLDER_POSTER } from '@/lib/constants';
import { episodeBadgeLabel, matchScore, parseEpisodeBadge } from '@/lib/derive';
import type { Movie } from '@/types/movie';
import { useHoverDelay } from '@/hooks/useHoverDelay';
import { usePresence } from '@/hooks/usePresence';
import { useDevice } from '@/hooks/useDevice';
import { MatchScore } from '@/components/ui/Chip';
import { HoverPreview } from '../HoverPreview/HoverPreview';

interface MovieCardProps {
  movie: Movie;
  /** `row` dùng thumb 16:9 (carousel), `grid` dùng poster 2:3 (trang danh sách) — §7.5 */
  variant?: 'row' | 'grid';
  /** §8.4 — edge-aware transform-origin, do ContentRow tính và truyền xuống */
  transformOrigin?: string;
  /** Tắt HoverPreview ở nơi không đủ chỗ phóng to (grid, my-list) */
  enableHoverPreview?: boolean;
  priority?: boolean;
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
  priority = false,
  className,
  tabIndex,
  onFocusCard,
}: MovieCardProps) {
  const router = useRouter();
  const { canHover, reducedMotion, budget, tier } = useDevice();
  const { isHovered, onMouseEnter, onMouseLeave, cancel } = useHoverDelay();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef(false);

  const href = `/phim/${movie.slug}`;
  const isRow = variant === 'row';

  /**
   * Preview chỉ có nghĩa khi có chuột thật. Trên điện thoại, `onMouseEnter` vẫn
   * bắn ra lúc chạm (trình duyệt giả lập chuột) → card phóng to 1.35 rồi mới điều
   * hướng, vừa giật vừa che mất hàng bên cạnh. Mạng yếu cũng tắt: preview tải
   * thêm một ảnh thumb nữa cho mỗi card người dùng lướt qua.
   */
  const previewEnabled = enableHoverPreview && canHover && budget.hoverPreview;
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

  const openDetail = () => {
    cancel();
    router.push(href);
  };

  const badgeLabel = episodeBadgeLabel(parseEpisodeBadge(movie.episodeCurrent));

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <Link
        href={href}
        prefetch={false}
        data-card=""
        tabIndex={tabIndex}
        onFocus={() => onFocusCard?.()}
        className={cn(
          'group block overflow-hidden rounded-card bg-bg-elevated',
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
            sizes={isRow ? IMAGE_SIZES.rowCard : IMAGE_SIZES.gridCard}
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />

          {movie.quality && (
            <span className="absolute left-1.5 top-1.5 rounded-[3px] bg-bg-base/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-primary backdrop-blur-sm">
              {movie.quality}
            </span>
          )}

          {badgeLabel && (
            <span className="absolute bottom-1.5 right-1.5 rounded-[3px] bg-accent/90 px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--accent-contrast)]">
              {badgeLabel}
            </span>
          )}
        </div>

        {/* Không có HoverPreview (grid, hoặc màn cảm ứng) thì tên phim phải hiện sẵn */}
        {(!isRow || !previewEnabled) && (
          <div className="space-y-1 p-2">
            <p className="truncate text-xs font-medium text-text-primary">{movie.name}</p>
            <p className="truncate text-[11px] text-text-muted">{movie.originName}</p>
            <div className="flex items-center gap-2 text-[10px] text-text-muted">
              {movie.year > 0 && <span>{movie.year}</span>}
              <MatchScore score={matchScore(movie)} className="text-[10px]" />
            </div>
          </div>
        )}
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
