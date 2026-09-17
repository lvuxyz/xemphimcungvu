import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';

interface Props {
  params: { slug: string };
}

export default function WatchRedirectPage({ params }: Props) {
  redirect(routes.watch(params.slug));
}
