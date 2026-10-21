'use client';

import { useSyncExternalStore } from 'react';
import {
  getDeviceSnapshot,
  getServerDeviceSnapshot,
  subscribeDevice,
  type DeviceSnapshot,
} from '@/lib/device-store';

/**
 * Hoàn cảnh chạy hiện tại: mạng, kiểu con trỏ, reduced motion, ngân sách tính năng.
 *
 * Mọi component dùng chung MỘT bộ listener (xem `lib/device-store.ts`).
 * Lần render đầu luôn trả snapshot server để không lệch hydration; giá trị thật
 * về ngay ở commit đầu tiên.
 */
export function useDevice(): DeviceSnapshot {
  return useSyncExternalStore(subscribeDevice, getDeviceSnapshot, getServerDeviceSnapshot);
}

/** Chỉ cần biết máy có chuột thật hay không (hover preview, mũi tên carousel). */
export function useCanHover(): boolean {
  return useDevice().canHover;
}

/**
 * Card trong row có HoverPreview hay không — và vì thế, có khối chữ tên/năm nằm
 * sẵn dưới ảnh hay không (không preview thì tên phim phải hiện sẵn).
 *
 * Một chỗ duy nhất vì BA nơi phải ra cùng đáp án: `MovieCard` (khối chữ thật), và
 * khung chờ của `ContentRow` + `LazyRow`. Lệch nhau là row đổi chiều cao đúng lúc
 * dữ liệu về — ~72px trên điện thoại, cả phần trang bên dưới nhảy theo.
 */
export function useHoverPreviewEnabled(): boolean {
  const { canHover, budget } = useDevice();
  return canHover && budget.hoverPreview;
}

export function useIsOnline(): boolean {
  return useDevice().network.online;
}
