'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RowEdge = 'start' | 'end' | 'middle' | 'none';

/**
 * §8.3 — logic cuộn ngang của ContentRow.
 *
 * Bước chuyển là NGUYÊN TRANG item (bằng chiều rộng viewport của row),
 * không phải từng item — đây là điểm tạo cảm giác giống Netflix.
 * Scroll snap do CSS đảm nhiệm; hook chỉ lo vị trí và trạng thái mũi tên.
 */
export function useRowScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // 1px dung sai cho sai số làm tròn khi zoom trình duyệt khác 100%.
    setCanScrollPrev(el.scrollLeft > 1);
    setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollByPage = useCallback(
    (direction: 1 | -1) => {
      const el = ref.current;
      if (!el) return;
      el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
      // `scroll` event sẽ gọi sync(), nhưng gọi sớm để mũi tên phản hồi ngay.
      requestAnimationFrame(sync);
    },
    [sync],
  );

  const scrollNext = useCallback(() => scrollByPage(1), [scrollByPage]);
  const scrollPrev = useCallback(() => scrollByPage(-1), [scrollByPage]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    sync();
    el.addEventListener('scroll', sync, { passive: true });

    // Row đổi chiều rộng khi resize hoặc khi item lazy-load xong.
    const observer = new ResizeObserver(sync);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [sync]);

  /**
   * §8.4 — `transform-origin` phải theo vị trí trong row, nếu không card ở mép
   * sẽ tràn ra ngoài viewport khi phóng to.
   */
  const originFor = useCallback((index: number, total: number, perView: number): string => {
    if (index === 0) return 'left center';
    if (index === total - 1) return 'right center';
    // Item đầu/cuối của mỗi "trang" cũng nằm sát mép viewport.
    if (perView > 0 && index % perView === 0) return 'left center';
    if (perView > 0 && index % perView === perView - 1) return 'right center';
    return 'center';
  }, []);

  return { ref, canScrollPrev, canScrollNext, scrollNext, scrollPrev, sync, originFor };
}
