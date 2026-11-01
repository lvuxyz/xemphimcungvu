'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { cn } from '@/lib/cn';
import { isDetailPath } from '@/lib/routes';
import { useScrollLock } from '@/hooks/useScrollLock';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';
import { InTitleModalContext } from './modal-context';
import { modalOnScreen, trackModalLayer } from './modal-motion';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Ngắn hơn lúc mở (§9.2): đóng phải dứt khoát, không bắt người dùng chờ.
 * Đây là khoảng chờ CỨNG trước `router.back()` — mỗi ms ở đây là một ms trang
 * nền chưa bấm được, nên chỉ vừa đủ để mắt thấy modal lùi đi chứ không tắt phụt.
 */
const EXIT_MS = 150;

/**
 * Chốt chặn: modal chỉ được tồn tại khi URL còn nằm ở `/phim/{slug}`.
 *
 * Next 14 giữ nguyên nội dung đang hoạt động của một parallel slot khi điều
 * hướng MỀM sang route mà slot đó không khớp (tài liệu Parallel Routes, mục
 * "Soft Navigation"). Mở modal rồi bấm Phát: `children` đổi sang trang phát,
 * nhưng `@modal` VẪN GIỮ `(.)phim/[slug]` — modal chi tiết đứng nguyên đó che
 * kín player, `<video>` chạy phía sau lớp blur và `body` thì vẫn bị khoá scroll.
 *
 * `default.tsx` không cứu được: nó chỉ được hỏi tới ở lần tải CỨNG. Thêm
 * `@modal/[...catchAll]/page.tsx` trả null — cách vẫn được mách nhau — cũng
 * không: đã thử trên đúng 14.2.35 này, dev log in `Compiling /[...catchAll]`
 * nhưng modal vẫn dính (`role="dialog"` còn nguyên trong DOM ở `/xem/...`), vì
 * phía client không hỏi lại slot mà giữ luôn state cũ.
 *
 * Nên chặn ở nơi duy nhất biết chắc câu trả lời: chính component. `pathname`
 * không còn bắt đầu bằng `/phim/` nghĩa là người dùng đã rời modal — tháo cả
 * cây. Tháo chứ không phải ẩn: effect dọn dẹp chạy theo, scroll lock nhả ra,
 * bẫy focus và phím ESC gỡ đi, ảnh trong modal thôi giữ bộ nhớ.
 *
 * Bấm Back từ trang phát thì slot được khôi phục, `pathname` khớp lại, modal
 * hiện ra như cũ — đúng thứ người dùng mong đợi.
 */
export function DetailModal(props: DetailModalProps) {
  const pathname = usePathname();

  /**
   * So theo HÌNH DẠNG đường dẫn chứ không so đúng `routes.detail(slug)`: lúc
   * bấm sang phim liên quan ("Có thể bạn thích") URL đổi slug trước, nội dung
   * modal về sau — so đúng slug sẽ làm modal chớp tắt một nhịp giữa hai phim.
   */
  if (!isDetailPath(pathname)) return null;

  return <DetailModalPanel {...props} />;
}

