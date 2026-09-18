import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailContent } from '@/components/feature/DetailModal/DetailContent';
import { getDetail, getMovieBundle, getRelated, nullOn404 } from '@/lib/endpoints';
import { toPlainText } from '@/lib/sanitize';
import { movieTitle } from '@/lib/derive';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Cùng URL với lời gọi trong page → Next gộp thành MỘT request cho cả lượt render.
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail || !detail.movie.slug) return { title: 'Không tìm thấy phim' };

  const { movie } = detail;
  const description = toPlainText(movie.content, 160);

  return {
    title: movieTitle(movie),
    description,
    openGraph: {
      title: movie.name,
      description,
      images: movie.thumb ? [{ url: movie.thumb }] : undefined,
      type: 'video.movie',
    },
  };
}

/** Trang chi tiết FULL — dùng khi reload hoặc mở link chia sẻ (§6.1). */
export default async function MovieDetailPage({ params }: Props) {
  // §11.3 — 4 endpoint song song; ba phần bổ trợ fail thì ẩn im lặng (§14.1).
  const detail = await nullOn404(() => getMovieBundle(params.slug));

  // API trả 404, hoặc trả 200 với body rỗng — cả hai đều là "không có phim này".
  if (!detail || !detail.movie.slug) notFound();

  const related = await getRelated(detail.movie);

  return (
    <main className="mx-auto max-w-5xl pb-16 pt-16">
      <div className="overflow-hidden rounded-modal bg-bg-elevated shadow-elev-2">
        <DetailContent detail={detail} related={related} />
      </div>
    </main>
  );
}
