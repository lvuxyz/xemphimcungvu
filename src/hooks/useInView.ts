'use client';

import { useEffect, useRef, useState } from 'react';

interface Options {
  rootMargin?: string;
  threshold?: number;
  /** Ngắt observer sau lần đầu vào viewport — dùng cho lazy fetch (§8.3). */
  once?: boolean;
}

/**
 * §8.3, §11.2 — row chỉ fetch khi vào viewport.
 * `rootMargin` mặc định nới rộng 1 viewport để dữ liệu kịp về trước khi người dùng thấy.
 *
 * Observer được tạo ĐÚNG MỘT LẦN cho mỗi phần tử: `inView` không nằm trong deps,
 * nếu không thì ở chế độ theo dõi liên tục mỗi lần ra/vào viewport lại dựng lại
 * observer — thứ đắt nhất trong cả cái hook này.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>({
  rootMargin = '100% 0px',
  threshold = 0,
  once = true,
}: Options = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Trình duyệt quá cũ không có IntersectionObserver: hiện nội dung luôn,
    // thà tải nhiều hơn còn hơn trang trắng.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
