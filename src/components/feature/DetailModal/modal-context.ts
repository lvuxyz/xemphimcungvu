'use client';

import { createContext, useContext } from 'react';

/**
 * "Nội dung này đang nằm trong modal hay trên trang full?"
 *
 * `DetailContent` được dùng chung cho cả hai (một nguồn sự thật, hai khung
 * chứa), nhưng cùng một cú bấm lại phải cư xử khác nhau:
 *
 *   · trên trang `/phim/{slug}` — bấm phim liên quan là ĐI tới phim khác → push
 *   · trong modal              — bấm phim liên quan là ĐỔI nội dung modal đang
 *                                mở → replace, vì modal vẫn chỉ chiếm đúng một
 *                                điểm dừng trong lịch sử (§2.3)
 *
 * Đo trước khi sửa: mỗi cú bấm "Có thể bạn thích" cộng thêm một entry
 * (`history.length` 4 → 5). Xem 5 phim liên quan rồi bấm ESC là phải bấm 5 lần
 * mới thoát ra được trang nền.
 *
 * Dùng context thay vì truyền prop xuyên tầng: giữa `DetailModal` và `MovieCard`
 * còn `DetailContent` (Server Component) — prop sẽ phải đi qua nó và biến nó
 * thành client component.
 */
export const InTitleModalContext = createContext(false);

export function useInTitleModal(): boolean {
  return useContext(InTitleModalContext);
}
