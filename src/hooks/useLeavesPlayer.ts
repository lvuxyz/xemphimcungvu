'use client';

import { usePathname } from 'next/navigation';
import { PATH } from '@/lib/routes';

/**
 * "Đang ở trong trình phát phải không?"
 *
 * Dùng để quyết định một link tới `/phim/{slug}` nên đi mềm hay đi cứng.
 *
 * Bối cảnh (§1.4 L1): slot `@modal` nằm ở root layout nên nó bao trùm cả `/xem`.
 * Điều hướng MỀM từ trang phát sang `/phim/{slug}` sẽ khớp intercepting route và
 * mở modal chi tiết ĐÈ LÊN player — thẻ `<video>` vẫn còn nguyên trong DOM phía
 * sau, phim vẫn chạy, tiếng vẫn phát, còn `<title>` thì vẫn là "— Tập 01".
 *
 * Đã thử tách `/xem` ra khỏi tầm của slot bằng nested route group `(browse)`:
 * không ăn thua, Next 14 vẫn khớp `(.)phim/[slug]` (dev log in
 * `Compiling /(.)phim/[slug]`) và trả về 404 vì `children` của group không khớp
 * gì. Route group trong suốt với bộ khớp interception.
 *
 * Nên chặn ở phía nơi gọi: từ player, `/phim/{slug}` đi bằng `<a>` thường. Điều
 * hướng cứng không qua router nên không có interception, player unmount sạch,
 * metadata dựng lại đúng.
 *
 * ⚠️ Đây KHÔNG phải lối ra chính của trình phát. Lối ra chính là nút ← (và phím
 * Esc) → `goBackOrHome()`, lùi mềm về đúng trang trước và giữ nguyên scroll.
 * Hàm này chỉ lo mấy link phụ trỏ thẳng tới trang phim.
 */
export function useLeavesPlayer(): boolean {
  const pathname = usePathname();
  return pathname.startsWith(`${PATH.watch}/`);
}
