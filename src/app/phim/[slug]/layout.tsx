import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getDetail, nullOn404 } from '@/lib/endpoints';

/**
 * Kiểm slug ở LAYOUT, không phải ở page — đây là chỗ duy nhất `notFound()` ra
 * được HTTP 404 thật mà vẫn giữ `loading.tsx`.
 *
 * Next 14.2 bọc `children` của mỗi layout trong `<Suspense fallback={<Loading/>}>`
 * khi segment có `loading.tsx`. Page và cả `generateMetadata` (lỗi của nó ném ra
 * từ `MetadataOutlet`, render ngay cạnh page) đều nằm TRONG boundary đó: shell
 * kèm skeleton đã gửi đi với status 200 trước khi chúng kịp chạy, `notFound()`
 * chỉ còn đổi được UI phía client. Đo trên build prod: UI not-found, `noindex`
 * đủ cả, nhưng `curl` vẫn ra 200.
 *
 * Layout này nằm NGOÀI boundary của `loading.tsx` cùng thư mục → lỗi rơi vào
 * shell, `app-render` đặt `res.statusCode = 404`. Điều kiện để nó đúng: không có
 * `loading.tsx` nào ở segment CHA — vì thế skeleton trang chủ nằm trong
 * `app/(home)/` chứ không ở `app/`.
 *
 * Chi phí: không thêm request. `getDetail` cùng URL với lời gọi trong page và
 * `generateMetadata` → Next gộp lại thành một trong cùng lượt render.
 */
export default async function MovieDetailLayout({
  params,
  children,
}: {
  params: { slug: string };
  children: ReactNode;
}) {
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail?.movie.slug) notFound();

  return children;
}
