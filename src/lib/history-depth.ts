/**
 * "Bấm Back có an toàn không?"
 *
 * `router.back()` là con dao hai lưỡi: vào app từ trang chủ rồi mở modal thì lùi
 * lại đúng là đóng modal; nhưng mở thẳng link chia sẻ trong tab mới thì lùi lại
 * là rời khỏi site — người dùng bấm ✕ và bị ném về Google.
 *
 * `history.length` KHÔNG trả lời được câu này. Tab mới mở từ link vẫn có
 * `length >= 1`; trình duyệt còn cộng dồn lịch sử của trang trước trong cùng tab;
 * và `length` không giảm khi lùi lại, nên sau một nhịp back nó vẫn báo "còn chỗ
 * để lùi" trong khi ta đã đứng ở entry đầu tiên.
 *
 * Thứ trả lời được: app này đã tự điều hướng lần nào chưa. Nếu `pathname` từng
 * đổi ở phía client thì chắc chắn có ít nhất một entry của chúng ta ở phía sau.
 *
 * Để ở phạm vi module chứ không phải state: giá trị này phải sống xuyên qua mọi
 * lần mount/unmount của component, và không được kéo theo một lần render nào.
 */

let navigated = false;

/** `NavigationTracker` gọi khi `pathname` đổi lần đầu ở phía client. */
export function markNavigated(): void {
  navigated = true;
}

/**
 * Có entry nào của chính app ở phía sau để lùi về không.
 * `false` → nơi gọi phải điều hướng tới route dự phòng thay vì `router.back()`.
 */
export function canGoBack(): boolean {
  return navigated;
}

/** Chỉ dùng cho test — đưa module về trạng thái vừa tải trang. */
export function resetNavigationHistory(): void {
  navigated = false;
}
