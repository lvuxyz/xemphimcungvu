import { notFound } from 'next/navigation';
import { DetailModal } from '@/components/feature/DetailModal/DetailModal';
import { findMockMovie, getMockDetail } from '@/mocks';

/**
 * §6.1 — intercepting route.
 *
 * Click card từ trang chủ vào đây: URL đổi thành /phim/{slug} nhưng nền vẫn
 * giữ trang chủ. F5 tại URL đó sẽ render app/phim/[slug]/page.tsx (trang full).
 */
export default function InterceptedMovieModal({ params }: { params: { slug: string } }) {
  if (!findMockMovie(params.slug)) notFound();

  return <DetailModal detail={getMockDetail(params.slug)} />;
}
