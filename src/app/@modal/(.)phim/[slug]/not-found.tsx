'use client';

import { ModalShell } from '@/components/feature/DetailModal/ModalShell';

/**
 * `notFound()` trong `page.tsx` của slot (card cũ trỏ tới phim đã bị gỡ).
 *
 * Next 14.2 đặt `not-found.tsx` của segment làm boundary cho page của chính
 * segment đó, nên file này thắng `app/not-found.tsx` — thứ mà nếu để rơi xuống
 * sẽ render thành một `<main>` dưới footer trang nền, modal thì biến mất.
 *
 * Chỉ ảnh hưởng nhánh intercept (điều hướng mềm). Tải cứng `/phim/{slug}` không
 * đi qua slot này (`@modal/default.tsx`), nên 404 thật của trang full —
 * `app/phim/[slug]/layout.tsx` + `app/not-found.tsx`, HTTP 404 — giữ nguyên.
 *
 * Client component vì `ModalShell` cần hook; not-found không nhận props nên
 * không có gì phải truyền qua ranh giới server/client.
 */
export default function ModalNotFound() {
  return (
    <ModalShell label="Không tìm thấy nội dung">
      {(close) => (
        <div className="flex flex-col items-center px-6 py-14 text-center md:px-10">
          <h2 className="text-2xl font-extrabold">Không tìm thấy nội dung</h2>
          <p className="mt-3 max-w-md text-text-secondary">
            Phim bạn tìm có thể đã bị gỡ hoặc đường dẫn không đúng.
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-8 rounded-pill bg-accent px-6 py-3 font-medium text-[color:var(--accent-contrast)] transition-colors duration-micro ease-standard hover:bg-accent-hover"
          >
            Quay lại
          </button>
        </div>
      )}
    </ModalShell>
  );
}
