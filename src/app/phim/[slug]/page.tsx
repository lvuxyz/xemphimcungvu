import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailContent } from '@/components/feature/DetailModal/DetailContent';
import { toPlainText } from '@/lib/sanitize';
import { findMockMovie, getMockDetail } from '@/mocks';

interface Props {
  params: { slug: string };
}

export function generateMetadata({ params }: Props): Metadata {
  const movie = findMockMovie(params.slug);
  if (!movie) return { title: 'Không tìm thấy phim' };

  const detail = getMockDetail(params.slug);
  return {
    title: `${movie.name} (${movie.year})`,
    description: toPlainText(detail.movie.content, 160),
  };
}

/** Trang chi tiết FULL — dùng khi reload hoặc mở link chia sẻ (§6.1). */
export default function MovieDetailPage({ params }: Props) {
  if (!findMockMovie(params.slug)) notFound();

  return (
    <main className="mx-auto max-w-5xl pb-16 pt-16">
      <div className="overflow-hidden rounded-modal bg-bg-elevated shadow-elev-2">
        <DetailContent detail={getMockDetail(params.slug)} />
      </div>
    </main>
  );
}
