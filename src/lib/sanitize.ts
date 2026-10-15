/**
 * §14.4 — `movie.content` là HTML THÔ từ API.
 * Bắt buộc đi qua đây trước khi `dangerouslySetInnerHTML`.
 *
 * Đây là rủi ro bảo mật mức Cao trong §17 (#8). Không có ngoại lệ.
 */

import DOMPurify from 'isomorphic-dompurify';

/** Whitelist theo §14.4 — cố tình hẹp. Mở rộng phải có lý do rõ ràng. */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'] as const;
const ALLOWED_ATTR = ['href', 'title'] as const;

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    // Chặn javascript:, data: và mọi scheme lạ trên <a href>.
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
    ADD_ATTR: ['target', 'rel'],
    RETURN_TRUSTED_TYPE: false,
  });
}

/** Thẻ khối: bỏ thẻ mà không chèn gì vào chỗ nó thì hai đoạn dính liền "…cuối.Đầu…". */
const BLOCK_TAG = /<\/?(?:p|br|li|ul|ol|div|h[1-6])\b[^>]*>/gi;

/**
 * Bản rút gọn không thẻ — dùng cho `<meta description>` và dòng tóm tắt ở hero.
 *
 * Trả CHỮ THẬT, không phải HTML: đọc `textContent` của cây đã lọc chứ không lấy
 * chuỗi `sanitize()` trả về. Chuỗi đó vẫn là HTML đã mã hoá — "Tom &amp; Jerry",
 * "&nbsp;" — mà cả React lẫn metadata của Next đều mã hoá THÊM một lần nữa khi
 * render, nên người xem thấy nguyên chữ "&amp;".
 */
export function toPlainText(dirty: string, maxLength?: number): string {
  if (!dirty) return '';

  const fragment = DOMPurify.sanitize(dirty.replace(BLOCK_TAG, ' '), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
  });
  const text = (fragment.textContent ?? '').replace(/\s+/g, ' ').trim();

  if (maxLength === undefined || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}
