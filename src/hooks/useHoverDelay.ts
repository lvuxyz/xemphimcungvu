'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HOVER_DELAY } from '@/lib/constants';

/**
 * §8.4 — độ trễ hover card: vào 400ms, ra 200ms.
 *
 * Mục đích là chống nhấp nháy khi người dùng rê chuột ngang qua cả row:
 * timer bị `clearTimeout` ngay lúc unhover nếu chưa chạy xong.
 */
export function useHoverDelay(
  enterDelay: number = HOVER_DELAY.enter,
  leaveDelay: number = HOVER_DELAY.leave,
) {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    clear();
    timerRef.current = setTimeout(() => setIsHovered(true), enterDelay);
  }, [clear, enterDelay]);

  const onMouseLeave = useCallback(() => {
    clear();
    timerRef.current = setTimeout(() => setIsHovered(false), leaveDelay);
  }, [clear, leaveDelay]);

  /** Đóng ngay, không chờ timer — dùng khi mở modal hoặc điều hướng. */
  const cancel = useCallback(() => {
    clear();
    setIsHovered(false);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { isHovered, onMouseEnter, onMouseLeave, cancel, handlers: { onMouseEnter, onMouseLeave } };
}
