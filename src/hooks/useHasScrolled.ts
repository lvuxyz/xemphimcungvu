'use client';

import { useSyncExternalStore } from 'react';

/**
 * Người xem đã cuộn trang lần nào chưa (trong phiên này).
 *
 * Dùng để quyết định lúc nào section lazy của trang chủ được "nhìn trước":
 *
 *   · CHƯA cuộn — chỉ section đang nằm TRONG màn hình mới tải. Ở 1366×768 section
 *     "Phim bộ" nằm dưới mép màn hình ~100px; nới 200px ngay từ đầu là nó bắn
 *     request trước cả khi người xem động tay — đúng thứ trang chủ phải tránh.
 *   · ĐÃ cuộn — nới 200px để dữ liệu về trước khi section lọt vào màn hình.
 *
 * Một listener dùng chung cho mọi section, tự gỡ sau lần cuộn đầu tiên. Cờ chỉ
 * bật chứ không tắt: đã cuộn là đã cuộn, kể cả khi quay lại đầu trang.
 */

let scrolled = false;
const listeners = new Set<() => void>();

function markScrolled() {
  if (scrolled) return;
  scrolled = true;
  window.removeEventListener('scroll', markScrolled);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!scrolled) window.addEventListener('scroll', markScrolled, { passive: true });

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('scroll', markScrolled);
  };
}

/**
 * Trang mở ra ở giữa chừng (tải lại, bấm Back — trình duyệt tự khôi phục vị trí)
 * cũng tính là đã cuộn. Chốt luôn vào cờ để hai lượt gọi liên tiếp không bao giờ
 * trả hai giá trị khác nhau — điều `useSyncExternalStore` đòi hỏi.
 */
function getSnapshot(): boolean {
  if (!scrolled && window.scrollY > 0) scrolled = true;
  return scrolled;
}

const getServerSnapshot = () => false;

export function useHasScrolled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
