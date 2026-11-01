'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/constants';
import type { CardMovie } from '@/types/movie';
import { useRowScroll } from '@/hooks/useRowScroll';
import { useInView } from '@/hooks/useInView';
import { useDevice } from '@/hooks/useDevice';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { IMAGE_SIZES } from '@/lib/image';
import { MovieCard } from '../MovieCard/MovieCard';

export type RowVariant = 'backdrop' | 'poster';

/**
 * Bề rộng một card theo breakpoint, cho từng kiểu row.
 *
 * DÙNG CHUNG với khung chờ của `LazyRow`: lệch nhau là cả hàng đổi bề rộng đúng lúc
 * dữ liệu về. `IMAGE_SIZES.posterRowCard` cũng khai theo đúng thang của `poster`.
 */
export const ROW_CARD_WIDTH: Record<RowVariant, string> = {
  backdrop: 'w-[45%] sm:w-[30%] lg:w-[19%] 2xl:w-[16%]',
  poster: 'w-[36%] sm:w-[24%] lg:w-[15%] 2xl:w-[12.5%]',
};

interface ContentRowProps {
  title: string;
  movies: CardMovie[];
  /**
   * `backdrop` — ảnh ngang 16:9, có HoverPreview (mặc định).
   * `poster`   — poster 2:3, tên phim luôn hiện dưới ảnh, KHÔNG có HoverPreview:
   *              preview là khung 16:9 cùng bề rộng card, mà card poster hẹp hơn
   *              card ngang ~20% — hàng nút và chip của preview không còn chỗ.
   */
  variant?: RowVariant;
  /** Link "Xem tất cả" ở tiêu đề row */
  href?: string;
  /**
   * Row đầu trang chủ: card có mặt ngay trong HTML server render, và trang card
   * đầu tiên tải ảnh `eager` (§12.2). Xem chú thích ở chỗ render card.
   */
  priority?: boolean;
  /**
   * Row được dựng khi CHẮC CHẮN đã ở sát màn hình — `LazyRow` chỉ có dữ liệu sau
   * khi chính nó vừa lọt vào tầm nhìn trước. Khởi đầu thẳng ở trạng thái "đang
   * hiện" thay vì chờ IntersectionObserver báo lại một khung hình sau.
   */
  mountedInView?: boolean;
}

/**
 * §8.3 — carousel ngang tự viết.
 *
 * Không dùng swiper/slick: cần kiểm soát hoàn toàn transform-origin và timing.
 * Bước chuyển là NGUYÊN TRANG item, không phải từng item.
 *
 * Xem chú thích `.row-track` trong styles/globals.css về việc §8.3 yêu cầu
 * `overflow: visible` nhưng CSS không cho phép, và cách đi vòng.
 */
/** Phạm vi module: đã có row nào hiện trong phiên này chưa — xem `animateEnter`. */
let rowsShown = false;

