import { notFound } from 'next/navigation';
import { DetailContent } from '@/components/feature/DetailModal/DetailContent';
import { DetailModal } from '@/components/feature/DetailModal/DetailModal';
import { pageTitle } from '@/lib/constants';
import { movieTitle } from '@/lib/derive';
import { loadDetailScreen } from '@/lib/endpoints';

/**
 * §6.1 — intercepting route.
 *
 * Click card từ trang chủ vào đây: URL đổi thành /phim/{slug} nhưng nền vẫn
 * giữ trang chủ. F5 tại URL đó sẽ render app/phim/[slug]/page.tsx (trang full).
 */
export default async function InterceptedMovieModal({ params }: { params: { slug: string } }) {
  // §11.3 — cùng bộ dữ liệu với trang full, cùng cache của Next.
  const { detail: detailP, ...rest } = loadDetailScreen(params.slug);
  const detail = await detailP;
  if (!detail) notFound();

  return (
    <DetailModal label={detail.movie.name} documentTitle={pageTitle(movieTitle(detail.movie))}>
      <DetailContent detail={detail} {...rest} />
    </DetailModal>
  );
}
