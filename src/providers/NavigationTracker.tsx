'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { markNavigated } from '@/lib/history-depth';

/**
 * Ghi nhận "app đã tự điều hướng ít nhất một lần" để `goBackOrHome()` biết
 * `router.back()` có an toàn không. Xem `lib/history-depth.ts`.
 *
 * Lượt chạy ĐẦU TIÊN bị bỏ qua: effect luôn bắn một lần khi mount, mà lúc đó
 * người dùng chưa đi đâu cả — tính luôn lượt đó thì mọi link chia sẻ mở trong tab
 * mới đều bị coi là "có chỗ để lùi", đúng cái bẫy đang muốn tránh.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    markNavigated();
  }, [pathname]);

  return null;
}
