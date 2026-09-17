/**
 * Helper dẫn xuất từ model đã chuẩn hoá (§5.3).
 * Không gọi mạng, không chạm raw response — thuần tính toán, dễ test.
 */

import type { Movie, RatingSource } from '@/types/movie';
import { FIRST_EPISODE, routes } from '@/lib/routes';

/** Giữ lại để không phá các import cũ; định nghĩa thật nằm ở `lib/routes.ts`. */
export { FIRST_EPISODE };

/**
 * Một nguồn chỉ dùng được khi có CẢ lượt vote lẫn điểm.
 *
 * Dữ liệu thật có nhiều phim `vote_count > 0` nhưng `vote_average = 0`
 * (KKPhim lưu id IMDb kèm số vote nhưng chưa đồng bộ điểm) — coi là không có dữ liệu.
 */
function isUsable(src: RatingSource): boolean {
  return src.vote_count > 0 && src.vote_average > 0;
}

/**
 * Nguồn rating đáng tin nhất, hoặc `null` nếu không nguồn nào dùng được.
 *
 * ⚠️ Sai lệch có chủ đích so với §5.3: tài liệu chỉ so `vote_count`, nhưng làm vậy
 * sẽ chọn nhầm nguồn rỗng. Ví dụ thật "Vạn Giới Độc Tôn":
 * imdb `{avg: 0, count: 10}` và tmdb `{avg: 9.5, count: 4}` — quy tắc gốc chọn imdb
 * rồi hiện "0% phù hợp", đúng thứ §17 rủi ro #7 muốn tránh.
 * Ở đây lọc nguồn dùng được TRƯỚC, rồi mới so lượt vote.
 */
export function bestRatingSource(m: Movie): RatingSource | null {
  const usable = [m.imdb, m.tmdb].filter(isUsable);
  if (usable.length === 0) return null;
  return usable.reduce((best, src) => (src.vote_count > best.vote_count ? src : best));
}

/**
 * Chuyển `vote_average` → "% phù hợp".
 * Trả `null` khi không đủ dữ liệu — UI PHẢI ẩn badge, KHÔNG được hiện 0%
 * (§5.3, §8.4, §17 rủi ro #7).
 */
export function matchScore(m: Movie): number | null {
  const src = bestRatingSource(m);
  if (!src) return null;
  return Math.round(src.vote_average * 10);
}

export type EpisodeBadge =
  | { kind: 'completed'; total: number }
  | { kind: 'ongoing'; current: number }
  | { kind: 'full' }
  /**
   * Mở rộng so với §5.3: `episode_current` ngoài thực tế còn có giá trị như
   * "Trailer", "Tập 5-6", "Đang cập nhật". Giữ nguyên chuỗi gốc để UI hiển thị
   * thay vì đoán sai — đúng tinh thần "fail mềm" (§2.2 nguyên tắc 4).
   */
  | { kind: 'unknown'; label: string };

/** Parse "Hoàn Tất (24/24)" | "Tập 33" | "Full" → badge có cấu trúc (§5.3). */
export function parseEpisodeBadge(raw: string): EpisodeBadge {
  const text = raw?.trim() ?? '';
  if (text === '') return { kind: 'unknown', label: '' };

  // "Hoàn Tất (24/24)" — lấy mẫu số làm tổng số tập.
  const completed = /ho[àa]n\s*t[ấa]t/i.test(text) ? /\((\d+)\s*\/\s*(\d+)\)/.exec(text) : null;
  if (completed?.[2]) return { kind: 'completed', total: Number(completed[2]) };

  // "Full" | "Full HD" | "FULL"
  if (/^full\b/i.test(text)) return { kind: 'full' };

  // "Tập 33" | "Tập 33 VietSub" — lấy số tập đầu tiên.
  const ongoing = /t[ậa]p\s*(\d+)/i.exec(text);
  if (ongoing?.[1]) return { kind: 'ongoing', current: Number(ongoing[1]) };

  return { kind: 'unknown', label: text };
}

/** Nhãn ngắn hiển thị trên card (§8.4). Trả chuỗi rỗng khi không có gì để nói. */
export function episodeBadgeLabel(badge: EpisodeBadge): string {
  switch (badge.kind) {
    case 'completed':
      return `Trọn bộ ${badge.total} tập`;
    case 'ongoing':
      return `Tập ${badge.current}`;
    case 'full':
      return 'Bản đầy đủ';
    case 'unknown':
      return badge.label;
  }
}

/** Phim bộ hay phim lẻ — quyết định UI hiện grid chọn tập hay không. */
export function isSeries(m: Pick<Movie, 'type'>): boolean {
  return m.type === 'series' || m.type === 'tvshows' || m.type === 'hoathinh';
}

/** §8.2 — meta row: `year · quality · duration · lang · episodeCurrent`. */
export function metaLine(m: Movie): string {
  return [m.year > 0 ? String(m.year) : '', m.quality, m.duration, m.lang, m.episodeCurrent]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ');
}

/** `status` từ API là chuỗi tiếng Anh — đổi sang nhãn tiếng Việt cho UI. */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ongoing: 'Đang chiếu',
    completed: 'Đã hoàn thành',
    trailer: 'Sắp chiếu',
    canceled: 'Đã huỷ',
  };
  return map[status?.trim().toLowerCase()] ?? status;
}

/**
 * Nhãn hiển thị cho một tập.
 *
 * ⚠️ §5.1 ghi `EpisodeItem.name` là `"1"`, nhưng API thật trả `"Tập 01"`.
 * Ghép thêm tiền tố sẽ ra "Tập Tập 01", nên phải kiểm tra trước.
 */
export function episodeLabel(name: string): string {
  const text = name?.trim() ?? '';
  if (text === '') return '';
  return /^t[ậa]p(\s|$)/i.test(text) ? text : `Tập ${text}`;
}

/**
 * Đường dẫn xem một tập (§8.2).
 *
 * ⚠️ §8.2 ghi nút Play trỏ tới `/xem/{slug}/1`, nhưng slug tập thật là `"tap-01"`.
 * Nơi nào đã có danh sách tập thì truyền `episodeSlug` để link đúng ngay;
 * nơi chưa có (hero, card) dùng sentinel `1` và trang phát tự phân giải về tập đầu.
 */
export function firstEpisodeHref(slug: string, episodeSlug?: string): string {
  return routes.watch(slug, episodeSlug);
}

/**
 * Phân giải tham số `ep` trên URL về đúng một tập:
 * khớp slug → khớp số thứ tự 1-based → rơi về tập đầu.
 */
export function resolveEpisode<T extends { slug: string; name: string }>(
  list: readonly T[],
  epParam: string,
): T | undefined {
  if (list.length === 0) return undefined;

  const bySlug = list.find((e) => e.slug === epParam);
  if (bySlug) return bySlug;

  const index = Number.parseInt(epParam, 10);
  if (Number.isFinite(index) && index >= 1 && index <= list.length) return list[index - 1];

  return list[0];
}

/** Trích video id từ link YouTube trong `trailerUrl`; `null` nếu không nhận ra. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const match = re.exec(url);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** mm:ss hoặc h:mm:ss — dùng cho progress bar và prompt "Tiếp tục xem" (§10.5). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}
