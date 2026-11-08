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
import { useListPending } from './list-pending';

interface InfiniteGridProps {
  /** Nguồn danh sách, dạng serializable để client dựng lại lời gọi (§3.1). */
  source: ListSource;
  /** Filter lấy từ URL (§6.2). `page` ở đây là TRANG ĐẦU, trang sau do hook tự xin. */
  filters: ListFilters;
  /** Trang đầu đã được RSC fetch sẵn — lưới có nội dung ngay trong HTML đầu tiên. */
  initial: MovieListResult;
}

/**
 * Số item đã lộ ra của từng danh sách (theo query key), sống ở module để qua
 * được một lần unmount: list → `/xem` (hay trang `/phim` đầy đủ) thay segment
 * `children`, lưới bị gỡ; Back dựng lại từ router cache với state mới tinh. Nếu
 * quay về đúng `chunk` đầu thì trang ngắn hẳn đi, trình duyệt kẹp vị trí cuộn đã
 * lưu, rồi sentinel lộ thêm từng chunk một — trang giật lên rồi dài dần ra.
 *
 * Không dùng sessionStorage: Map rỗng ở lần tải cứng nên SSR và lượt render đầu
 * ở client vẫn y hệt (đều là `chunk`) — không lệch hydration. Remount mềm thì
 * không hydrate, render đầu lớn hơn cũng không sao.
 */
const revealedByKey = new Map<string, number>();
/** Trần số danh sách nhớ — đủ cho vài lượt đi/về, không phình mãi theo phiên. */
const REVEALED_MAX = 20;

function rememberRevealed(key: string, count: number): void {
  // Xoá rồi đặt lại để key vừa dùng xuống cuối — thứ tự chèn của Map thành LRU.
  revealedByKey.delete(key);
  revealedByKey.set(key, count);
  if (revealedByKey.size > REVEALED_MAX) {
    const oldest = revealedByKey.keys().next().value;
    if (oldest !== undefined) revealedByKey.delete(oldest);
  }
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
    /**
     * Quay lại một danh sách đã cuộn tới trang N mà query đã stale thì TanStack
     * refetch lại CẢ N trang, nối đuôi nhau: N request lên API ngay lúc Back, và
     * thứ tự phim có thể đổi dưới tay người dùng đúng lúc trình duyệt khôi phục
     * vị trí cuộn. Giữ nguyên thứ đã thấy; gcTime (CACHE.list) chặn độ cũ, đổi
     * filter là key mới nên vẫn lấy dữ liệu mới. Không dùng `maxPages`: lưới chỉ
     * xin trang sau, bỏ trang đầu thì phần trên của lưới biến mất.
     */
    refetchOnMount: false,
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

  const resetKey = JSON.stringify(listQueryKey(source, filters));
  /**
   * Kẹp theo số phim đang có: Map sống lâu hơn query (gcTime) — query bị dọn mà
   * Map còn số cũ thì mỗi trang fetch về sẽ lộ ra hết một lượt, bỏ qua `chunk`.
   */
  const [visible, setVisible] = useState(() => {
    const remembered = revealedByKey.get(resetKey);
    return remembered === undefined ? chunk : Math.max(chunk, Math.min(remembered, movies.length));
  });
  /**
   * Chốt chặn chống gọi chồng phải nằm ở ref, KHÔNG phải state: để trong deps
   * thì mỗi lần set lại làm effect chạy lại, cleanup huỷ mất timer và lưới đứng
   * im ở trang đầu.
   */
  const loadingRef = useRef(false);

  /**
   * Đổi filter → RSC trả danh sách mới, phải hiển thị lại từ đầu. Chỉ khi key
   * THẬT SỰ đổi so với lượt trước — không chạy lúc mount, kẻo xoá mất số đã khôi
   * phục từ `revealedByKey` khi Back.
   */
  const prevKeyRef = useRef(resetKey);
  useEffect(() => {
    if (prevKeyRef.current === resetKey) return;
    prevKeyRef.current = resetKey;
    revealedByKey.delete(resetKey);
    setVisible(chunk);
    loadingRef.current = false;
    // `chunk` cố ý không nằm trong deps: tier đổi sau hydrate không phải lý do reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  /**
   * Tier của useDevice ổn định sau hydrate nên `chunk` có thể đổi một lần. Chỉ
   * nới lên, không thu lại: thu lại là cắt bớt card đang nằm trên màn (layout
   * shift), và có thể đè mất số đã khôi phục khi Back.
   */
  useEffect(() => {
    setVisible((v) => Math.max(v, chunk));
  }, [chunk]);

  useEffect(() => {
    rememberRevealed(resetKey, visible);
  }, [resetKey, visible]);

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

  /** Đang chờ RSC của filter / từ khoá mới — xem `list-pending.ts`. */
  const pending = useListPending();

  return (
    <>
      {/*
       * Làm mờ lưới cũ trong lúc chờ để người dùng biết click đã ăn. Trễ 100ms
       * mới mờ: lượt trúng cache về gần như tức thì, mờ ngay thì chỉ thấy nháy.
       * Hết chờ là cây mới thay vào, nên chiều ngược lại không cần trễ.
       */}
      <div
        data-pending={pending || undefined}
        aria-busy={pending || undefined}
        className="transition-opacity duration-micro ease-standard data-[pending]:pointer-events-none data-[pending]:opacity-60 data-[pending]:delay-100"
      >
        <MovieGrid movies={movies.slice(0, shown)} priorityCount={budget.priorityImages} />
      </div>

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
