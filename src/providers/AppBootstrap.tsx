'use client';

import { useEffect } from 'react';
import { pruneWatchProgress } from '@/lib/storage';

/**
 * Tác vụ chạy một lần khi app khởi động.
 * Hiện tại: dọn key tiến độ xem cũ hơn 90 ngày (§10.5).
 *
 * Chạy ngay sau hydrate nên nó tranh main thread với LCP — vì vậy việc dọn đi
 * qua index một key (`lib/storage.ts`) chứ không quét cả localStorage như bản
 * trước. Người đã dùng app từ trước phải chịu đúng MỘT lượt quét, ở lần mở đầu
 * tiên sau khi cập nhật, để gom key cũ vào index.
 */
export function AppBootstrap() {
  useEffect(() => {
    pruneWatchProgress();
  }, []);

  return null;
}
