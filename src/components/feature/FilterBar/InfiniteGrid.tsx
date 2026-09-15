'use client';

import { useEffect, useRef, useState } from 'react';
import type { Movie } from '@/types/movie';
import { useInView } from '@/hooks/useInView';
import { useDevice } from '@/hooks/useDevice';
import { Skeleton } from '@/components/ui/Skeleton';
import { MovieGrid } from './MovieGrid';

interface InfiniteGridProps {
  /**
   * Toàn bộ phim khớp filter, do RSC truyền xuống.
   *
   * Dữ liệu đi qua RSC payload chứ không nằm trong JS bundle, nên không ảnh hưởng
   * ngân sách §12.1. Khi nối API thật, đổi thành `useInfiniteQuery` +
   * `pagination.totalPages` và bỏ prop này (§8.7).
   */
  movies: Movie[];
  /** Bỏ trống để lấy theo chất lượng mạng (12 / 18 / 24 item mỗi lượt). */
  pageSize?: number;
}

/**
 * §8.7 — infinite scroll.
 *
 * Phần quan sát viewport, skeleton giữ layout và trạng thái "hết phim" đã đúng
 * bản cuối; chỉ nguồn dữ liệu là tạm.
 */
export function InfiniteGrid({ movies, pageSize: fixedPageSize }: InfiniteGridProps) {
  const { budget, tier } = useDevice();

  /**
   * Mạng yếu tải 12 item một lượt thay vì 24: nửa số ảnh, người dùng thấy hàng
   * đầu tiên sớm gấp đôi, và nếu họ dừng lại ở đó thì cũng không tốn phần còn lại.
   */
  const pageSize = fixedPageSize ?? budget.pageSize;

  /** Khoảng nhìn trước: mạng khoẻ nạp sớm cho mượt, mạng yếu nạp sát để đỡ phí. */
  const rootMargin = tier === 'low' ? '150px 0px' : tier === 'medium' ? '400px 0px' : '800px 0px';

  const [visible, setVisible] = useState(pageSize);
  const [loading, setLoading] = useState(false);
  /**
   * Chốt chặn chống gọi chồng phải nằm ở ref, KHÔNG phải state.
   * Nếu để `loading` trong deps thì `setLoading(true)` sẽ làm effect chạy lại,
   * cleanup huỷ mất timer và lưới đứng im mãi ở trang đầu.
   */
  const loadingRef = useRef(false);

  const hasMore = visible < movies.length;
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin, once: false });

  // Đổi filter → RSC trả danh sách mới, phải cuộn lại từ trang 1.
  useEffect(() => {
    setVisible(pageSize);
    loadingRef.current = false;
    setLoading(false);
  }, [movies, pageSize]);

  useEffect(() => {
    if (!inView || loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);

    // Trễ nhẹ để skeleton kịp hiện, tránh nhấp nháy khi dữ liệu có ngay lập tức.
    const timer = setTimeout(() => {
      setVisible((v) => v + pageSize);
      setLoading(false);
      loadingRef.current = false;
    }, 250);

    return () => {
      clearTimeout(timer);
      loadingRef.current = false;
    };
  }, [inView, hasMore, pageSize]);

  return (
    <>
      <MovieGrid movies={movies.slice(0, visible)} priorityCount={budget.priorityImages} />

      <div ref={ref} className="px-row py-8">
        {loading && (
          <ul
            role="list"
            aria-hidden="true"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="aspect-poster w-full" />
              </li>
            ))}
          </ul>
        )}

        {!hasMore && movies.length > pageSize && (
          <p className="text-center text-sm text-text-muted">Đã hiển thị hết phim.</p>
        )}

        {/* §13.3 — báo trạng thái tải cho screen reader */}
        <p aria-live="polite" className="sr-only">
          {loading
            ? 'Đang tải thêm phim'
            : `Đang hiển thị ${Math.min(visible, movies.length)} trên ${movies.length} phim`}
        </p>
      </div>
    </>
  );
}
