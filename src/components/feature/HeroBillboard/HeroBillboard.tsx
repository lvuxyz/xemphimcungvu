'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { PLACEHOLDER_BACKDROP } from '@/lib/constants';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { firstEpisodeHref, matchScore, metaLine } from '@/lib/derive';
import type { Movie, MovieImages } from '@/types/movie';
import { useDevice } from '@/hooks/useDevice';
import { Button } from '@/components/ui/Button';
import { MatchScore } from '@/components/ui/Chip';
import { InfoIcon, PlayIcon } from '@/components/ui/icons';
import { HeroTrailer } from './HeroTrailer';

interface HeroBillboardProps {
  movie: Movie;
  images: MovieImages;
  /** §8.2 — link YouTube. Rỗng thì hero giữ ảnh tĩnh. */
  trailerUrl?: string;
}

/**
 * §8.2 — HeroBillboard.
 *
 * Lớp hiển thị từ dưới lên:
 *   layer 0  ảnh nền blur(40px) scale(1.15)  ← chỉ khi phải fallback thumb
 *   layer 1  backdrop từ /images, Ken Burns scale 1.0 → 1.08 trong 20s
 *   layer 2  gradient trái
 *   layer 3  gradient đáy nối liền vào row đầu tiên
 *   layer 4  nội dung
 *
 * ⚠️ Sai lệch so với §8.2: API không trả ảnh `logo` nào (khảo sát 10 phim chỉ có
 * `backdrop` và `poster`), nên title luôn dựng bằng chữ. `images.logos` vẫn được
 * đọc phòng khi API bổ sung sau.
 */
export function HeroBillboard({ movie, images, trailerUrl = '' }: HeroBillboardProps) {
  const { reducedMotion, budget } = useDevice();

  const backdrop = images.backdrops[0];
  // Không có backdrop thì dùng thumb độ phân giải thấp + bật layer 0 (§17 rủi ro #4).
  const source = backdrop ?? movie.thumb;
  const needsBlurLayer = !backdrop;
  const logo = images.logos[0];

  return (
    <section className="relative h-[56vw] max-h-[80svh] min-h-[min(30rem,88svh)] w-full">
      {/* layer 0 — nền blur cứu ảnh độ phân giải thấp */}
      {needsBlurLayer && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <SmartImage
            src={source}
            fallbackSrc={PLACEHOLDER_BACKDROP}
            alt=""
            fill
            // Blur 40px thì chi tiết không còn nghĩa lý gì — lấy bản nhỏ nhất.
            sizes="320px"
            quality={30}
            className="scale-[1.15] object-cover blur-[40px]"
          />
        </div>
      )}

      {/* layer 1 — backdrop + Ken Burns */}
      <div className="absolute inset-0 overflow-hidden">
        <SmartImage
          src={source}
          fallbackSrc={PLACEHOLDER_BACKDROP}
          alt={`${movie.name} (${movie.year})`}
          fill
          sizes={IMAGE_SIZES.hero}
          priority
          fetchPriority="high"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className={cn(
            'object-cover',
            needsBlurLayer && 'object-contain',
            // §9.4 — tắt Ken Burns khi giảm chuyển động, và khi máy/mạng yếu:
            // animation 20s giữ cả layer ảnh full-bleed trên compositor.
            !reducedMotion && budget.kenBurns && 'animate-kenburns',
          )}
        />
      </div>

      {/* layer 1b — trailer đè lên backdrop sau 2500ms (§8.2) */}
      <HeroTrailer trailerUrl={budget.heroTrailer ? trailerUrl : ''} title={movie.name} />

      {/* layer 2 — gradient trái */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'var(--hero-gradient-side)' }}
      />

      {/* layer 3 — gradient đáy nối liền vào row đầu tiên */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'var(--hero-gradient-bottom)' }}
      />

      {/* layer 4 — nội dung */}
      <div className="absolute inset-0 flex items-end pt-20 pb-10 sm:pb-12 md:pb-16 lg:pb-20">
        <div className="w-full max-w-2xl space-y-3 sm:space-y-4 px-row drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
          {logo ? (
            <SmartImage
              src={logo}
              alt={movie.name}
              width={480}
              height={200}
              className="max-h-[22vh] w-auto object-contain"
              priority
            />
          ) : (
            <h1 className="text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-text-primary drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] md:text-5xl lg:text-6xl">
              {movie.name}
            </h1>
          )}

          {movie.originName && movie.originName !== movie.name && (
            <p className="text-sm font-medium text-text-secondary drop-shadow-md md:text-base">{movie.originName}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm drop-shadow-md">
            <MatchScore score={matchScore(movie)} />
            <span className="text-text-secondary">{metaLine(movie)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button href={firstEpisodeHref(movie.slug)} variant="primary" size="lg">
              <PlayIcon />
              Phát
            </Button>
            <Button href={`/phim/${movie.slug}`} variant="secondary" size="lg">
              <InfoIcon />
              Thông tin khác
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
