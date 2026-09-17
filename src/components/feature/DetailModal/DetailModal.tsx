'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { MOTION } from '@/lib/constants';
import type { Movie, MovieDetailBundle } from '@/types/movie';
import { useScrollLock } from '@/hooks/useScrollLock';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';
import { DetailContent } from './DetailContent';
import { InTitleModalContext } from './modal-context';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Ngắn hơn lúc mở (§9.2): đóng phải dứt khoát, không bắt người dùng chờ. */
const EXIT_MS = 200;

/**
 * §8.5 — DetailModal.
 *
 * Hành vi bắt buộc:
 *   · backdrop blur(8px)
 *   · đóng bằng ESC hoặc click ngoài
 *   · body scroll lock khi mở
 *   · focus trap trong modal
 *   · trả focus về phần tử đã mở modal khi đóng
 */
export function DetailModal({
  detail,
  related = [],
}: {
  detail: MovieDetailBundle;
  related?: Movie[];
}) {
  const { goBackOrHome } = useAppNavigation();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  /**
   * Đóng modal đi hai nhịp: chạy animation thoát trước, `router.back()` sau.
   *
   * `AnimatePresence` ở đây không cứu được: modal là một route song song, khi
   * `router.back()` chạy thì cả cây này bị tháo cùng route — không còn ai ở lại
   * để chạy `exit`. Kết quả là modal mở ra có 450ms bung mượt mà rồi TẮT PHỤT
   * lúc bấm ESC. Tự giữ 200ms rồi mới lùi route thì hai đầu cân nhau.
   */
  const [closing, setClosing] = useState(false);

  useScrollLock(true);

  // Ghi nhớ phần tử đang focus để trả lại khi đóng.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []);

  const close = useCallback(() => setClosing(true), []);

  /**
   * §1.4 L4 — `router.back()` trần ném người mở link chia sẻ ra khỏi site: họ
   * bấm ✕ và rơi về đúng nơi vừa đến từ đó. `goBackOrHome` chỉ lùi khi app thật
   * sự có entry ở phía sau, còn lại thì đưa về trang chủ.
   */
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(goBackOrHome, EXIT_MS);
    return () => clearTimeout(timer);
  }, [closing, goBackOrHome]);

  // ESC đóng + focus trap bằng Tab.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [close]);

  // Focus vào panel ngay khi mở, để phím Tab bắt đầu từ trong modal.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <motion.div
      className={cn(
        'fixed inset-0 z-modal overflow-y-auto overscroll-contain bg-bg-base/70 backdrop-blur-[8px]',
        // Đang thoát thì không nhận thêm cú bấm nào nữa — tránh `router.back()` hai lần.
        closing && 'pointer-events-none',
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: closing ? EXIT_MS / 1000 : MOTION.standard }}
      onClick={close}
      data-motion="fade"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={detail.movie.name}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="relative mx-auto my-8 w-[min(56rem,92vw)] overflow-hidden rounded-modal bg-bg-elevated shadow-elev-3 outline-none"
        /**
         * §8.5 — shared element: card ở row biến hình thành modal.
         * `layoutId` khớp với card nguồn; khi chưa khớp được (mở trực tiếp
         * bằng URL) Framer Motion tự rơi về scale — vẫn không phải fade trần.
         */
        layoutId={reducedMotion ? undefined : `movie-card-${detail.movie.slug}`}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
        animate={
          closing
            ? reducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.96 }
            : { opacity: 1, scale: 1 }
        }
        transition={
          closing
            ? { duration: EXIT_MS / 1000 }
            : reducedMotion
              ? { duration: MOTION.micro }
              : MOTION.spring
        }
      >
        <IconButton
          label="Đóng"
          onClick={close}
          className="absolute right-4 top-4 z-10 bg-bg-base/80"
        >
          <CloseIcon />
        </IconButton>

        <InTitleModalContext.Provider value={true}>
          <DetailContent detail={detail} related={related} />
        </InTitleModalContext.Provider>
      </motion.div>
    </motion.div>
  );
}
