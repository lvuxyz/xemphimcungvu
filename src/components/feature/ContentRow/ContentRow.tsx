'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/constants';
import type { Movie } from '@/types/movie';
import { useRowScroll } from '@/hooks/useRowScroll';
import { useInView } from '@/hooks/useInView';
import { useDevice } from '@/hooks/useDevice';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { MovieCard } from '../MovieCard/MovieCard';

interface ContentRowProps {
  title: string;
  movies: Movie[];
  /** Link "Xem tất cả" ở tiêu đề row */
  href?: string;
  /** Row đầu trang chủ ưu tiên tải ảnh (§12.2 — priority chỉ cho ảnh gần LCP) */
  priority?: boolean;
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
export function ContentRow({ title, movies, href, priority = false }: ContentRowProps) {
  const { ref, canScrollPrev, canScrollNext, scrollNext, scrollPrev, originFor } =
    useRowScroll<HTMLUListElement>();
  const { cols, canHover, budget } = useDevice();

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
  });
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (inView) setHasEntered(true);
  }, [inView]);

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
        'group/row relative py-3 z-0 hover:z-20 focus-within:z-20 transition-[z-index]',
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

      <div className="relative">
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
                'row-item w-[45%] sm:w-[30%] lg:w-[19%] 2xl:w-[16%] relative z-0 hover:z-30 focus-within:z-30',
                hasEntered && 'row-item-enter',
              )}
              // §9.3 — stagger 40ms/item, dừng sau 8 item
              style={{ '--stagger': Math.min(index, MOTION.staggerMax) } as React.CSSProperties}
            >
              {hasEntered ? (
                <MovieCard
                  movie={movie}
                  transformOrigin={originFor(index, movies.length, cols)}
                  priority={priority && index < budget.priorityImages}
                  tabIndex={index === rovingIndex ? 0 : -1}
                  onFocusCard={() => setRovingIndex(index)}
                />
              ) : (
                // Giữ đúng chỗ để không gây CLS khi card mount (§12.1)
                <Skeleton className="aspect-backdrop w-full" />
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
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 z-row hidden h-20 w-[4vw] min-w-[40px] -translate-y-1/2 items-center justify-center md:flex',
        'bg-bg-base/60 text-2xl text-text-primary backdrop-blur-sm',
        'opacity-0 transition-opacity duration-standard ease-standard',
        'hover:bg-bg-base/80 focus-visible:opacity-100 group-hover/row:opacity-100',
        side === 'left' ? 'left-0 rounded-r-card' : 'right-0 rounded-l-card',
      )}
    >
      {side === 'left' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </button>
  );
}
