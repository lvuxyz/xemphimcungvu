import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getCategories } from '@/lib/endpoints';

/**
 * Slug lạ → 404 thật. Phải kiểm ở layout, ngoài Suspense của `loading.tsx` —
 * xem `app/phim/[slug]/layout.tsx`.
 *
 * Tra danh mục thể loại (cache 24h) chứ không gọi `/the-loai/{slug}`: page gọi
 * endpoint đó KÈM bộ lọc nên URL khác, không gộp được, thành request thừa. Danh
 * mục tải hỏng thì cho qua — page tự `notFound()` khi API trả 404.
 */
export default async function CategoryLayout({
  params,
  children,
}: {
  params: { slug: string };
  children: ReactNode;
}) {
  const categories = await getCategories().catch(() => []);
  if (categories.length > 0 && !categories.some((item) => item.slug === params.slug)) notFound();

  return children;
}
