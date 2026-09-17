import { notFound, redirect } from 'next/navigation';
import { routes } from '@/lib/routes';
import { getMovieById, nullOn404 } from '@/lib/endpoints';

/**
 * §3.2 — `/phim/id/{_id}`: tra phim theo `_id` rồi đưa về URL chuẩn `/phim/{slug}`.
 * Cần khi trong tay chỉ có `_id` (log, link cũ, dữ liệu import).
 */
export default async function MovieByIdPage({ params }: { params: { id: string } }) {
  const detail = await nullOn404(() => getMovieById(params.id));
  if (!detail?.movie.slug) notFound();

  redirect(routes.detail(detail.movie.slug));
}
