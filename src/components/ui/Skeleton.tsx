import { cn } from '@/lib/cn';

/**
 * §12.2 — "Không dùng spinner. Skeleton giữ layout ổn định."
 * Hiệu ứng shimmer định nghĩa ở styles/globals.css.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-card', className)} />;
}

export function CardSkeleton({ aspect = 'backdrop' }: { aspect?: 'backdrop' | 'poster' }) {
  return (
    <Skeleton className={aspect === 'poster' ? 'aspect-poster w-full' : 'aspect-backdrop w-full'} />
  );
}

/**
 * Khung chờ của một ContentRow.
 *
 * Bề rộng ô phải khớp ĐÚNG breakpoint của card thật trong `ContentRow`
 * (45% → 30% → 19% → 16%), nếu không thì lúc dữ liệu về, cả hàng đổi bề rộng
 * một nhịp — đúng thứ skeleton sinh ra để tránh.
 *
 * `overflow-hidden` là bắt buộc: các ô `shrink-0` cộng lại rộng hơn màn hình,
 * thiếu nó là cả trang cuộn ngang được.
 */
export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      <Skeleton className="mb-3 ml-[var(--row-padding-x)] h-5 w-48" />
      <div className="flex gap-2 overflow-hidden px-row" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[45%] shrink-0 sm:w-[30%] lg:w-[19%] 2xl:w-[16%]">
            <CardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
