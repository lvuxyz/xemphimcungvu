import { RowSkeleton } from '@/components/ui/Skeleton';

/**
 * §12.2 — skeleton giữ layout ổn định. Không dùng spinner.
 *
 * Khung phải khớp trang chủ thật, nếu không thì lúc dữ liệu về cả trang nhảy
 * một cái: hero là ảnh full-bleed chạy sát hai mép (KHÔNG có `px-row`) và cao
 * theo đúng `56vw` như `HeroBillboard`, dưới nó mới là các row.
 */
export default function Loading() {
  return (
    <div>
      <div className="skeleton h-[56vw] max-h-[80svh] min-h-[min(30rem,88svh)] w-full rounded-none" />

      <div className="-mt-[clamp(0.5rem,4vw,4.5rem)] space-y-6 pb-16 pt-6">
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  );
}