export function ContentRow({
  title,
  movies,
  variant = 'backdrop',
  href,
  priority = false,
  mountedInView = false,
}: ContentRowProps) {
  const { ref, canScrollPrev, canScrollNext, scrollNext, scrollPrev, originFor } =
    useRowScroll<HTMLUListElement>();
  const { cols, canHover } = useDevice();
  const poster = variant === 'poster';

  /**
   * Row đầu (nằm ngay dưới hero) và row `LazyRow` vừa dựng đều BIẾT mình đang ở
   * trong tầm nhìn lúc mount. Chờ observer báo thì khung hình đầu mang
   * `row-offscreen` — `content-visibility: auto` bật rồi tắt ngay — và Chrome ghi
   * đó là một cặp layout shift giữa lúc đang cuộn (đo trên bản build: CLS 0.015
   * ở 1280×720, toàn bộ đến từ đúng chỗ này).
   */
  const startsInView = priority || mountedInView;

  /**
   * Hai thứ khác nhau, cố ý tách:
   *   inView      — theo dõi LIÊN TỤC, để bật lại `content-visibility` mỗi lần row
   *                 rời viewport. Bản cũ `once: true` nên row nào đã hiện một lần
   *                 là mất luôn containment, cuộn xuống cuối trang chủ là nặng dần.
   *   hasEntered  — chỉ bật một lần, để card đã mount thì không bị unmount rồi
   *                 mount lại (mất state hover, ảnh nháy) khi cuộn qua cuộn lại.
   */
  const { ref: sectionRef, inView } = useInView<HTMLElement>({
    rootMargin: '100% 0px',
    once: false,
    initialInView: startsInView,
  });
  /**
   * Row `priority` khởi tạo THẲNG ở `true`, không chờ IntersectionObserver.
   *
   * Khởi tạo `false` cho mọi row nghĩa là không card nào có mặt trong HTML server
   * render — đếm thật trên trang chủ đã build: đúng MỘT thẻ `<img>` (ảnh hero) và
   * 113 chỗ `skeleton`. Row đầu chỉ bắt đầu tải ảnh sau khi ~152 kB JS về và
   * hydrate xong; trên 3G đó là vài giây nhìn ô xám, và `priority` truyền xuống
   * card cũng vô nghĩa vì lúc preload scanner quét HTML thì card chưa tồn tại.
   *
   * Row đầu thì luôn nằm ngay dưới hero — nó KHÔNG phải thứ cần tiết kiệm. Row
   * `LazyRow` vừa dựng cũng vậy: dữ liệu về đúng lúc nó sắp lọt vào màn hình, mà
   * chờ thêm một khung hình để thay ô chờ bằng card chỉ là thêm một lần nháy.
   */
  const [hasEntered, setHasEntered] = useState(startsInView);

  useEffect(() => {
    if (inView) setHasEntered(true);
  }, [inView]);

  /**
   * §9.3 stagger chỉ dành cho lúc card XUẤT HIỆN lần đầu, không phải mỗi lần
   * component mount. Back về trang chủ dựng lại mọi row: chạy lại stagger là bắt
   * người xem chờ ~620ms để card cuối hàng đầu hiện đủ — cho thứ họ vừa thấy cách
   * đây vài giây, chồng lên đúng lúc trang đang chuyển.
   *
   * Chỉ stagger ở lượt tải ĐẦU của phiên, hoặc khi `LazyRow` vừa thay khung chờ
   * bằng card (`mountedInView`) — đó mới là "xuất hiện". Row dựng lại từ cache
   * (Back về trang chủ) thì hiện thẳng. Server và lượt hydrate đều thấy
   * `rowsShown = false` nên không lệch HTML.
   */
  const [animateEnter] = useState(() => mountedInView || !rowsShown);

  useEffect(() => {
    rowsShown = true;
  }, []);

  // §13.1 — roving tabindex: chỉ một card trong row nhận Tab.
  const [rovingIndex, setRovingIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLUListElement | null) => {
      listRef.current = node;
      (ref as React.MutableRefObject<HTMLUListElement | null>).current = node;
    },
    [ref],
  );

  const focusCard = useCallback((index: number) => {
    const cards = listRef.current?.querySelectorAll<HTMLElement>('[data-card]');
    if (!cards || cards.length === 0) return;

    const next = Math.max(0, Math.min(index, cards.length - 1));
    setRovingIndex(next);
    cards[next]?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCard(rovingIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCard(rovingIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusCard(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusCard(movies.length - 1);
    }
  };

  if (movies.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      // §12.2 — row ngoài viewport không tốn chi phí layout/paint
      className={cn(
        'group/row relative z-0 py-3 transition-[z-index] focus-within:z-20 hover:z-20',
        !inView && 'row-offscreen',
      )}
      aria-labelledby={`row-${title}`}
    >
      <div className="mb-2 flex items-baseline gap-3 px-row">
        <h2
          id={`row-${title}`}
          className="text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg"
        >
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className={cn(
              'text-xs text-text-muted transition-opacity duration-standard ease-standard',
              'hover:text-accent-hover focus-visible:opacity-100',
              // Màn cảm ứng không hover được: link phải hiện sẵn, nếu không là mất lối đi
              canHover ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-100',
            )}
          >
            Xem tất cả →
          </Link>
        )}
      </div>

      <div className="row-viewport">
        {/* Mũi tên chỉ có nghĩa khi có chuột — ngón tay thì vuốt (§8.3) */}
        {canHover && (
          <>
            <RowArrow
              side="left"
              visible={canScrollPrev}
              onClick={scrollPrev}
              label={`Cuộn ngược ${title}`}
            />
            <RowArrow
              side="right"
              visible={canScrollNext}
              onClick={scrollNext}
              label={`Cuộn tiếp ${title}`}
            />
          </>
        )}

        <ul ref={setRefs} onKeyDown={onKeyDown} className="row-track" role="list">
          {movies.map((movie, index) => (
            <li
              key={`${movie.slug}-${index}`}
              className={cn(
                'row-item relative z-0 focus-within:z-30 hover:z-30',
                ROW_CARD_WIDTH[variant],
                hasEntered && animateEnter && 'row-item-enter',
              )}
              // §9.3 — stagger 40ms/item, dừng sau 8 item
              style={{ '--stagger': Math.min(index, MOTION.staggerMax) } as React.CSSProperties}
            >
              {hasEntered ? (
                /*
                  Cố ý KHÔNG truyền `priority` xuống card, kể cả ở row đầu.
                  `priority` sinh ra `<link rel=preload>` + `fetchpriority=high`,
                  mà từ khi row đầu có mặt trong HTML server render thì 4 thẻ đó
                  đứng tranh băng thông với đúng ảnh hero — phần tử LCP, và là thứ
                  duy nhất trên trang chủ có thể là LCP: không card nào nằm trên nó.
                  Đo trên HTML đã build: 5 thẻ preload ảnh thay vì 1.

                  Thay vào đó là `loading="eager"` cho TRANG CARD ĐẦU của row đầu
                  (`cols` card — thứ nằm trong màn hình lúc mở trang): preload
                  scanner thấy chúng ngay trong HTML thay vì đợi layout như ảnh lazy,
                  nhưng không preload và giữ `fetchpriority=low` (lý do ở MovieCard)
                  — hero vẫn là ảnh duy nhất được ưu tiên. Mọi card khác, kể cả ba
                  section lazy, vẫn `loading="lazy"` mặc định của next/image.

                  `cols` ở HTML server là 6 (khổ rộng nhất); về client nó thành đúng
                  khổ thật. Ảnh đã bắt đầu tải thì đổi thuộc tính sau cũng vô hại.
                  Chỗ `priority` thật sự có ích là grid trang danh sách (`MovieGrid`)
                  — ở đó không có hero.
                */
                <MovieCard
                  movie={movie}
                  variant={poster ? 'grid' : 'row'}
                  enableHoverPreview={!poster}
                  sizes={poster ? IMAGE_SIZES.posterRowCard : undefined}
                  eager={priority && index < cols}
                  transformOrigin={originFor(index, movies.length, cols)}
                  tabIndex={index === rovingIndex ? 0 : -1}
                  onFocusCard={() => setRovingIndex(index)}
                />
              ) : (
                // Giữ đúng chỗ để không gây CLS khi card mount (§12.1) — kể cả khối
                // tên/năm dưới ảnh ở máy không có HoverPreview.
                <CardSkeleton aspect={poster ? 'poster' : 'backdrop'} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RowArrow({
  side,
  visible,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  /**
   * Tháo hẳn nút ra khỏi DOM khi cuộn tới mép là một cú biến mất đột ngột ngay
   * dưới con trỏ — mà mép row là đúng chỗ con trỏ đang đứng sau cú bấm cuối
   * cùng. Giữ nút lại và cho nó mờ đi thì cú dừng ở cuối row mềm hẳn.
   *
   * `disabled` + `aria-hidden` để bàn phím và trình đọc màn hình không rơi vào
   * một cái nút vô hình không làm gì.
   */
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={!visible}
      aria-hidden={!visible}
      tabIndex={visible ? undefined : -1}
      className={cn(
        // `.row-arrow` canh trên/dưới theo đúng dải card (xem globals.css). Cao
        // hết chiều cao card thay vì 80px lửng giữa: vùng bấm rộng hơn, và mảng
        // tối chạy trọn mép row nhìn gọn hơn hẳn.
        'row-arrow absolute z-row hidden w-[4vw] min-w-[40px] items-center justify-center md:flex',
        'bg-bg-base/60 text-2xl text-text-primary backdrop-blur-sm',
        'transition-[opacity,background-color] duration-standard ease-standard',
        'hover:bg-bg-base/80',
        visible
          ? 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100'
          : 'pointer-events-none opacity-0',
        side === 'left' ? 'left-0 rounded-r-card' : 'right-0 rounded-l-card',
      )}
    >
      {side === 'left' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
}
