import { create } from 'zustand';

/**
 * UI state thuần client: toast, trạng thái navbar, khoá scroll body (§2.1, §8.5).
 *
 * KHÔNG lưu state của modal chi tiết ở đây — modal do intercepting route
 * điều khiển, URL là nguồn sự thật duy nhất (§2.2 nguyên tắc 3).
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** ms; 0 = giữ đến khi người dùng đóng */
  duration: number;
}

interface UIState {
  toasts: Toast[];
  /** §8.1 — navbar đổi nền khi scrollY > 60 */
  isNavbarScrolled: boolean;
  isSearchOpen: boolean;
  /** Đếm số nơi đang yêu cầu khoá scroll (modal + player lồng nhau) */
  scrollLockCount: number;

  pushToast: (message: string, options?: Partial<Omit<Toast, 'id' | 'message'>>) => string;
  dismissToast: (id: string) => void;

  setNavbarScrolled: (value: boolean) => void;
  setSearchOpen: (value: boolean) => void;

  lockScroll: () => void;
  unlockScroll: () => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  isNavbarScrolled: false,
  isSearchOpen: false,
  scrollLockCount: 0,

  pushToast: (message, options) => {
    const id = `toast-${++toastSeq}`;
    const toast: Toast = {
      id,
      message,
      variant: options?.variant ?? 'info',
      duration: options?.duration ?? 4000,
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    return id;
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setNavbarScrolled: (value) => set({ isNavbarScrolled: value }),
  setSearchOpen: (value) => set({ isSearchOpen: value }),

  lockScroll: () => set((state) => ({ scrollLockCount: state.scrollLockCount + 1 })),
  unlockScroll: () => set((state) => ({ scrollLockCount: Math.max(0, state.scrollLockCount - 1) })),
}));
