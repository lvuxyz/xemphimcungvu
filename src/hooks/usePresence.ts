'use client';

import { useEffect, useState } from 'react';

/**
 * Giữ phần tử sống thêm một nhịp để nó kịp chạy animation thoát.
 *
 * Thay cho `AnimatePresence` của framer-motion ở những chỗ chỉ cần fade/scale
 * đơn giản: HoverPreview nằm trong MovieCard, mà MovieCard có mặt vài trăm lần
 * trên trang chủ — kéo cả runtime framer-motion vào bundle initial chỉ để làm
 * một transform là quá đắt (§12.1).
 *
 *   mounted  — có render DOM hay không
 *   visible  — đã sang khung hình kế tiếp chưa (để CSS transition thật sự chạy)
 */
export function usePresence(active: boolean, exitMs = 300) {
  const [mounted, setMounted] = useState(active);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);

      // Hai lần rAF: lần đầu để trình duyệt paint trạng thái ban đầu, lần sau
      // mới đổi class. Một lần thôi thì trình duyệt gộp lại và transition bị bỏ.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });

      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    setVisible(false);
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [active, exitMs]);

  return { mounted, visible };
}
