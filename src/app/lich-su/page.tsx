import type { Metadata } from 'next';
import { WatchHistory } from '@/components/feature/WatchHistory/WatchHistory';

export const metadata: Metadata = { title: 'Lịch sử xem' };

/** Lịch sử xem — đọc index tiến độ trong localStorage, không có backend (§10.5). */
export default function HistoryPage() {
  return <WatchHistory />;
}
