import type { Movie } from '@/types/movie';
import { MovieCard } from '../MovieCard/MovieCard';

/**
 * §8.7 — grid poster 2:3, responsive 2/3/4/6 cột.
 * Tắt HoverPreview: grid không có chỗ để card phóng to 1.35 mà không đè lên hàng dưới.
 */
export function MovieGrid({
  movies,
  priorityCount = 4,
}: {
  movies: Movie[];
  /**
   * Số ảnh được `priority` (sinh <link rel=preload>). Mỗi ảnh preload là một
   * request tranh băng thông ngay lúc trang đang dựng — mạng yếu thì ít lại,
   * nên InfiniteGrid truyền xuống theo tier thật (§12.2).
   */
  priorityCount?: number;
}) {
  if (movies.length === 0) return null;

  return (
    <ul
      role="list"
      className="grid grid-cols-2 gap-3 px-row sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
    >
      {movies.map((movie, index) => (
        <li key={`${movie.slug}-${index}`}>
          <MovieCard
            movie={movie}
            variant="grid"
            enableHoverPreview={false}
            priority={index < priorityCount}
          />
        </li>
      ))}
    </ul>
  );
}

/** Tiêu đề trang danh sách + số lượng kết quả. */
export function ListHeader({ title, count }: { title: string; count: number }) {
  return (
    <header className="px-row pt-24">
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-text-muted">{count} phim</p>
    </header>
  );
}

/** §14.1 / §8.7 — không có kết quả thì nói rõ, không để trang trắng. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-row py-24 text-center">
      <p className="text-lg font-medium text-text-primary">{title}</p>
      {hint && <p className="mt-2 text-sm text-text-muted">{hint}</p>}
    </div>
  );
}
