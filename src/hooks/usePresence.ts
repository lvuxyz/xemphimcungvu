'use client';

import { useCallback, useEffect, useState } from 'react';

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
 *   dismiss  — gỡ khỏi DOM NGAY, bỏ qua nhịp thoát (xem dưới)
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

  /**
   * Có lúc animation thoát là thừa: bấm mở modal từ HoverPreview thì preview co
   * về 1.0 + mờ dần đúng 300ms modal đang mở, chồng lên backdrop blur — ba hiệu
   * ứng cùng chạy, blur phải lọc lại vật đang chuyển động mỗi khung hình. Gọi
   * cái này CÙNG lúc với việc tắt `active`; timer của effect chạy sau đó chỉ đặt
   * lại `mounted=false` lần nữa, vô hại.
   */
  const dismiss = useCallback(() => {
    setVisible(false);
    setMounted(false);
  }, []);

  return { mounted, visible, dismiss };
}
