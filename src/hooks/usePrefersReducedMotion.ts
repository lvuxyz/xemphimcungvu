'use client';

import { useDevice } from './useDevice';

/**
 * §9.4 — người dùng bật `prefers-reduced-motion: reduce`.
 * Dùng để tắt scale hover, Ken Burns, parallax; GIỮ LẠI opacity transition.
 *
 * Chỉ là một lát cắt của `useDevice()`: cả app dùng chung một `matchMedia`
 * listener duy nhất thay vì mỗi component tự đăng ký một cái.
 */
export function usePrefersReducedMotion(): boolean {
  return useDevice().reducedMotion;
}
