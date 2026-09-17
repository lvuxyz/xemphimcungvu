import { notFound } from 'next/navigation';
import { DetailModal } from '@/components/feature/DetailModal/DetailModal';
import { getMovieBundle, getRelated, nullOn404 } from '@/lib/endpoints';

/**
 * §6.1 — intercepting route.
 *
 * Click card từ trang chủ vào đây: URL đổi thành /phim/{slug} nhưng nền vẫn
 * giữ trang chủ. F5 tại URL đó sẽ render app/phim/[slug]/page.tsx (trang full).
 */
export default async function InterceptedMovieModal({ params }: { params: { slug: string } }) {
  // §11.3 — cùng bộ dữ liệu với trang full, cùng cache của Next.
  const detail = await nullOn404(() => getMovieBundle(params.slug));
  if (!detail || !detail.movie.slug) notFound();

  const related = await getRelated(detail.movie);

  return <DetailModal detail={detail} related={related} />;
}
