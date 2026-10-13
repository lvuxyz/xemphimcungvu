import { SmartImage } from '@/components/ui/SmartImage';
import { PLACEHOLDER_BACKDROP } from '@/lib/constants';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { firstEpisodeHref, matchScore, metaLine, statusLabel } from '@/lib/derive';
import { sanitizeHtml } from '@/lib/sanitize';
import { routes } from '@/lib/routes';
import type { Movie, MovieDetailBundle } from '@/types/movie';
import { Button } from '@/components/ui/Button';
import { Chip, MatchScore } from '@/components/ui/Chip';
import { PlayIcon } from '@/components/ui/icons';
import { MyListButton } from './MyListButton';
import { CastRow } from '../CastRow/CastRow';
import { MovieCard } from '../MovieCard/MovieCard';
import { EpisodePicker } from './EpisodePicker';

/**
 * §8.5 — thân nội dung chi tiết, dùng CHUNG cho modal (intercepting route)
 * và trang full `/phim/[slug]`. Một nguồn sự thật, hai khung chứa.
 *
 * Khung chứa nào cũng dựng bằng `.surface-elevated`: mọi thứ bên trong tô nền
 * theo bậc tương đối (`surface`, `raised`), nên không phần nào ở đây phải biết
 * nó đang nằm trên modal hay trên trang.
 *
 * Thứ tự nội dung bám đúng §8.5:
 *   1. backdrop hero
 *   2. title + originName
 *   3. meta row + badge % phù hợp
 *   4. content (ĐÃ sanitize)
 *   5. keyword chips
 *   6. cast row
 *   7. tabs server + grid tập
 *   8. "Có thể bạn thích"
 */
interface DetailContentProps {
  detail: MovieDetailBundle;
  /** §8.5 mục 8 — "Có thể bạn thích", do RSC fetch sẵn (`getRelated`). */
  related?: Movie[];
}

export function DetailContent({ detail, related = [] }: DetailContentProps) {
  const { movie, episodes, images, peoples, keywords } = detail;

  const backdrop = images.backdrops[0] ?? movie.thumb;
  // §14.4 — content là HTML thô từ API, BẮT BUỘC sanitize trước khi render.
  const safeContent = sanitizeHtml(movie.content);

  return (
    <article>
      {/* 1 — backdrop hero */}
      <header className="relative aspect-backdrop w-full overflow-hidden">
        <SmartImage
          src={backdrop}
          fallbackSrc={PLACEHOLDER_BACKDROP}
          alt={`${movie.name} (${movie.year})`}
          fill
          sizes={IMAGE_SIZES.hero}
          priority
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent"
        />

        <div className="absolute inset-x-0 bottom-0 space-y-3 p-6 md:p-8">
          {/* 2 — title + originName */}
          <h1 className="text-balance text-2xl font-extrabold leading-tight tracking-[-0.02em] md:text-4xl">
            {movie.name}
          </h1>
          {movie.originName && movie.originName !== movie.name && (
            <p className="text-sm text-text-secondary">{movie.originName}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button href={firstEpisodeHref(movie.slug, episodes[0]?.episodes[0]?.slug)} variant="primary">
              <PlayIcon />
              Phát
            </Button>
            <MyListButton movie={movie} />
          </div>
        </div>
      </header>

      <div className="grid gap-8 p-6 md:grid-cols-[1fr_16rem] md:p-8">
        <div className="min-w-0 space-y-6">
          {/* 3 — meta row + % phù hợp */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <MatchScore score={matchScore(movie)} />
            <span className="text-text-secondary">{metaLine(movie)}</span>
            {movie.subExclusive && <Chip variant="accent">Sub độc quyền</Chip>}
            {movie.inTheater && <Chip variant="outline">Chiếu rạp</Chip>}
          </div>

          {/* 4 — mô tả đã sanitize */}
          {safeContent && (
            <div
              className="prose-movie max-w-prose text-sm"
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />
          )}

          {/* 5 — keyword chips, tối đa 8, click → tìm kiếm */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keywords.slice(0, 8).map((keyword) => (
                <Chip
                  key={keyword}
                  variant="outline"
                  href={routes.search(keyword)}
                >
                  {keyword}
                </Chip>
              ))}
            </div>
          )}

          {/* 6 — cast row */}
          <CastRow people={peoples} />

          {/* 7 — tabs server + grid tập */}
          <EpisodePicker slug={movie.slug} servers={episodes} />
        </div>

        {/* Cột phụ: thông tin dạng bảng */}
        <aside className="space-y-4 text-sm">
          <MetaBlock label="Trạng thái" value={statusLabel(movie.status)} />
          <MetaBlock label="Tổng số tập" value={movie.episodeTotal} />
          <MetaBlock
            label="Thể loại"
            value={movie.categories.map((c) => c.name).join(', ')}
          />
          <MetaBlock label="Quốc gia" value={movie.countries.map((c) => c.name).join(', ')} />
          <MetaBlock label="Đạo diễn" value={movie.directors.join(', ')} />
          <MetaBlock label="Diễn viên" value={movie.actors.slice(0, 6).join(', ')} />
        </aside>
      </div>

      {/* 8 — có thể bạn thích */}
      {related.length > 0 && (
        <section className="px-6 pb-8 md:px-8" aria-labelledby="related-heading">
          <h3 id="related-heading" className="mb-3 text-sm font-bold text-text-primary">
            Có thể bạn thích
          </h3>
          <ul
            role="list"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          >
            {related.slice(0, 12).map((item) => (
              <li key={item.slug}>
                <MovieCard movie={item} variant="grid" enableHoverPreview={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-text-secondary">{value}</dd>
    </div>
  );
}
