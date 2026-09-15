'use client';

import { useEffect } from 'react';

interface WakeLockSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> };
};

/**
 * Giữ màn hình sáng khi đang phát.
 *
 * Thẻ <video> phát toàn màn hình thì hệ điều hành tự giữ, nhưng xem nhúng trong
 * trang (điện thoại nằm trên bàn, iframe embed, hoặc chỉ nghe) thì màn hình vẫn
 * tắt sau 30 giây. Wake Lock API xử lý đúng trường hợp đó.
 *
 * Chrome/Edge/Android + Safari 16.4+. Trình duyệt không hỗ trợ thì bỏ qua im lặng.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const nav = typeof navigator === 'undefined' ? undefined : (navigator as WakeLockNavigator);
    if (!active || !nav?.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        /* pin yếu hoặc tab nền — trình duyệt từ chối, không phải lỗi của app */
      }
    };

    // Chuyển tab rồi quay lại là mất lock; phải xin lại.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void request();
      }
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
