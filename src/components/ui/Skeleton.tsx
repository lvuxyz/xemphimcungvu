import { cn } from '@/lib/cn';

/**
 * §12.2 — "Không dùng spinner. Skeleton giữ layout ổn định."
 * Hiệu ứng shimmer định nghĩa ở styles/globals.css.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-card', className)} />;
}

/** Khung chờ của một `MovieCard`: ảnh + khối chữ dưới ảnh (card nào cũng có khối đó). */
export function CardSkeleton({ aspect = 'backdrop' }: { aspect?: 'backdrop' | 'poster' }) {
  return (
    <div aria-hidden="true">
      <Skeleton
        className={aspect === 'poster' ? 'aspect-poster w-full' : 'aspect-backdrop w-full'}
      />
      <CardMetaSkeleton />
    </div>
  );
}

/**
 * Khung chờ của khối tên · tên gốc · năm dưới ảnh card (`MovieCard`).
 *
 * Cùng padding, cùng khoảng cách dòng và cùng class cỡ chữ với khối thật, mỗi dòng
 * giữ một `&nbsp;` — nên chiều cao ra đúng line-height của khối thật thay vì một
 * con số đo tay rồi lệch khi ai đó đổi cỡ chữ. Thiếu khối này thì trên điện thoại
 * khung chờ thấp hơn row thật 80px (đo ở 375px: 143px → 223px), và dữ liệu về là
 * cả phần trang bên dưới giật xuống.
 */
function CardMetaSkeleton() {
  const bar = 'skeleton inline-block rounded-sm align-top';

  return (
    <div className="space-y-1 p-2">
      <p className="text-xs">
        <span className={cn(bar, 'w-3/4')}>&nbsp;</span>
      </p>
      <p className="text-[11px]">
        <span className={cn(bar, 'w-1/2')}>&nbsp;</span>
      </p>
      <div className="flex text-[10px]">
        <span className={cn(bar, 'w-8')}>&nbsp;</span>
      </div>
    </div>
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
