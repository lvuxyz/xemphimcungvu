'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { routes } from '@/lib/routes';
import { useUIStore } from '@/store/useUIStore';
import { useWatchStore } from '@/store/useWatchStore';

/** Bao lâu thì cú bấm "Xoá" đầu tiên hết hiệu lực và nút trở về trạng thái thường. */
const CONFIRM_TIMEOUT = 5_000;

/**
 * Công tắc tắt/bật cá nhân hoá, và nút xoá dữ liệu xem.
 *
 * Vì sao phải có: mọi thứ cá nhân hoá ở app này đọc từ máy người xem và không có gì
 * rời khỏi máy — nhưng máy dùng chung trong gia đình là chuyện thường, và row "Tiếp
 * tục xem" giữa trang chủ kể cho cả nhà biết tối qua ai xem gì. Đó là lý do hai thứ
 * này tồn tại, chứ không phải vì dữ liệu đi đâu.
 *
 * Hai việc KHÁC NHAU, cố ý để cạnh nhau: tắt là không đem ra hiện (bật lại thì còn
 * nguyên), xoá là không còn gì để hiện (một chiều).
 *
 * Dùng ở hai chỗ: dropdown trong navbar (từ `lg` lên) và chân menu điện thoại. Cùng
 * một component để hai chỗ không bao giờ nói hai điều khác nhau.
 */
export function PersonalizationToggle({
  className,
  onNavigate,
}: {
  className?: string;
  /** Dropdown desktop không tự đóng khi đổi route — nơi chứa truyền vào để tự đóng. */
  onNavigate?: () => void;
}) {
  const personalized = useWatchStore((s) => s.personalized);
  const setPersonalized = useWatchStore((s) => s.setPersonalized);
  /**
   * `hasData` của store, KHÔNG phải `entries.length`: tắt cá nhân hoá là `entries` về
   * rỗng trong khi dữ liệu vẫn còn nguyên — đếm `entries` thì đúng người đã tắt lại
   * là người không thấy nút xoá.
   */
  const hasData = useWatchStore((s) => s.hasData);
  const clearAll = useWatchStore((s) => s.clearAll);
  const refresh = useWatchStore((s) => s.refresh);

  /**
   * Đọc lại mỗi lần panel mở (component chỉ mount khi dropdown / menu điện thoại mở).
   * Store chỉ được nạp lúc khởi động và ở trang chủ, nên người mới xem tập đầu tiên
   * rồi mở ⚙ ngay trên trang phát sẽ thấy `hasData` cũ — không có nút xoá. Rẻ: index
   * đã nằm trong RAM của `lib/storage.ts`.
   */
  useEffect(() => refresh(), [refresh]);
  const pushToast = useUIStore((s) => s.pushToast);

  /**
   * Xoá là một chiều nên phải hỏi lại, mà hỏi bằng `window.confirm` thì vừa lạc khỏi
   * giao diện app vừa chặn cả tab. Nút tự đổi thành "Chắc chắn xoá?" và chỉ cú bấm
   * thứ hai mới xoá thật — cùng số lần bấm, mà câu hỏi nằm đúng chỗ người dùng đang
   * nhìn.
   */
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT);
    return () => clearTimeout(timer);
  }, [confirming]);

  const onDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    clearAll();
    setConfirming(false);
    pushToast('Đã xoá dữ liệu xem trên máy này', { variant: 'success' });
  };

  return (
    <div className={cn('px-3 py-2', className)}>
      {/*
        `role="switch"` chứ không phải checkbox: đây là một trạng thái BẬT/TẮT có hiệu
        lực ngay, không phải một ô chờ bấm "Lưu" (§13.3).
      */}
      <button
        type="button"
        role="switch"
        aria-checked={personalized}
        onClick={() => setPersonalized(!personalized)}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-4 rounded-card px-1',
          'text-left transition-colors duration-micro ease-standard hover:bg-bg-hover',
        )}
      >
        <span className="text-[15px] font-medium text-text-primary">Cá nhân hoá</span>

        <span
          aria-hidden="true"
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-pill transition-colors duration-micro ease-standard',
            personalized ? 'bg-accent' : 'bg-white/20',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-pill bg-white shadow-elev-1',
              'transition-transform duration-micro ease-standard',
              personalized ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
            )}
          />
        </span>
      </button>

      {/*
        Nói rõ thứ KHÔNG bị tắt. Người tắt vì sợ lộ lịch sử cần biết trình phát vẫn
        nhớ chỗ đang xem, còn người tắt vì thấy trang chủ bị xáo cần biết mình không
        đánh đổi mất tính năng nào.
      */}
      <p className="mt-1 px-1 text-[11px] leading-snug text-text-muted">
        {personalized
          ? 'Trang chủ sắp theo phim bạn đã xem và hiện row "Tiếp tục xem".'
          : 'Trang chủ hiện thứ tự mặc định. Trình phát vẫn nhớ chỗ đang xem của từng tập.'}
      </p>

      {/* Lịch sử chỉ có nghĩa khi đang được đem ra hiện và có thứ để hiện. */}
      {personalized && hasData && (
        <Link
          href={routes.history()}
          onClick={onNavigate}
          className={cn(
            'mt-2 flex min-h-[44px] w-full items-center rounded-card px-1 text-left',
            'text-[13px] text-text-secondary transition-colors duration-micro ease-standard',
            'hover:bg-bg-hover hover:text-text-primary',
          )}
        >
          Xem lịch sử xem
        </Link>
      )}

      {/* Không có gì để xoá thì đừng mời xoá — nút chỉ hiện khi thật sự có dữ liệu. */}
      {hasData && (
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            'mt-2 flex min-h-[44px] w-full items-center rounded-card px-1 text-left',
            'text-[13px] transition-colors duration-micro ease-standard hover:bg-bg-hover',
            confirming ? 'font-medium text-danger' : 'text-text-secondary',
          )}
        >
          {confirming ? 'Chắc chắn xoá? Bấm lại để xoá.' : 'Xoá dữ liệu xem trên máy này'}
        </button>
      )}
    </div>
  );
}
