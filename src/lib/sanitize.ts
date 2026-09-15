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

/** Bản rút gọn không thẻ — dùng cho `<meta description>` và dòng mô tả trên card. */
export function toPlainText(dirty: string, maxLength?: number): string {
  const text = DOMPurify.sanitize(dirty ?? '', { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength === undefined || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}
