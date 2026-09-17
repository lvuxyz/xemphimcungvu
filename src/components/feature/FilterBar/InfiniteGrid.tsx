'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CACHE } from '@/lib/constants';
import { fetchListSource, listQueryKey, type ListSource } from '@/lib/list-source';
import type { ListFilters } from '@/types/filters';
import type { Movie, MovieListResult } from '@/types/movie';
import { useInView } from '@/hooks/useInView';
import { useDevice } from '@/hooks/useDevice';
import { Skeleton } from '@/components/ui/Skeleton';
import { MovieGrid } from './MovieGrid';

interface InfiniteGridProps {
  /** Nguồn danh sách, dạng serializable để client dựng lại lời gọi (§3.1). */
  source: ListSource;
  /** Filter lấy từ URL (§6.2). `page` ở đây là TRANG ĐẦU, trang sau do hook tự xin. */
  filters: ListFilters;
  /** Trang đầu đã được RSC fetch sẵn — lưới có nội dung ngay trong HTML đầu tiên. */
  initial: MovieListResult;
}

/**
 * §8.7 — infinite scroll trên `useInfiniteQuery`.
 *
 * Hai nhịp tách rời nhau, cố ý:
 *   · nhịp MẠNG   — hết trang đang có thì xin `page + 1` của API
 *   · nhịp HIỂN THỊ — mỗi lượt chỉ lộ thêm 12/18/24 item theo tier (§ thích ứng
 *     mạng): một trang API 24 phim trên 2G vẫn là 24 ảnh tải cùng lúc nếu đổ hết
 *     ra một lần.
 */
export function InfiniteGrid({ source, filters, initial }: InfiniteGridProps) {
  const { budget, tier } = useDevice();

  const firstPage = filters.page ?? 1;
  const chunk = budget.pageSize;

  /** Khoảng nhìn trước: mạng khoẻ nạp sớm cho mượt, mạng yếu nạp sát để đỡ phí. */
  const rootMargin = tier === 'low' ? '150px 0px' : tier === 'medium' ? '400px 0px' : '800px 0px';

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: listQueryKey(source, filters),
    queryFn: ({ pageParam, signal }) =>
      fetchListSource(source, { ...filters, page: pageParam }, { signal }),
    initialPageParam: firstPage,
    /**
     * Đếm trang bằng `pageParam` của chính mình chứ không tin `currentPage` của
     * response: endpoint nào trả thiếu field đó sẽ khiến adapter mặc định về 1,
     * và lưới xin lại trang 2 mãi mãi.
     */
    getNextPageParam: (last, _all, lastPageParam) =>
      last.items.length > 0 && lastPageParam < last.pagination.totalPages
        ? lastPageParam + 1
        : undefined,
    initialData: { pages: [initial], pageParams: [firstPage] },
    staleTime: CACHE.list.staleTime,
    gcTime: CACHE.list.gcTime,
  });

  /**
   * Danh sách được sắp theo `modified.time`, mà thứ tự đó đổi ngay giữa lúc
   * người dùng cuộn — trang 2 lặp lại phim của trang 1 là chuyện thường. Khử
   * trùng theo slug để không hiện hai card giống hệt nhau.
   */
  const movies = useMemo<Movie[]>(() => {
    const seen = new Set<string>();
    const out: Movie[] = [];
    for (const page of data?.pages ?? []) {
      for (const movie of page.items) {
        if (movie.slug && seen.has(movie.slug)) continue;
        if (movie.slug) seen.add(movie.slug);
        out.push(movie);
      }
    }
    return out;
  }, [data]);

  const total = data?.pages[0]?.pagination.totalItems ?? movies.length;

  const [visible, setVisible] = useState(chunk);
  /**
   * Chốt chặn chống gọi chồng phải nằm ở ref, KHÔNG phải state: để trong deps
   * thì mỗi lần set lại làm effect chạy lại, cleanup huỷ mất timer và lưới đứng
   * im ở trang đầu.
   */
  const loadingRef = useRef(false);

  // Đổi filter → RSC trả danh sách mới, phải hiển thị lại từ đầu.
  const resetKey = JSON.stringify(listQueryKey(source, filters));
  useEffect(() => {
    setVisible(chunk);
    loadingRef.current = false;
  }, [resetKey, chunk]);

  const hasLocal = visible < movies.length;
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin, once: false });

  useEffect(() => {
    if (!inView || loadingRef.current) return;
    if (!hasLocal && !hasNextPage) return;

    loadingRef.current = true;

    /**
     * Trễ nhẹ trước mỗi lượt: IntersectionObserver báo bất đồng bộ, lộ thêm item
     * ngay lập tức sẽ chạy hết cả danh sách trước khi observer kịp nhận ra mốc
     * sentinel đã rời viewport.
     */
    const timer = setTimeout(() => {
      if (hasLocal) setVisible((v) => Math.min(v + chunk, movies.length));
      else void fetchNextPage();
      loadingRef.current = false;
    }, 200);

    return () => {
      clearTimeout(timer);
      loadingRef.current = false;
    };
  }, [inView, hasLocal, hasNextPage, chunk, movies.length, fetchNextPage]);

  const shown = Math.min(visible, movies.length);
  const loading = isFetchingNextPage;
  const done = !hasNextPage && !hasLocal;

  return (
    <>
      <MovieGrid movies={movies.slice(0, shown)} priorityCount={budget.priorityImages} />

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

        {/* §14.1 — trang đầu vẫn còn nguyên trên màn, nên chỉ cần lối thử lại */}
        {error && !loading && (
          <div className="text-center">
            <p className="text-sm text-text-muted">Không tải được thêm phim.</p>
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              className="mt-3 rounded-pill bg-bg-elevated px-5 py-2 text-sm text-text-primary ring-1 ring-white/15 transition-colors duration-micro ease-standard hover:bg-bg-hover"
            >
              Thử lại
            </button>
          </div>
        )}

        {done && !error && movies.length > chunk && (
          <p className="text-center text-sm text-text-muted">Đã hiển thị hết phim.</p>
        )}

        {/* §13.3 — báo trạng thái tải cho screen reader */}
        <p aria-live="polite" className="sr-only">
          {loading ? 'Đang tải thêm phim' : `Đang hiển thị ${shown} trên ${total} phim`}
        </p>
      </div>
    </>
  );
}
