'use client';

import type { Movie } from '@/types/movie';
import { useMyListStore } from '@/store/useMyListStore';
import { useUIStore } from '@/store/useUIStore';
import { Button } from '@/components/ui/Button';
import { CheckIcon, PlusIcon } from '@/components/ui/icons';

/**
 * §8.5 — nút "Danh sách" của màn chi tiết.
 *
 * Tách riêng thành client component vì `DetailContent` còn được render từ RSC
 * (`/phim/[slug]`), mà store zustand chỉ sống ở client. Hành vi giống hệt nút +
 * trong HoverPreview: toggle + toast một dòng.
 */
export function MyListButton({ movie }: { movie: Movie }) {
  const inMyList = useMyListStore((s) => s.entries.some((e) => e.slug === movie.slug));
  const toggleMyList = useMyListStore((s) => s.toggle);
  const pushToast = useUIStore((s) => s.pushToast);

  const handleClick = () => {
    const added = toggleMyList(movie);
    pushToast(added ? `Đã thêm "${movie.name}" vào danh sách` : 'Đã gỡ khỏi danh sách của tôi', {
      variant: added ? 'success' : 'info',
      duration: 2500,
    });
  };

  return (
    <Button
      variant="secondary"
      onClick={handleClick}
      aria-pressed={inMyList}
      title={inMyList ? 'Gỡ khỏi danh sách của tôi' : 'Thêm vào danh sách của tôi'}
    >
      {inMyList ? <CheckIcon /> : <PlusIcon />}
      {inMyList ? 'Đã lưu' : 'Danh sách'}
    </Button>
  );
}
