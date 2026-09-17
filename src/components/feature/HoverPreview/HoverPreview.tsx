'use client';

import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { PLACEHOLDER_BACKDROP } from '@/lib/constants';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { episodeBadgeLabel, firstEpisodeHref, matchScore, parseEpisodeBadge } from '@/lib/derive';
import type { Movie } from '@/types/movie';
import { Chip, MatchScore } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/Button';
import { CheckIcon, ChevronDownIcon, PlayIcon, PlusIcon, ThumbUpIcon } from '@/components/ui/icons';
import { useMyListStore } from '@/store/useMyListStore';
import { useUIStore } from '@/store/useUIStore';

interface HoverPreviewProps {
  movie: Movie;
  /** §8.4 — phải theo vị trí trong row, nếu không card ở mép sẽ tràn viewport. */
  transformOrigin: string;
  reducedMotion: boolean;
  /** Đã qua một khung hình kể từ lúc mount → bật trạng thái phóng to. */
  visible: boolean;
  onOpenDetail: () => void;
  /** Đóng ngay lớp phóng to khi rời card bằng chuột (click vào ảnh preview). */
  onCancelHover: () => void;
}

/**
 * §8.4 — lớp phóng to khi hover card.
 *
 * Chỉ animate `transform` + `opacity` (§9.1) — nhưng bằng CSS transition thuần
 * chứ không qua framer-motion: component này nằm trong MovieCard, mà MovieCard
 * xuất hiện hàng trăm lần ở trang chủ. Xem `hooks/usePresence.ts`.
 */
export function HoverPreview({
  movie,
  transformOrigin,
  reducedMotion,
  visible,
  onOpenDetail,
  onCancelHover,
}: HoverPreviewProps) {
  const inMyList = useMyListStore((s) => s.entries.some((e) => e.slug === movie.slug));
  const toggleMyList = useMyListStore((s) => s.toggle);
  const pushToast = useUIStore((s) => s.pushToast);

  const badgeLabel = episodeBadgeLabel(parseEpisodeBadge(movie.episodeCurrent));
  const score = matchScore(movie);

  const handleMyList = () => {
    const added = toggleMyList(movie);
    pushToast(added ? `Đã thêm "${movie.name}" vào danh sách` : 'Đã gỡ khỏi danh sách của tôi', {
      variant: added ? 'success' : 'info',
      duration: 2500,
    });
  };

  // Translate TRƯỚC scale: giữ đúng thứ tự của framer-motion cũ, nếu đảo lại thì
  // khoảng dịch lên cũng bị nhân 1.35 và card nhảy cao hơn hẳn thiết kế.
  const transform = visible && !reducedMotion ? 'translateY(-20px) scale(1.35)' : 'scale(1)';

  return (
    <div
      className={cn(
        'absolute inset-x-0 top-0 z-card-hover',
        'transition-[transform,opacity] duration-standard ease-standard',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        'will-animate',
      )}
      style={{ transformOrigin, transform }}
    >
      <div className="overflow-hidden rounded-card bg-bg-elevated shadow-elev-3">
        <div className="relative aspect-backdrop">
          <SmartImage
            src={movie.thumb}
            fallbackSrc={PLACEHOLDER_BACKDROP}
            alt={`${movie.name} (${movie.year})`}
            fill
            sizes={IMAGE_SIZES.rowCard}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg-elevated to-transparent"
          />

          {/**
           * Bấm vào ảnh preview phải MỞ ĐƯỢC phim.
           *
           * Lớp phóng to che kín card gốc, mà bản thân nó lại không có chỗ nào
           * bấm được ngoài mấy nút tròn nhỏ ở dưới — nên phản xạ tự nhiên nhất
           * (rê chuột vào, bấm luôn vào ảnh) rơi vào khoảng không. Bắt được lúc
           * rà: bấm hai lần vào giữa card đang phóng to, URL không đổi.
           *
           * Là `Link` thật để còn ctrl/cmd + bấm mở tab mới. `aria-hidden` +
           * `tabIndex={-1}`: bàn phím và trình đọc màn hình đã có nút "Xem chi
           * tiết" ở dưới, thêm một điểm dừng Tab trùng chức năng chỉ tổ rườm rà.
           */}
          <Link
            href={`/phim/${movie.slug}`}
            prefetch={false}
            aria-hidden="true"
            tabIndex={-1}
            onClick={onCancelHover}
            className="absolute inset-0"
          />
        </div>

        <div className="space-y-2 p-2.5">
          <div className="flex items-center gap-1.5">
            <Link
              href={firstEpisodeHref(movie.slug)}
              aria-label={`Phát ${movie.name}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-text-primary text-bg-base transition-[background-color,transform] duration-micro ease-standard hover:bg-text-primary/80 active:scale-95"
            >
              <PlayIcon className="text-[10px]" />
            </Link>

            <IconButton
              label={inMyList ? 'Gỡ khỏi danh sách của tôi' : 'Thêm vào danh sách của tôi'}
              size="sm"
              active={inMyList}
              onClick={handleMyList}
            >
              {inMyList ? (
                <CheckIcon className="text-[10px]" />
              ) : (
                <PlusIcon className="text-[10px]" />
              )}
            </IconButton>

            <IconButton label="Thích phim này" size="sm">
              <ThumbUpIcon className="text-[10px]" />
            </IconButton>

            <IconButton
              label={`Xem chi tiết ${movie.name}`}
              size="sm"
              className="ml-auto"
              onClick={onOpenDetail}
            >
              <ChevronDownIcon className="text-[10px]" />
            </IconButton>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
            <MatchScore score={score} className="text-[10px]" />
            {badgeLabel && <span className="text-text-secondary">{badgeLabel}</span>}
            {movie.quality && (
              <span className="rounded-[3px] px-1 text-[9px] text-text-muted ring-1 ring-white/25">
                {movie.quality}
              </span>
            )}
            {movie.year > 0 && <span className="text-text-muted">{movie.year}</span>}
          </div>

          {movie.duration && (
            <p className="truncate text-[10px] text-text-muted">{movie.duration}</p>
          )}

          <div className="flex flex-wrap gap-1">
            {movie.categories.slice(0, 2).map((category) => (
              <Chip key={category.slug} variant="outline" className="px-1.5 py-0.5 text-[9px]">
                {category.name}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
