'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useDevice } from '@/hooks/useDevice';
import { usePresence } from '@/hooks/usePresence';

/**
 * Dải báo mất mạng (§14.1).
 *
 * Khác toast ở chỗ nó KHÔNG tự tắt: chừng nào còn mất mạng thì còn hiện, vì đó
 * là lời giải thích cho mọi thứ đang không chạy. Khi mạng về thì đổi sang thông
 * báo xanh vài giây rồi biến mất — người dùng biết có thể thao tác tiếp.
 */
export function NetworkBanner() {
  const { network } = useDevice();
  const online = network.online;

  const [everOffline, setEverOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!online) {
      setEverOffline(true);
      setShowRestored(false);
      return;
    }

    if (!everOffline) return;
    setShowRestored(true);
    const timer = setTimeout(() => setShowRestored(false), 3000);
    return () => clearTimeout(timer);
  }, [online, everOffline]);

  /**
   * Dải báo trượt lên / trượt xuống thay vì hiện ra rồi biến mất phụt. Nó nằm ở
   * mép dưới màn hình, đúng chỗ ngón tay đang thao tác — xuất hiện đột ngột ở đó
   * vừa giật vừa dễ bị bấm nhầm.
   */
  const { mounted, visible } = usePresence(!online || showRestored, 300);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 bottom-0 z-toast px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3',
        'pointer-events-none flex justify-center',
      )}
    >
      <p
        data-motion="fade"
        className={cn(
          'rounded-pill px-4 py-2 text-sm shadow-elev-2 backdrop-blur-md',
          'transition-[opacity,transform] duration-standard ease-standard',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
          online
            ? 'bg-success/15 text-success ring-1 ring-success/30'
            : 'bg-bg-elevated/95 text-text-secondary ring-1 ring-white/10',
        )}
      >
        {online ? 'Đã có mạng trở lại' : 'Mất kết nối — nội dung đã tải vẫn xem được'}
      </p>
    </div>
  );
}
