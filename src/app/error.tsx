'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** §14.1 — phần cốt lõi fail thì hiện error state CÓ hành động khôi phục. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  /**
   * `reset()` trần chỉ dựng lại cây từ payload ĐANG CÓ — mà payload đó chính là
   * lỗi, nằm trong router cache tới `staleTimes.dynamic` (120s). Bấm Thử lại khi
   * API đã sống lại vẫn ra đúng màn lỗi cũ. `refresh()` xin server bản mới,
   * `reset()` trong cùng transition thì xoá lỗi khi bản mới về.
   */
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-extrabold">Đã có lỗi xảy ra</h1>
      <p className="mt-3 text-text-secondary">
        Không tải được dữ liệu từ máy chủ. Bạn thử lại giúp nhé.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-8 rounded-pill bg-accent px-6 py-3 font-medium text-[color:var(--accent-contrast)] transition-colors duration-micro ease-standard hover:bg-accent-hover"
      >
        Thử lại
      </button>
    </main>
  );
}
