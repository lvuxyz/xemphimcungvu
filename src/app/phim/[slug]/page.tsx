import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DetailContent } from '@/components/feature/DetailModal/DetailContent';
import { getDetail, loadDetailScreen, nullOn404 } from '@/lib/endpoints';
import { toPlainText } from '@/lib/sanitize';
import { movieTitle } from '@/lib/derive';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Cùng URL với lời gọi trong page → Next gộp thành MỘT request cho cả lượt render.
  const detail = await nullOn404(() => getDetail(params.slug));
  if (!detail || !detail.movie.slug) notFound();

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

/**
 * Không prerender slug nào lúc build — nhưng SỰ CÓ MẶT của hàm này mới là thứ
 * quyết định.
 *
 * Thiếu nó, Next xếp route vào nhóm dynamic và trả
 * `Cache-Control: private, no-cache, no-store`: mọi lượt xem đều phải đi tới tận
 * origin và render lại, CDN không giữ được gì.
 *
 * Có nó, route thành SSG với `dynamicParams` mặc định true — slug lạ vẫn render
 * on-demand rồi được cache lại — và header thành
 * `s-maxage=…, stale-while-revalidate`. Đo trên build prod: TTFB 150–330ms
 * (cache lạnh) / 70ms (ấm) → 11ms khi `x-nextjs-cache: HIT`. Khoản lớn hơn nằm
 * ở chỗ edge trả thẳng được HTML, tiết kiệm nguyên một vòng RTT từ VN tới origin.
 */
export async function generateStaticParams() {
  return [];
}

/** Trang chi tiết FULL — dùng khi reload hoặc mở link chia sẻ (§6.1). */
export default async function MovieDetailPage({ params }: Props) {
  // §11.3 — mọi endpoint song song; phần bổ trợ stream vào sau, fail thì ẩn im lặng (§14.1).
  // Trang này là ISR (revalidate 30 phút): HTML dựng ra được cache nguyên khối,
  // nên KHÔNG dùng hạn chờ ảnh ngắn như modal — lỡ /images về chậm một lần là
  // khách thấy ảnh dự phòng thay backdrop suốt 30 phút. Chờ ảnh đầy đủ như cũ.
  const { detail: detailP, ...rest } = loadDetailScreen(params.slug, { imagesGraceMs: Infinity });
  const detail = await detailP;

  // API trả 404, hoặc trả 200 với body rỗng — cả hai đều là "không có phim này".
  if (!detail) notFound();

  return (
    <main className="mx-auto max-w-5xl pb-16 pt-16">
      <div className="surface-elevated overflow-hidden rounded-modal shadow-elev-2">
        <DetailContent detail={detail} {...rest} />
      </div>
    </main>
  );
}
