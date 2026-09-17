import { notFound, redirect } from 'next/navigation';
import { getMovieByTmdb, nullOn404 } from '@/lib/endpoints';

/** §3.2 — `/tmdb/{movie|tv}/{id}`: tra theo TMDB ID rồi đưa về `/phim/{slug}`. */
export default async function MovieByTmdbPage({
  params,
}: {
  params: { type: string; id: string };
}) {
  if (params.type !== 'movie' && params.type !== 'tv') notFound();

  const detail = await nullOn404(() => getMovieByTmdb(params.type as 'movie' | 'tv', params.id));
  if (!detail?.movie.slug) notFound();

  redirect(`/phim/${detail.movie.slug}`);
}
