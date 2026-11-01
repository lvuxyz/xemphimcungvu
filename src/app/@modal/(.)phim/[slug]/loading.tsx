'use client';

import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { modalOnScreen, trackModalLayer } from '@/components/feature/DetailModal/modal-motion';

/**
 * §11.3 — modal hiện NGAY khi click, phần dữ liệu đổ vào sau.
 * §12.2 — skeleton giữ layout, không dùng spinner.
 *
 * Hiệu ứng mở nằm ở ĐÂY khi skeleton hiện — panel thật thay vào sau sẽ không
 * chạy lại (xem `modal-motion.ts`). Đổi sang phim liên quan thì modal đã đang
 * mở: skeleton hiện thẳng, không bung lại từ đầu.
 *
 * Khung (overlay căn giữa, panel chặn 90vh) phải trùng đúng `DetailModal`, nếu
 * không lúc dữ liệu về cả panel nhảy vị trí.
 */
export default function ModalLoading() {
  const [enter] = useState(() => !modalOnScreen());
  useLayoutEffect(trackModalLayer, []);

  return (
    <div
      className={cn(
        'fixed inset-0 z-modal flex items-center justify-center overflow-hidden bg-bg-base/70 p-4 backdrop-blur-[8px]',
        enter && 'modal-backdrop-in',
      )}
    >
      <div
        aria-busy="true"
        className={cn(
          'surface-elevated relative max-h-[90vh] w-[min(56rem,92vw)] overflow-hidden rounded-modal shadow-elev-3',
          enter && 'modal-panel-in',
        )}
      >
        <div className="skeleton aspect-backdrop w-full rounded-none" />

        <div className="grid gap-8 p-6 md:grid-cols-[1fr_16rem] md:p-8">
          <div className="min-w-0 space-y-4">
            <div className="skeleton h-4 w-1/2 rounded-card" />
            <div className="skeleton h-3 w-full rounded-card" />
            <div className="skeleton h-3 w-11/12 rounded-card" />
            <div className="skeleton h-3 w-3/4 rounded-card" />
            <div className="flex gap-3 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-20 rounded-pill" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-3 w-full rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
