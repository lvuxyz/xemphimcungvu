'use client';

import { useEffect, useRef, useState } from 'react';

interface Options {
  rootMargin?: string;
  threshold?: number;
  /** Ngắt observer sau lần đầu vào viewport — dùng cho lazy fetch (§8.3). */
  once?: boolean;
  /**
   * Giá trị trước khi observer kịp báo. Chỉ đặt `true` khi nơi gọi BIẾT chắc phần
   * tử đang ở trong/sát viewport lúc mount — nếu không, một khung hình đầu sai
   * trạng thái là một lần layout shift.
   */
  initialInView?: boolean;
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
  initialInView = false,
}: Options = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(initialInView);
  /**
   * Ở chế độ `once`, đã vào viewport một lần thì thôi hẳn. Phải nhớ ngoài effect
   * vì `rootMargin` là thứ ĐƯỢC PHÉP đổi giữa chừng (`LazyRow` nới lề sau lần cuộn
   * đầu): đổi lề là dựng observer mới, và observer mới mà bắn `false` thì phần tử
   * đã "thấy" rồi lại thành "chưa thấy".
   */
  const seenRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (once && seenRef.current) return;

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
        if (entry.isIntersecting && once) {
          seenRef.current = true;
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView };
}
