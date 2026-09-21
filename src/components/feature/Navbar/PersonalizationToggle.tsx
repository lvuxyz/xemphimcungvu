'use client';

import { cn } from '@/lib/cn';
import { useWatchStore } from '@/store/useWatchStore';

/**
 * Công tắc tắt/bật cá nhân hoá.
 *
 * Vì sao phải có: mọi thứ cá nhân hoá ở app này đọc từ máy người xem và không có gì
 * rời khỏi máy — nhưng máy dùng chung trong gia đình là chuyện thường, và row "Tiếp
 * tục xem" giữa trang chủ kể cho cả nhà biết tối qua ai xem gì. Đó là lý do cái
 * công tắc này tồn tại, chứ không phải vì dữ liệu đi đâu.
 *
 * Dùng ở hai chỗ: dropdown trong navbar (từ `lg` lên) và chân menu điện thoại. Cùng
 * một component để hai chỗ không bao giờ nói hai điều khác nhau.
 */
export function PersonalizationToggle({ className }: { className?: string }) {
  const personalized = useWatchStore((s) => s.personalized);
  const setPersonalized = useWatchStore((s) => s.setPersonalized);

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
    </div>
  );
}
