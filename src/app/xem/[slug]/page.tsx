import { redirect } from 'next/navigation';

interface Props {
  params: { slug: string };
}

export default function WatchRedirectPage({ params }: Props) {
  redirect(`/xem/${params.slug}/1`);
}
