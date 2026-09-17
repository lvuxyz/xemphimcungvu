'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { MOTION } from '@/lib/constants';
import type { Movie, MovieDetailBundle } from '@/types/movie';
import { useScrollLock } from '@/hooks/useScrollLock';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';
import { DetailContent } from './DetailContent';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useScrollLock(true);

  // Ghi nhớ phần tử đang focus để trả lại khi đóng.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []);

  const close = useCallback(() => router.back(), [router]);

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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-modal overflow-y-auto overscroll-contain bg-bg-base/70 backdrop-blur-[8px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.standard }}
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
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={reducedMotion ? { duration: MOTION.micro } : MOTION.spring}
        >
          <IconButton
            label="Đóng"
            onClick={close}
            className="absolute right-4 top-4 z-10 bg-bg-base/80"
          >
            <CloseIcon />
          </IconButton>

          <DetailContent detail={detail} related={related} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
