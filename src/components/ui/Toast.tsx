'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/cn';
import { useUIStore, type Toast as ToastData } from '@/store/useUIStore';
import { CloseIcon } from './icons';

const variantRing: Record<ToastData['variant'], string> = {
  info: 'ring-white/15',
  success: 'ring-success/40',
  warning: 'ring-warning/40',
  danger: 'ring-danger/40',
};

function ToastItem({ toast }: { toast: ToastData }) {
  const dismiss = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <div
      data-motion="fade"
      className={cn(
        'pointer-events-auto flex items-center gap-3 rounded-pill bg-bg-elevated/95 py-2 pl-4 pr-2',
        'text-sm text-text-primary shadow-elev-2 ring-1 backdrop-blur-md',
        variantRing[toast.variant],
      )}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
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
