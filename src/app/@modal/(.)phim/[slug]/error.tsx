'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ModalShell } from '@/components/feature/DetailModal/ModalShell';

/**
 * §14.1 — lỗi khi mở chi tiết phim TRONG modal.
 *
 * Thiếu file này thì `app/error.tsx` (boundary gốc) bắt lỗi thay — mà Next đặt
 * boundary gốc cho MỌI slot của root layout, nên nó render đúng chỗ `{modal}`:
 * một `<main>` thường nằm dưới footer của trang nền. Skeleton biến mất, URL vẫn
 * `/phim/{slug}`, không thấy modal nào — trông như chuyển cảnh bị treo. Ở đây
 * lỗi hiện ngay trong khung modal đang đứng, không bung lại hiệu ứng mở.
 */
export default function ModalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Cùng lý do với `app/error.tsx`: `reset()` trần dựng lại từ payload lỗi đang nằm trong router cache.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <ModalShell label="Đã có lỗi xảy ra">
      {(close) => (
        <div className="flex flex-col items-center px-6 py-14 text-center md:px-10">
          <h2 className="text-2xl font-extrabold">Đã có lỗi xảy ra</h2>
          <p className="mt-3 max-w-md text-text-secondary">
            Không tải được thông tin phim từ máy chủ. Bạn thử lại giúp nhé.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="rounded-pill bg-accent px-6 py-3 font-medium text-[color:var(--accent-contrast)] transition-colors duration-micro ease-standard hover:bg-accent-hover"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-pill border border-white/15 bg-white/10 px-6 py-3 font-medium text-text-primary transition-colors duration-micro ease-standard hover:bg-white/20"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
