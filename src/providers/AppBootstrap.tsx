'use client';

import { useEffect } from 'react';
import { pruneWatchProgress } from '@/lib/storage';
import { useWatchStore } from '@/store/useWatchStore';

/**
 * Tác vụ chạy một lần khi app khởi động:
 *
 *   1. dọn key tiến độ xem cũ hơn 90 ngày (§10.5)
 *   2. nạp index tiến độ vào store, cho card và hero ở MỌI trang đọc chung
 *
 * Chạy ngay sau hydrate nên nó tranh main thread với LCP — vì vậy việc dọn đi
 * qua index một key (`lib/storage.ts`) chứ không quét cả localStorage như bản
 * trước. Người đã dùng app từ trước phải chịu đúng MỘT lượt quét, ở lần mở đầu
 * tiên sau khi cập nhật, để gom key cũ vào index.
 *
 * Thứ tự có ý nghĩa: dọn trước rồi mới nạp, nếu không store giữ luôn những phim
 * vừa bị loại vì quá hạn.
 */
export function AppBootstrap() {
  useEffect(() => {
    pruneWatchProgress();
    useWatchStore.getState().refresh();
  }, []);

  return null;
}
