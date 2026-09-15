'use client';

import { useEffect } from 'react';
import { pruneWatchProgress } from '@/lib/storage';

/**
 * Tác vụ chạy một lần khi app khởi động.
 * Hiện tại: dọn key tiến độ xem cũ hơn 90 ngày (§10.5).
 */
export function AppBootstrap() {
  useEffect(() => {
    pruneWatchProgress();
  }, []);

  return null;
}
