import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Chỉ để mang `metadata`: `page.tsx` là client component (đọc localStorage qua
 * zustand) nên không export được nó, và tab sẽ chỉ hiện tên site trong khi mọi
 * trang danh sách khác đều có tiêu đề riêng.
 */
export const metadata: Metadata = {
  title: 'Danh sách của tôi',
};

export default function MyListLayout({ children }: { children: ReactNode }) {
  return children;
}
