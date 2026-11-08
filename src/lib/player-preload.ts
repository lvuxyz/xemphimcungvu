/**
 * Tải trước trình phát — chunk `VideoPlayer` và hls.js — trước khi tới `/xem`.
 *
 * Không có file này thì đường vào trang phát là một bậc thác hai nấc: route commit
 * → `WatchScreen` render → mới đi lấy chunk `VideoPlayer` (next/dynamic) → chunk
 * đó chạy `useHls` → mới đi lấy hls.js → mới xin m3u8. Payload RSC đã prefetch
 * cũng không làm ấm được chunk nào, vì nó chỉ trỏ tới chunk của `WatchScreen`.
 *
 * Chỉ gọi theo Ý ĐỊNH phát (chạm/lướt/focus nút Phát, link tập, card "Tiếp tục
 * xem"), KHÔNG gọi lúc mở modal hay hover card phim: ~55KB+ cho người không bấm
 * Phát là tranh băng thông với ảnh và LCP của modal.
 */

/**
 * hls.js (~55KB gzip) — MỘT promise dùng chung cho cả app: `useHls`, `WatchScreen`
 * và các chỗ tải trước đều đi qua đây, nên dù gọi bao nhiêu lần cũng chỉ một request.
 *
 * Lỗi thì quên promise đi: nút "Thử lại" phải được import lại từ đầu, không nhận
 * mãi một promise đã hỏng (rớt mạng, chunk cũ sau deploy).
 */
let hlsModule: Promise<typeof import('hls.js')> | null = null;

export function loadHls() {
  hlsModule ??= import('hls.js').catch((error: unknown) => {
    hlsModule = null;
    throw error;
  });
  return hlsModule;
}

let playerModule: Promise<unknown> | null = null;

/**
 * Specifier phải TRÙNG từng ký tự với `import()` trong `next/dynamic` của
 * `WatchScreen` — webpack gom theo specifier, khác chữ là ra chunk khác và tải
 * trước thành tải thừa.
 */
function loadPlayerChunk() {
  playerModule ??= import('@/components/feature/VideoPlayer/VideoPlayer').catch(
    (error: unknown) => {
      playerModule = null;
      throw error;
    },
  );
  return playerModule;
}

/**
 * Idempotent, chỉ chạy phía client. `hls: false` cho tập chỉ có link nhúng —
 * tập đó không bao giờ cần hls.js. Không chặn theo tier ở đây: chỗ gọi đã biết
 * tier (`useDevice`) và tự quyết, cùng chỗ quyết `router.prefetch`.
 */
export function preloadPlayer({ hls = true }: { hls?: boolean } = {}) {
  if (typeof window === 'undefined') return;
  loadPlayerChunk().catch(() => {});
  if (hls) loadHls().catch(() => {});
}