interface DetailModalProps {
  /** Tên phim — nhãn của `role="dialog"`. */
  label: string;
  /** `<title>` của tab khi modal mở — xem effect bên dưới. */
  documentTitle: string;
  /**
   * Thân modal (`DetailContent`) do RSC dựng sẵn và truyền vào như children —
   * KHÔNG import ở đây. Import thì nó, `sanitize` và cả DOMPurify bị kéo sang
   * chunk client của lần mở modal đầu tiên, và phần stream (diễn viên, phim liên
   * quan) không còn là Server Component được nữa.
   */
  children: ReactNode;
}

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
function DetailModalPanel({ label, documentTitle, children }: DetailModalProps) {
  const { goBackOrHome } = useAppNavigation();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  /**
   * Hiệu ứng mở chỉ chạy MỘT lần cho mỗi lần người dùng mở modal.
   *
   * Lần mở có skeleton thì skeleton (`loading.tsx`) đã bung ra rồi; chạy tiếp
   * hiệu ứng ở đây là bắt modal đang đứng yên tụt về opacity 0 rồi bung lại — hai
   * lượt mở chồng nhau, cộng thêm ~450ms sau khi dữ liệu đã về. Đổi sang phim
   * liên quan cũng vậy: modal vẫn đứng đó, chỉ ruột của nó đổi.
   *
   * Đọc một lần lúc khởi tạo state: lúc này lớp cũ (skeleton hoặc panel của phim
   * trước) vẫn còn trên màn hình, effect dọn của nó chưa chạy.
   */
  const [enter] = useState(() => !modalOnScreen());
  useLayoutEffect(trackModalLayer, []);

  /**
   * Đóng modal đi hai nhịp: chạy animation thoát trước, `router.back()` sau.
   *
   * Không thể để route tự lo phần thoát: modal là một route song song, khi
   * `router.back()` chạy thì cả cây này bị tháo cùng route — không còn ai ở lại
   * để chạy hiệu ứng. Kết quả là modal mở ra bung mượt mà rồi TẮT PHỤT lúc bấm
   * ESC. Tự giữ `EXIT_MS` rồi mới lùi route thì hai đầu cân nhau.
   */
  const [closing, setClosing] = useState(false);

  useScrollLock(true);

  /**
   * `<title>` phải đi theo phim đang mở.
   *
   * Metadata của Next chỉ đọc theo nhánh `children`, nên modal mở bằng điều
   * hướng mềm để lại nguyên cái tên của trang NỀN: đứng ở
   * `/phim/te-cong-hang-long-tru-yeu` mà tab vẫn đề "Phim bộ · Xem phim cùng
   * vũ", và mục lịch sử của URL đó cũng được ghi bằng cái tên sai ấy. F5 thì
   * đúng — cùng một URL cho ra hai cái tên khác nhau tuỳ đường đến.
   *
   * Không chữa được bằng `generateMetadata` trong slot: thử đặt vào
   * `@modal/(.)phim/[slug]/page.tsx` thì MỌI route slot không khớp lăn ra 404
   * (`/danh-sach/phim-bo` trả 404 ngay ở lần tải cứng). Next không đỡ metadata
   * cho parallel slot.
   *
   * Lúc tháo chỉ trả lại tên cũ khi KHÔNG ai đổi title sau mình. Bấm Phát thì
   * Next đã kịp đặt tên trang phát trước khi cleanup chạy — trả về lúc đó là
   * dán ngược cái tên cũ đè lên tên đúng.
   */
  useEffect(() => {
    const restored = document.title;
    document.title = documentTitle;

    return () => {
      if (document.title === documentTitle) document.title = restored;
    };
  }, [documentTitle]);

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
    <div
      className={cn(
        'fixed inset-0 z-modal flex items-center justify-center overflow-y-auto overscroll-contain bg-bg-base/70 p-4 backdrop-blur-[8px]',
        enter && 'modal-backdrop-in',
        // Đang thoát thì không nhận thêm cú bấm nào nữa — tránh `router.back()` hai lần.
        closing && 'modal-backdrop-out pointer-events-none',
      )}
      style={closing ? { animationDuration: `${EXIT_MS}ms` } : undefined}
      onClick={close}
    >
      {/*
        CSS keyframes chứ không phải framer-motion: hai lớp này chỉ animate opacity
        và scale. framer (cùng `layoutId` không khớp với card nào) là ~40KB JS phải
        tải xong thì modal mới vẽ được ở lần mở đầu tiên.
      */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'surface-elevated relative flex max-h-[90vh] w-[min(56rem,92vw)] flex-col overflow-hidden rounded-modal shadow-elev-3 outline-none',
          enter && 'modal-panel-in',
          closing && 'modal-panel-out',
        )}
        style={closing ? { animationDuration: `${EXIT_MS}ms` } : undefined}
      >
        <IconButton
          label="Đóng"
          onClick={close}
          className="absolute right-4 top-4 z-10 bg-bg-base/80"
        >
          <CloseIcon />
        </IconButton>

        {/* Panel bị chặn chiều cao ở 90vh (§8.5 dòng góp ý): nội dung dài (ảnh nền +
            lưới tập + gợi ý liên quan) cuộn BÊN TRONG đây, nút đóng đứng yên phía trên. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <InTitleModalContext.Provider value={true}>{children}</InTitleModalContext.Provider>
        </div>
      </div>
    </div>
  );
}
