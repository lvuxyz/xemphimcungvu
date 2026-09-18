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

export function useIsOnline(): boolean {
  return useDevice().network.online;
}
