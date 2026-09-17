'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * Chuyển tiếp giữa các trang.
 *
 * Next dựng lại `template` sau MỖI lần đổi route (khác `layout` — cái đó giữ
 * nguyên), nên đây là chỗ duy nhất gắn được animation vào chuyển trang mà không
 * cần thêm thư viện nào.
 *
 * Cờ `hydrated` để ở phạm vi module, KHÔNG phải state hay ref:
 *
 *   · ref thì vô dụng — template bị dựng lại mỗi lần điều hướng nên ref cũng
 *     mới tinh mỗi lần, lúc nào cũng "lần đầu"
 *   · lần vẽ ĐẦU TIÊN của phiên không được animate: Chrome bỏ qua phần tử đang
 *     `opacity: 0` khi đo LCP, fade 300ms ở đây là cộng thẳng 300ms vào LCP của
 *     trang chủ — đúng con số §12.1 đang giữ
 *   · server render ra `false`, client lần đầu cũng `false` → không lệch hydration
 */
let hydrated = false;

export default function Template({ children }: { children: ReactNode }) {
  const animate = hydrated;

  useEffect(() => {
    hydrated = true;
  }, []);

  return <div className={animate ? 'page-enter' : undefined}>{children}</div>;
}
