import { PLAYER } from '@/lib/constants';
import { STORAGE_KEYS } from '@/lib/storage';

/**
 * Script chạy TRƯỚC lần vẽ đầu tiên, để row "Tiếp tục xem" không gây layout shift.
 *
 * Vấn đề: row này chỉ dựng được ở client (localStorage), nên HTML từ server không
 * có nó. Chèn nó vào lúc hydrate là đẩy cả "Mới cập nhật" xuống — mà row đó đang
 * nằm trong viewport, nên cú dịch đó tính vào CLS.
 *
 * Không thể đọc cookie ở RSC để biết trước: chạm `cookies()` là cả trang chủ mất
 * full-route cache, đắt hơn nhiều so với thứ nó mua được. Còn PPR — cách của Next
 * cho đúng chuyện "vỏ tĩnh, lỗ động" — thì bản 14.2.35 đang pin ném lỗi, nó chỉ
 * bật được trên canary.
 *
 * Nên: một script đồng bộ, đứng TRƯỚC chỗ chừa trong HTML. Nó chỉ trả lời đúng
 * một câu "máy này có phim đang xem dở không", rồi đánh dấu lên `<html>`; CSS lấy
 * dấu đó để chừa sẵn chiều cao ngay từ lượt vẽ đầu (xem `.continue-slot`).
 *
 * ⚠️ Chuỗi này đọc THẲNG vào hình dạng của `watch-index`, không qua `lib/storage`:
 * nó phải chạy trước khi bất kỳ bundle nào tải xong. Đổi hình dạng index thì sửa
 * cả đây.
 *
 * ⚠️ Điều kiện phải khớp CHÍNH XÁC với bộ lọc của `ContinueRow`: cá nhân hoá đang
 * bật, snapshot có, và `position > PLAYER.resumeMinPosition`. Nới hơn thì chỗ chừa
 * hiện ra rồi xẹp lại vì row quyết định không hiện — đúng cú dịch mà cả cơ chế này
 * sinh ra để tránh. Cờ cá nhân hoá phải đọc ở đây, không phải ở store: store chỉ có
 * sau khi bundle về, mà lúc đó chỗ chừa đã vẽ xong rồi.
 */
export const CONTINUE_PROBE = `try{if(localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.personalized,
)})!=='false'){var r=localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.watchIndex,
)});if(r&&(JSON.parse(r).entries||[]).some(function(e){var t=e&&e.eps&&e.eps[e.lastEp];return e&&e.snapshot&&t&&t[0]>${PLAYER.resumeMinPosition}&&t[1]>0}))document.documentElement.dataset.continueWatching='1'}}catch(e){}`;
