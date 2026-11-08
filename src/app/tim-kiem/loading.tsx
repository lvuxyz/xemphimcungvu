import { ListPageSkeleton } from '@/components/ui/Skeleton';

/** Next không truyền prop cho loading — phải bọc hàm riêng để tắt hàng filter. */
export default function SearchLoading() {
  return <ListPageSkeleton filters={false} />;
}
