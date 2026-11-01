/**
 * Đếm số lớp modal đang đứng trên màn hình — skeleton (`loading.tsx`) hoặc panel
 * thật (`DetailModal`).
 *
 * Cả hai đều là cây con của slot `@modal`, mà Next thay cây đó MỖI lần đổi trạng
 * thái: skeleton → panel khi dữ liệu về, panel → skeleton → panel khi bấm sang phim
 * liên quan. Với người xem đó vẫn là MỘT modal đang mở; chỉ lớp nào xuất hiện khi
 * chưa có lớp nào khác mới được chạy hiệu ứng mở.
 *
 * Biến phạm vi module chứ không phải store: không ai cần render lại theo nó.
 * Lớp mới đọc giá trị này lúc khởi tạo state — khi lớp cũ vẫn còn mount, vì
 * effect dọn của lớp cũ chỉ chạy lúc commit, sau lượt render của lớp mới.
 */
let layers = 0;

export function modalOnScreen(): boolean {
  return layers > 0;
}

/** Dùng làm thân `useLayoutEffect(trackModalLayer, [])`. */
export function trackModalLayer(): () => void {
  layers += 1;
  return () => {
    layers -= 1;
  };
}
