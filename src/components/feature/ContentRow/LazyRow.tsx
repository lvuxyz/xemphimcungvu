'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/cn';
import { CACHE } from '@/lib/constants';
import { fetchHomeSection, homeSectionLayout, type HomeSection } from '@/lib/home';
import { queryKeys } from '@/lib/query-keys';
import { useInView } from '@/hooks/useInView';
import { useHasScrolled } from '@/hooks/useHasScrolled';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ContentRow, ROW_CARD_WIDTH } from './ContentRow';

interface LazyRowProps {
  title: string;
  section: HomeSection;
  /** Link "Xem tất cả" ở tiêu đề row */
  href?: string;
}

/**
 * Một section lazy của trang chủ: chỉ gọi `/api/home/{section}` khi người xem
 * cuộn gần tới. "Mới cập nhật" đã nằm sẵn trong HTML, nên lúc trang vừa mở ra
 * KHÔNG section nào dưới mép màn hình được tải.
 *
 * Chống request thừa — cả ba thứ đều do TanStack Query lo, không tự viết lại:
 *
 *   · cache 5 phút (`CACHE.home`): rời trang chủ rồi quay lại trong 5 phút là 0
 *     request, section hiện ngay từ cache
 *   · dedupe theo query key: hai lượt mount cùng lúc (StrictMode, điều hướng
 *     nhanh) chỉ ra một request
 *   · huỷ khi unmount: `signal` đi thẳng vào `fetch`, rời trang giữa chừng là
 *     request bị abort chứ không chạy nốt cho một component đã mất
 *
 * §14.1 — "List API fail → ẩn row đó, các row khác vẫn render": mỗi section là
 * một query riêng, lỗi hoặc rỗng thì trả `null`, không hiện thông báo lỗi giữa
 * trang chủ và không kéo section nào khác theo.
 */
export function LazyRow({ title, section, href }: LazyRowProps) {
  /**
   * Lề nhìn trước 200px, nhưng chỉ SAU lần cuộn đầu tiên (xem `useHasScrolled`).
   *
   * Trước đó, section phải lộ ít nhất 64px (tiêu đề + mép trên dải card) mới tính
   * là đang hiện:
   *   · lộ thật thì vẫn tải — để khung xám có tiêu đề nằm đó cho tới khi người xem
   *     chạm vào trang thì trông như trang hỏng
   *   · chỉ lề đệm `py-3` ló lên vài pixel thì không — đo ở 1280×720, "Phim bộ"
   *     ló đúng 2px dưới mép màn hình và với lề 0 nó vẫn bắn request lúc mở trang
   *
   * Bản cũ nới 75% chiều cao màn hình ngay từ đầu, và ở 1075×922 hay 375×812 điều
   * đó nghĩa là 6 request tới KKPhim ở `scrollY = 0` (đo trên bản build).
   */
  const hasScrolled = useHasScrolled();
  const { ref, inView } = useInView<HTMLDivElement>({
    rootMargin: hasScrolled ? '200px 0px' : '0px 0px -64px 0px',
    once: true,
  });

  const { data, isError } = useQuery({
    queryKey: queryKeys.homeSection(section),
    queryFn: ({ signal }) => fetchHomeSection(section, { signal }),
    enabled: inView,
    staleTime: CACHE.home.staleTime,
    gcTime: CACHE.home.gcTime,
    /** Route của mình, đã cache sẵn — hỏng thì thử lại một lần là đủ. */
    retry: 1,
  });

  const variant = homeSectionLayout(section);

  if (isError || (data && data.length === 0)) return null;

  if (!data) {
    return (
      <section ref={ref} className="py-3" aria-labelledby={`row-skeleton-${section}`}>
        <div className="mb-2 px-row">
          <h2
            id={`row-skeleton-${section}`}
            className="text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg"
          >
            {title}
          </h2>
        </div>
        {/*
          §12.2 — skeleton giữ ĐÚNG chỗ của row thật, không dùng spinner:
            · `py-1` = phần `.row-track` thật sự chừa ra trên/dưới dải card (padding
              chừa chỗ phóng to trừ đi margin âm, còn đúng 0.25rem mỗi phía)
            · `meta` = khối tên/năm dưới ảnh, có khi card không có HoverPreview
          Thiếu hai thứ đó thì dữ liệu về là row cao thêm 8px (desktop) hoặc 80px
          (điện thoại) và mọi thứ bên dưới giật theo.

          Số ô = số card lấp kín khổ rộng nhất (6 ảnh ngang, 8 poster).
          `overflow-hidden` là BẮT BUỘC: các ô `shrink-0` rộng hơn màn hình, thiếu
          nó thì cả trang cuộn ngang được 160px ở màn 1366 (đo thật).
        */}
        <div className="flex gap-2 overflow-hidden px-row py-1" aria-hidden="true">
          {Array.from({ length: variant === 'poster' ? 8 : 6 }).map((_, i) => (
            <div key={i} className={cn('shrink-0', ROW_CARD_WIDTH[variant])}>
              <CardSkeleton aspect={variant === 'poster' ? 'poster' : 'backdrop'} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  /**
   * `inView` ở đây là của khung chờ: dữ liệu về SAU khi nó lọt tầm nhìn thì row
   * thật cũng đang ở đó. Dữ liệu có sẵn từ cache lúc mount (quay lại trang chủ)
   * thì khung chờ chưa từng dựng, `inView` là `false` — row tự chờ observer như cũ,
   * không mount 16 card cho một row còn nằm tận cuối trang.
   */
  return (
    <ContentRow title={title} movies={data} variant={variant} href={href} mountedInView={inView} />
  );
}
