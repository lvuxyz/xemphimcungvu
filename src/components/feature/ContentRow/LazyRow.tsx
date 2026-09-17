'use client';

import { useQuery } from '@tanstack/react-query';
import { CACHE, ROW_LIMIT } from '@/lib/constants';
import { fetchListSource, listQueryKey, type ListSource } from '@/lib/list-source';
import { useInView } from '@/hooks/useInView';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ContentRow } from './ContentRow';

interface LazyRowProps {
  title: string;
  source: ListSource;
  /** Link "Xem tất cả" ở tiêu đề row */
  href?: string;
  limit?: number;
}

/**
 * §11.2 — row KHÔNG nằm trong `/v1/api/home` thì fetch lazy khi vào viewport.
 *
 * Đây là điểm mấu chốt của thứ tự fetch trang chủ: RSC chỉ dựng hero + row đầu,
 * 10 row còn lại tự gọi khi người dùng cuộn tới. Bắn cả 11 request lúc load là
 * lỗi phá LCP mà §11.2 nêu đích danh.
 *
 * §14.1 — "List API fail → ẩn row đó, các row khác vẫn render": lỗi hoặc rỗng
 * thì trả `null`, không hiện thông báo lỗi giữa trang chủ.
 */
export function LazyRow({ title, source, href, limit = ROW_LIMIT }: LazyRowProps) {
  const filters = { limit };

  /**
   * `once: true` — đã fetch thì thôi, TanStack Query giữ cache phần còn lại.
   *
   * rootMargin 75% ≈ ba row phía trước. Một row chỉ cao hơn 200px một chút nên
   * mỗi nấc nới rộng đều kéo theo vài row nữa cùng bắn: đo thật ở scrollY = 300,
   * 150% cho 7 request song song, 75% cho 6. Điều quan trọng của §11.2 vẫn đúng
   * ở cả hai mức — lúc trang vừa load (scrollY = 0) KHÔNG có request nào.
   */
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: '75% 0px', once: true });

  const { data, isError } = useQuery({
    queryKey: listQueryKey(source, filters),
    queryFn: ({ signal }) => fetchListSource(source, filters, { signal }),
    enabled: inView,
    staleTime: CACHE.list.staleTime,
    gcTime: CACHE.list.gcTime,
  });

  if (isError || (data && data.items.length === 0)) return null;

  if (!data) {
    return (
      <section ref={ref} className="py-3" aria-labelledby={`row-skeleton-${title}`}>
        <div className="mb-2 px-row">
          <h2
            id={`row-skeleton-${title}`}
            className="text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg"
          >
            {title}
          </h2>
        </div>
        {/* §12.2 — skeleton giữ đúng chỗ của row, không dùng spinner */}
        <div className="flex gap-2 px-row" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[45%] shrink-0 sm:w-[30%] lg:w-[19%] 2xl:w-[16%]">
              <CardSkeleton />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return <ContentRow title={title} movies={data.items} href={href} />;
}
