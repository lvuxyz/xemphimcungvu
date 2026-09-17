'use client';

import { useEffect } from 'react';

/**
 * §8.5 — khoá scroll của `body` khi modal mở.
 * Bù `padding-right` bằng đúng chiều rộng scrollbar để layout không giật (CLS).
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;

    /**
     * `html { scrollbar-gutter: stable }` (globals.css) đã giữ sẵn chỗ cho thanh
     * cuộn, kể cả lúc khoá — bù thêm padding nữa là đẩy nội dung lệch sang trái
     * đúng 10px, tức là tạo ra chính cú giật đang muốn tránh.
     *
     * Vẫn giữ nhánh bù tay cho trình duyệt chưa hỗ trợ (Safari < 18.2). Ở đó
     * thanh cuộn thường là overlay nên hiệu số ra 0 và nhánh này cũng không làm gì.
     */
    const gutterReserved =
      typeof CSS !== 'undefined' && CSS.supports?.('scrollbar-gutter', 'stable');
    const scrollbarWidth = gutterReserved
      ? 0
      : window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [locked]);
}
