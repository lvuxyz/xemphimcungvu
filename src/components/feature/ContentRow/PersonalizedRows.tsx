'use client';

import { useMemo } from 'react';
import { homeSectionOf } from '@/lib/home';
import { personalizeRows, type ListedMovie, type TasteRow } from '@/lib/taste';
import { useMyListHydrated, useMyListStore } from '@/store/useMyListStore';
import { useWatchStore } from '@/store/useWatchStore';
import { LazyRow } from './LazyRow';

const NO_LIST: readonly ListedMovie[] = [];

/**
 * Các row lazy của trang chủ, sắp theo sở thích của chính người đang xem.
 *
 * Vì sao chỗ này là client component mà trang chủ vẫn là RSC: `ListSource` là
 * object thuần nên đi qua được ranh giới RSC → client (đó là lý do nó tồn tại, xem
 * `lib/list-source.ts`). Server gửi xuống danh sách row theo thứ tự mặc định;
 * client đảo lại theo dữ liệu chỉ nó có.
 *
 * Hai thứ giữ cho việc đảo chỗ này không tốn gì:
 *
 *   · lượt render đầu ở client dùng ĐÚNG thứ tự của server (store còn rỗng), nên
 *     không có hydration mismatch
 *   · lúc đảo, mọi row đều đang là khung chờ cùng chiều cao và chưa row nào fetch —
 *     không dịch pixel, không request nào bị bỏ đi
 *
 * Và nó KHÔNG làm tăng số request: vẫn 3 row, vẫn `LazyRow` chờ viewport. Đảo thứ
 * tự chỉ đổi row nào được gọi trước — cùng số lời gọi, trả về thứ đáng xem hơn.
 *
 * ⚠️ `key` theo VỊ TRÍ, không theo `row.id`. Nghe như ngược với mọi lời khuyên về
 * key, nhưng ở đây vị trí mới là thứ cố định (đúng 3 chỗ) còn nội dung mới là thứ
 * thay đổi — và cách này là bắt buộc, không phải tuỳ chọn:
 *
 * Key theo `id` thì React DỜI node DOM khi thứ tự đổi. Node bị tháo ra cắm lại làm
 * `IntersectionObserver` của `LazyRow` bắn theo hình học tạm thời giữa lúc dời, và
 * hai row vừa lên đầu tưởng mình đã vào viewport → fetch ngay. Đo trên bản build
 * thật: 2 request tới KKPhim ở `scrollY = 0`, đúng thứ §11.2 cấm (không có cá nhân
 * hoá thì 0).
 *
 * Key theo vị trí thì không node nào dời: React chỉ đổi props của chỗ sẵn có. Trạng
 * thái "đã vào viewport" thuộc về VỊ TRÍ chứ không thuộc về row — đó mới đúng nghĩa.
 */
export function PersonalizedRows({ rows }: { rows: readonly TasteRow[] }) {
  const entries = useWatchStore((s) => s.entries);
  const personalized = useWatchStore((s) => s.personalized);

  /**
   * "Danh sách của tôi" là tín hiệu thứ hai — và là tín hiệu DUY NHẤT có được với
   * người mới: lưu vài phim rồi chưa xem gì thì trang chủ vẫn nói được điều gì đó.
   *
   * Hai cái chốt ở đây, cả hai đều cần thiết:
   *
   *   · `useMyListHydrated()` — persist của zustand đọc localStorage ĐỒNG BỘ ngay
   *     trong `create()`, nên `entries` của nó đã có dữ liệu ngay lượt render ĐẦU ở
   *     client. Dùng thẳng thì thứ tự row lượt đầu khác HTML server → hydration
   *     mismatch. `entries` của `useWatchStore` không có vấn đề này vì nó chỉ được
   *     nạp trong effect.
   *   · `personalized` — cổng tắt của store chỉ rút `entries` của chính nó; danh
   *     sách này đến từ store khác nên phải tự đi qua cùng cái cổng đó.
   */
  const hydrated = useMyListHydrated();
  const myList = useMyListStore((s) => s.entries);
  const listed = hydrated && personalized ? myList : NO_LIST;

  const ordered = useMemo(
    () => personalizeRows(rows, entries, { listed }),
    [rows, entries, listed],
  );

  return (
    <>
      {ordered.map((row, index) => {
        /**
         * Chỉ section có route cache sẵn (`/api/home/*`) mới dựng được. Ba row loại
         * phim hiện tại thì luôn có; `personalizeRows` chỉ đổi nguồn một row sang
         * thể loại khi trang có sẵn row thể loại — mà trang chủ không còn row nào.
         */
        const section = homeSectionOf(row.source);
        return (
          section && (
            // eslint-disable-next-line react/no-array-index-key -- xem chú thích trên
            <LazyRow key={index} title={row.title} section={section} href={row.href} />
          )
        );
      })}
    </>
  );
}
