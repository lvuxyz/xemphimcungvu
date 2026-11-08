'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useScrollLock } from '@/hooks/useScrollLock';
import { cn } from '@/lib/cn';
import { isDetailPath } from '@/lib/routes';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';
import { focusRestore, modalOnScreen, trackModalLayer } from './modal-motion';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Khung modal cho các lớp ĐỨNG TRƯỚC panel thật: skeleton (`loading.tsx`), lỗi
 * (`error.tsx`) và không tìm thấy (`not-found.tsx`) của slot `@modal`.
 *
 * Vì sao cần: ESC, bấm ra ngoài, nút ✕ và khoá scroll trước đây chỉ có trong
 * `DetailModal` — mà nó chỉ mount khi dữ liệu đã về. Suốt pha skeleton (0.5–1.1s
 * lúc cache lạnh, cả chục giây khi API chậm) người dùng bấm nhầm không thoát ra
 * được, con lăn chuột thì cuộn trang chủ phía sau lớp blur. Còn khi API lỗi hay
 * phim bị gỡ, boundary GỐC (`app/error.tsx`, `app/not-found.tsx`) render vào đúng
 * chỗ `{modal}` — tức là một `<main>` nằm dưới footer: skeleton biến mất, URL vẫn
 * là `/phim/{slug}`, màn hình trông như chuyển cảnh bị treo.
 *
 * Khung (overlay căn giữa, panel chặn 90vh, nút ✕ ở `right-4 top-4`) phải trùng
 * đúng `DetailModal` — lúc panel thật thay vào thì không có gì nhảy vị trí.
 *
 * Cố ý KHÔNG làm giống panel ở hai điểm:
 *   · Skeleton không kéo focus vào trong (màn lỗi / không tìm thấy thì có). Panel thật ghi nhớ `document.activeElement` lúc
 *     mount để trả focus khi đóng — skeleton giành focus trước thì panel sẽ nhớ
 *     nhầm một nút đã bị tháo, đóng modal xong focus rơi về `<body>`.
 *   · Đóng NGAY, không chờ `EXIT_MS`. Skeleton không có gì để thu lại, mà người
 *     bấm ESC trong lúc chờ là người đã muốn đi — bắt chờ thêm là phạt họ.
 */
export function ModalShell(props: ModalShellProps) {
  const pathname = usePathname();

  /**
   * Cùng chốt chặn với `DetailModal`: Next giữ nguyên slot khi điều hướng MỀM
   * sang route không khớp. Bấm sang `/xem/...` đúng lúc skeleton/màn lỗi đang
   * hiện thì nó sẽ đứng lì che player, body vẫn bị khoá — tháo hẳn cây là xong.
   */
  if (!isDetailPath(pathname)) return null;

  return <ModalShellFrame {...props} />;
}

interface ModalShellProps {
  /**
   * Có nhãn thì là `role="dialog"` (màn lỗi / không tìm thấy — có nội dung để
   * đọc). Skeleton thì không: một dialog rỗng chỉ khiến screen reader đọc vu vơ.
   */
  label?: string;
  /** Skeleton đánh dấu `aria-busy` cho phần đang chờ. */
  busy?: boolean;
  /** Thân panel. Dạng hàm khi thân cần nút đóng của chính khung (không đóng hai lần). */
  children: ReactNode | ((close: () => void) => ReactNode);
}

function ModalShellFrame({ label, busy, children }: ModalShellProps) {
  const { goBackOrHome } = useAppNavigation();

  /**
   * Hiệu ứng mở chỉ chạy khi chưa có lớp modal nào trên màn (xem `modal-motion.ts`).
   * Skeleton → màn lỗi, hay panel → skeleton khi đổi phim liên quan: modal vẫn
   * đang đứng đó, bung lại từ opacity 0 là một cú chớp vô nghĩa.
   */
  const [enter] = useState(() => !modalOnScreen());
  useLayoutEffect(trackModalLayer, []);

  /**
   * Khoá luôn từ pha skeleton. Lúc panel thật thay vào, cleanup của lớp này chạy
   * TRƯỚC effect của panel trong cùng một commit, nên giá trị `overflow` cũ mà
   * panel ghi nhớ vẫn là giá trị gốc — khoá chồng không để lại `hidden` mồ côi.
   */
  useScrollLock(true);

  /**
   * Chặn đóng hai lần: ESC lặp phím hay bấm backdrop liền hai cú sẽ gọi
   * `router.back()` hai lần — lùi quá trang nền, ra khỏi chỗ người dùng đang đứng.
   * Ref để chặn ngay trong cùng tick; state để tắt nhận chuột ở lượt render sau.
   */
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    goBackOrHome();
  }, [goBackOrHome]);

  const panelRef = useRef<HTMLDivElement>(null);
  const isDialog = Boolean(label);

  /**
   * Màn lỗi / không tìm thấy là `aria-modal` — phải kéo focus vào trong, không thì
   * focus nằm lại trên card phía sau lớp blur: Enter là mở lại đúng link đó, Tab
   * thì đi dạo trang nền. Skeleton thì KHÔNG (xem chú thích đầu file).
   *
   * Cleanup trả focus về phần tử cũ (thường là card — skeleton không giành focus
   * nên lúc này nó vẫn là card). Bấm "Thử lại" thành công: cleanup này chạy TRƯỚC
   * effect ghi nhớ `triggerRef` của panel thật trong cùng commit, nên panel vẫn
   * nhớ đúng card chứ không phải nút "Thử lại" đã bị tháo.
   */
  useEffect(() => {
    if (!isDialog) return;
    const previous = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (!(previous instanceof HTMLElement) || !previous.isConnected) return;
      focusRestore.active = true;
      try {
        previous.focus({ preventScroll: true });
      } finally {
        focusRestore.active = false;
      }
    };
  }, [isDialog]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (!isDialog || event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close, isDialog]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-modal flex items-center justify-center overflow-y-auto overscroll-contain bg-bg-base/70 p-4 backdrop-blur-[8px]',
        enter && 'modal-backdrop-in',
        closing && 'pointer-events-none',
      )}
      onClick={close}
    >
      <div
        ref={panelRef}
        tabIndex={isDialog ? -1 : undefined}
        role={label ? 'dialog' : undefined}
        aria-modal={label ? true : undefined}
        aria-label={label}
        aria-busy={busy || undefined}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'surface-elevated relative max-h-[90vh] w-[min(56rem,92vw)] overflow-hidden rounded-modal shadow-elev-3 outline-none',
          enter && 'modal-panel-in',
        )}
      >
        <IconButton
          label="Đóng"
          onClick={close}
          className="absolute right-4 top-4 z-10 bg-bg-base/80"
        >
          <CloseIcon />
        </IconButton>

        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  );
}
