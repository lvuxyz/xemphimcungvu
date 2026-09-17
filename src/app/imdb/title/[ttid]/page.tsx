import { notFound, redirect } from 'next/navigation';
import { routes } from '@/lib/routes';
import { getMovieByImdb, nullOn404 } from '@/lib/endpoints';

/** §3.2 — `/imdb/title/{ttid}`: tra theo IMDB ID rồi đưa về `/phim/{slug}`. */
export default async function MovieByImdbPage({ params }: { params: { ttid: string } }) {
  const detail = await nullOn404(() => getMovieByImdb(params.ttid));
  if (!detail?.movie.slug) notFound();

  redirect(routes.detail(detail.movie.slug));
}
