'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useUIStore, type Toast as ToastData } from '@/store/useUIStore';
import { usePresence } from '@/hooks/usePresence';
import { CloseIcon } from './icons';

const variantRing: Record<ToastData['variant'], string> = {
  info: 'ring-white/15',
  success: 'ring-success/40',
  warning: 'ring-warning/40',
  danger: 'ring-danger/40',
};

/** Đủ dài cho `duration-micro` (150ms) chạy hết trước khi toast bị gỡ khỏi store. */
const EXIT_MS = 200;

function ToastItem({ toast }: { toast: ToastData }) {
  const dismiss = useUIStore((s) => s.dismissToast);

  /**
   * Store gỡ toast là DOM biến mất ngay lập tức — không có chỗ nào để chạy
   * animation thoát. Nên tách làm hai nhịp: `leaving` lo phần nhìn, hết 200ms
   * mới gọi `dismissToast`. Nhịp vào do `usePresence` lo (một khung hình ở
   * trạng thái đầu rồi mới đổi class, nếu không trình duyệt gộp lại và bỏ qua).
   */
  const [leaving, setLeaving] = useState(false);
  const { visible } = usePresence(!leaving, EXIT_MS);

  const close = useCallback(() => setLeaving(true), []);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(close, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, close]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => dismiss(toast.id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, dismiss, toast.id]);

  return (
    <div
      data-motion="fade"
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-pill bg-bg-elevated/95 py-2 pl-4 pr-2',
        'text-sm text-text-primary shadow-elev-2 ring-1 backdrop-blur-md',
        'transition-[opacity,transform] duration-micro ease-standard',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        variantRing[toast.variant],
      )}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={close}
        aria-label="Đóng thông báo"
        className="rounded-pill p-1 text-text-muted transition-colors duration-micro ease-standard hover:text-text-primary"
      >
        <CloseIcon className="text-sm" />
      </button>
    </div>
  );
}

/**
 * §10.2 — toast 1 dòng khi phải rơi xuống nguồn phát dự phòng.
 * `aria-live="polite"` để screen reader đọc mà không cắt ngang (§13.3).
 */
export function ToastViewport() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-toast flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
