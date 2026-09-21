/**
 * Wrapper localStorage (§10.5, §15).
 *
 * Mọi truy cập đều bọc try/catch: Safari private mode và một số cấu hình trình duyệt
 * ném exception ngay khi đọc. Lưu trữ hỏng không được làm sập app (§2.2 nguyên tắc 4).
 */

import { WATCH_EPS_LIMIT, WATCH_INDEX_LIMIT, WATCH_PROGRESS_TTL_DAYS } from './constants';
import type { MovieType } from '@/types/movie';

const PREFIX = {
  watch: 'watch:',
  myList: 'my-list',
  settings: 'settings',
  /**
   * ⚠️ Cố ý KHÔNG đặt là `watch:index`.
   *
   * Mọi thứ quét theo tiền tố `watch:` — `rebuildIndex` bên dưới, và cả bản app
   * cũ còn đang mở ở tab khác — sẽ coi nó là một key tiến độ, thấy `updatedAt`
   * không hợp lệ rồi xoá sạch cả index.
   */
  watchIndex: 'watch-index',
  /**
   * Cờ bật/tắt cá nhân hoá — key RIÊNG, không nhét vào `settings` hay vào index.
   *
   * `CONTINUE_PROBE` phải đọc nó trước lượt vẽ đầu tiên, nơi mỗi byte đều nằm trên
   * đường găng: đọc một key vài byte khác hẳn với parse cả index 14 kB chỉ để biết
   * một cờ bật/tắt.
   */
  personalized: 'personalized',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Kết quả thăm dò storage, nhớ luôn cho cả phiên.
 *
 * Bản trước thăm dò lại ở MỖI lời gọi `readJson`/`writeJson` — mà thăm dò là một
 * cặp `setItem` + `removeItem` thật. Đọc tiến độ của 40 tập là 80 lượt ghi vô
 * ích. Quyền truy cập storage không đổi giữa phiên, nên hỏi một lần là đủ.
 */
let storageRef: Storage | null | undefined;

function safeStorage(): Storage | null {
  if (storageRef !== undefined) return storageRef;
  // KHÔNG nhớ ở nhánh này: cùng module còn chạy lại lần nữa ở phía client.
  if (typeof window === 'undefined') return null;

  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    storageRef = window.localStorage;
  } catch {
    storageRef = null;
  }
  return storageRef;
}

export function readJson<T>(key: string, fallback: T): T {
  const store = safeStorage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Hết quota — dọn tiến độ cũ rồi thử lại đúng một lần.
    pruneWatchProgress();
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

export function removeKey(key: string): void {
  try {
    safeStorage()?.removeItem(key);
  } catch {
    /* im lặng */
  }
}

/* ------------------------- §10.5 tiến độ xem ------------------------- */

export interface WatchProgress {
  position: number;
  duration: number;
  updatedAt: number;
}

export const watchKey = (slug: string, ep: string): string => `${PREFIX.watch}${slug}:${ep}`;

/**
 * Ảnh chụp đủ để VẼ một card "đang xem" mà không cần gọi API.
 *
 * Cùng lý do với `MyListEntry`: chỉ giữ field cần để render. Thiếu nó thì row
 * "Tiếp tục xem" phải gọi `/phim/{slug}` cho từng phim — mấy request nối tiếp ở
 * ngay trên màn hình đầu, đúng thứ §11.2 cấm.
 */
export interface WatchSnapshot {
  name: string;
  originName: string;
  poster: string;
  thumb: string;
  year: number;
  quality: string;
  episodeCurrent: string;
  /** `episode.name` thô của tập đang xem — nơi hiển thị tự chạy qua `episodeLabel`. */
  episodeName: string;
  /**
   * Ba field dưới đây KHÔNG để vẽ card, mà để tính sở thích (`lib/taste.ts`).
   *
   * Chúng phải nằm ở đây vì đây là lúc duy nhất biết được: index chỉ giữ slug, mà
   * tra ngược slug → thể loại là một lời gọi `/phim/{slug}` cho mỗi phim. Chép
   * mấy chuỗi slug vào lúc ghi thì trọng số sở thích tính được mà không chạm mạng.
   */
  type: MovieType;
  /** Slug thể loại, ví dụ `['hanh-dong', 'phieu-luu']`. */
  categories: string[];
  /** Slug quốc gia. */
  countries: string[];
}

/** `[position, duration, updatedAt]` — dạng tuple cho index đỡ phình. */
export type WatchTuple = [position: number, duration: number, updatedAt: number];

export interface WatchIndexEntry {
  slug: string;
  /** Tập xem gần nhất — cái mà "Tiếp tục xem" phải mở. */
  lastEp: string;
  /** CHỈ những tập đã có tiến độ, không phải toàn bộ tập của phim. */
  eps: Record<string, WatchTuple>;
  updatedAt: number;
  /**
   * Số tập đã xem hết (≥ 95%).
   *
   * Nếu không đếm, tín hiệu sở thích MẠNH NHẤT sẽ tự xoá chính nó: xem xong một
   * tập là key tiến độ của tập đó bị dọn (§10.5), nên xem hết một bộ 12 tập là bộ
   * đó biến mất sạch khỏi index — đúng những người xem nhiều nhất lại là những
   * người app không biết gì về sở thích. Entry ở lại với `eps` rỗng: nó không còn
   * là "đang xem" (`resumePoint` trả null) nhưng vẫn còn là "đã xem".
   */
  finished: number;
  snapshot: WatchSnapshot | null;
}

/**
 * Index tiến độ xem — MỘT key, đọc một lần rồi giữ trong RAM cho cả app.
 *
 * Vì sao phải có nó:
 *
 *   · bản trước dọn tiến độ bằng cách quét TOÀN BỘ localStorage (`store.length`
 *     + `JSON.parse` từng key) ngay trong `AppBootstrap`. Người xem 200 tập là
 *     200 lượt `getItem` + 200 lượt parse ĐỒNG BỘ trên main thread, đúng lúc
 *     đang tranh chỗ với LCP.
 *   · `EpisodePicker` đọc một key cho MỖI tập — bộ 40 tập là 40 lượt nữa, mỗi
 *     lần mở sidebar trang phát hoặc modal chi tiết.
 *
 * Index đổi cả hai thành một `getItem` + một `JSON.parse` cho cả phiên.
 *
 * Nó là CACHE, không phải nguồn sự thật: `watch:{slug}:{ep}` vẫn là bản ghi bền
 * của từng tập, và index dựng lại được từ chúng (`rebuildIndex`). Mất index thì
 * mất thứ tự "gần đây" và snapshot, KHÔNG mất vị trí đang xem của ai.
 */
const WATCH_INDEX_VERSION = 1;

interface WatchIndex {
  v: number;
  /** Mới nhất trước. */
  entries: WatchIndexEntry[];
}

let indexCache: WatchIndex | null = null;
let listeningAcrossTabs = false;

const emptyIndex = (): WatchIndex => ({ v: WATCH_INDEX_VERSION, entries: [] });

/**
 * Tab khác ghi index thì bản trong RAM ở tab này thành SAI — và lượt ghi kế tiếp
 * của tab này lấy bản cũ ghi đè lên, làm bay entry vừa thêm ở tab kia. Xem hai
 * tập song song trên hai tab là chuyện thường ở phim bộ.
 *
 * `storage` chỉ bắn ở những tab KHÁC tab vừa ghi, nên nghe nó rồi bỏ cache là đủ:
 * lượt đọc sau tự nạp lại. `key === null` là `localStorage.clear()`.
 */
function listenAcrossTabs(): void {
  if (listeningAcrossTabs || typeof window === 'undefined') return;
  listeningAcrossTabs = true;

  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === PREFIX.watchIndex) indexCache = null;
  });
}

/** Mới nhất trước — thứ tự này là ý nghĩa của index, không phải chi tiết hiển thị. */
const byRecency = (entries: WatchIndexEntry[]): WatchIndexEntry[] =>
  [...entries].sort((a, b) => b.updatedAt - a.updatedAt);

function isTuple(value: unknown): value is WatchTuple {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/**
 * Tập được xem gần nhất trong nhóm, kèm tuple của nó. `null` khi nhóm rỗng —
 * và nhóm rỗng luôn có nghĩa là "entry này phải rời index", nên nơi gọi buộc
 * phải xử lý trường hợp đó thay vì nhận về một chuỗi rỗng trông như hợp lệ.
 */
function newestEp(eps: Record<string, WatchTuple>): [ep: string, tuple: WatchTuple] | null {
  let best: [string, WatchTuple] | null = null;
  for (const pair of Object.entries(eps)) {
    if (!best || pair[1][2] > best[1][2]) best = pair;
  }
  return best;
}

const MOVIE_TYPES: readonly MovieType[] = ['single', 'series', 'hoathinh', 'tvshows'];

function sanitizeSnapshot(raw: unknown): WatchSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Partial<WatchSnapshot>;
  if (typeof s.name !== 'string' || s.name === '') return null;

  const str = (value: unknown): string => (typeof value === 'string' ? value : '');
  const slugs = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : [];

  return {
    name: s.name,
    originName: str(s.originName),
    poster: str(s.poster),
    thumb: str(s.thumb),
    year: typeof s.year === 'number' && Number.isFinite(s.year) ? s.year : 0,
    quality: str(s.quality),
    episodeCurrent: str(s.episodeCurrent),
    episodeName: str(s.episodeName),
    // Snapshot ghi trước khi có ba field này thì về mặc định, không phải bỏ cả entry.
    type: MOVIE_TYPES.includes(s.type as MovieType) ? (s.type as MovieType) : 'single',
    categories: slugs(s.categories),
    countries: slugs(s.countries),
  };
}

/**
 * Index là dữ liệu tự ghi ra, nhưng nó sống qua nhiều phiên bản app và nhiều
 * tab — một entry méo không được phép làm sập chỗ render. Entry nào không cứu
 * được thì bỏ đúng entry đó, chứ không bỏ cả index.
 */
function sanitizeEntry(raw: unknown): WatchIndexEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Partial<WatchIndexEntry>;
  if (typeof entry.slug !== 'string' || entry.slug === '') return null;

  const eps: Record<string, WatchTuple> = {};
  for (const [ep, tuple] of Object.entries(entry.eps ?? {})) {
    if (ep !== '' && isTuple(tuple)) eps[ep] = tuple;
  }

  const newest = newestEp(eps);
  const finished =
    typeof entry.finished === 'number' && entry.finished > 0 ? Math.floor(entry.finished) : 0;

  // Không còn tập dở dang mà cũng chưa xem xong tập nào thì entry hết nghĩa.
  if (!newest && finished === 0) return null;

  const updatedAt =
    typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
      ? entry.updatedAt
      : (newest?.[1][2] ?? 0);

  // Không biết entry này cũ tới đâu thì không dọn được — thà bỏ ngay.
  if (updatedAt === 0) return null;

  return {
    slug: entry.slug,
    lastEp:
      typeof entry.lastEp === 'string' && (eps[entry.lastEp] || !newest)
        ? entry.lastEp
        : (newest?.[0] ?? ''),
    eps,
    updatedAt,
    finished,
    snapshot: sanitizeSnapshot(entry.snapshot),
  };
}

/** Xoá mọi key `watch:` thuộc về entry này. Trả về số key đã xoá. */
function dropEntryKeys(entry: WatchIndexEntry): number {
  const eps = Object.keys(entry.eps);
  eps.forEach((ep) => removeKey(watchKey(entry.slug, ep)));
  return eps.length;
}

/**
 * Dựng lại index từ các key `watch:` rời rạc.
 *
 * Đây là lần quét toàn bộ localStorage DUY NHẤT còn lại, và nó chỉ chạy khi
 * index chưa có / hỏng / lệch version — tức là đúng một lần cho người đã dùng
 * app từ trước. Key cũ không mang theo snapshot nên entry dựng lại có
 * `snapshot: null`; chỗ nào cần thì tự bù khi người ta xem tiếp.
 */
function rebuildIndex(cutoff: number): WatchIndex {
  const store = safeStorage();
  if (!store) return emptyIndex();

  const bySlug = new Map<string, WatchIndexEntry>();
  const stale: string[] = [];

  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(PREFIX.watch)) continue;

      const rest = key.slice(PREFIX.watch.length);
      const cut = rest.lastIndexOf(':');
      const value = readJson<WatchProgress | null>(key, null);

      if (
        cut <= 0 ||
        value === null ||
        typeof value.position !== 'number' ||
        typeof value.duration !== 'number' ||
        typeof value.updatedAt !== 'number' ||
        value.updatedAt < cutoff
      ) {
        stale.push(key);
        continue;
      }

      const slug = rest.slice(0, cut);
      const ep = rest.slice(cut + 1);
      const entry = bySlug.get(slug) ?? {
        slug,
        lastEp: ep,
        eps: {},
        updatedAt: 0,
        // Key rời không mang số tập đã xem xong — nó chỉ tồn tại khi CHƯA xong.
        finished: 0,
        snapshot: null,
      };

      entry.eps[ep] = [value.position, value.duration, value.updatedAt];
      if (value.updatedAt >= entry.updatedAt) {
        entry.updatedAt = value.updatedAt;
        entry.lastEp = ep;
      }
      bySlug.set(slug, entry);
    }
  } catch {
    /* quét dở thì dùng phần đã gom được — vẫn hơn là không có index nào */
  }

  stale.forEach(removeKey);

  const sorted = byRecency([...bySlug.values()]);
  // Quá trần thì bỏ luôn key của phim bị loại, đừng để lại key mồ côi không ai dọn.
  sorted.slice(WATCH_INDEX_LIMIT).forEach(dropEntryKeys);

  return { v: WATCH_INDEX_VERSION, entries: sorted.slice(0, WATCH_INDEX_LIMIT) };
}

function writeIndex(index: WatchIndex): void {
  if (!safeStorage()) return;
  indexCache = index;

  /**
   * Ghi trượt (hết quota) thì RAM không được phép tin là đã ghi: bỏ cache để lượt
   * đọc sau nạp lại đúng thứ đang có trong storage. Cache "lạc quan" ở đây nghĩa
   * là index nhớ một phim mà storage không có, và key `watch:` của phim đó thành
   * mồ côi — không entry nào trỏ tới để mà dọn.
   */
  if (!writeJson(PREFIX.watchIndex, index)) indexCache = null;
}

function readIndex(): WatchIndex {
  // Storage không dùng được thì không có gì để đọc, mà cũng không có gì để nhớ.
  if (!safeStorage()) return emptyIndex();

  listenAcrossTabs();
  if (indexCache) return indexCache;

  const raw = readJson<Partial<WatchIndex> | null>(PREFIX.watchIndex, null);

  if (raw && raw.v === WATCH_INDEX_VERSION && Array.isArray(raw.entries)) {
    const index: WatchIndex = {
      v: WATCH_INDEX_VERSION,
      entries: byRecency(
        raw.entries.map(sanitizeEntry).filter((e): e is WatchIndexEntry => e !== null),
      ),
    };
    indexCache = index;
    return index;
  }

  // Chưa có index (hoặc lệch version / hỏng) → gom key cũ rồi GHI LẠI ngay, để
  // lần khởi động sau không phải quét nữa.
  const rebuilt = rebuildIndex(Date.now() - WATCH_PROGRESS_TTL_DAYS * DAY_MS);
  writeIndex(rebuilt);
  return rebuilt;
}

/**
 * Giữ `WATCH_EPS_LIMIT` tập mới nhất, xoá key của những tập bị cắt. Trả về một
 * record MỚI, không sửa cái được truyền vào — xem chú thích ở `upsertIndex`.
 */
function capEps(slug: string, eps: Record<string, WatchTuple>): Record<string, WatchTuple> {
  const sorted = Object.entries(eps).sort((a, b) => b[1][2] - a[1][2]);
  if (sorted.length <= WATCH_EPS_LIMIT) return eps;

  sorted.slice(WATCH_EPS_LIMIT).forEach(([ep]) => removeKey(watchKey(slug, ep)));
  return Object.fromEntries(sorted.slice(0, WATCH_EPS_LIMIT));
}

function upsertIndex(slug: string, ep: string, tuple: WatchTuple, snapshot?: WatchSnapshot): void {
  const index = readIndex();
  const current = index.entries.find((e) => e.slug === slug);

  /**
   * Entry MỚI chứ không sửa tại chỗ.
   *
   * `readWatchIndex()` trả ra đúng những object đang nằm trong cache, và nơi gọi
   * là React (row "Tiếp tục xem" giữ chúng trong state, so sánh bằng tham chiếu).
   * Sửa tại chỗ thì nội dung đổi mà tham chiếu không đổi: màn hình giữ nguyên số
   * cũ, hoặc đổi lặng lẽ ở một lượt render sau vì lý do không liên quan.
   *
   * `snapshot` không có thì GIỮ cái cũ: xem tiếp tập 2 vẫn còn poster đã lưu từ
   * tập 1, và entry dựng lại từ key cũ (`snapshot: null`) được bù ngay lượt ghi
   * đầu tiên từ trang phát.
   */
  putEntry(index, {
    slug,
    lastEp: ep,
    eps: capEps(slug, { ...current?.eps, [ep]: tuple }),
    updatedAt: tuple[2],
    finished: current?.finished ?? 0,
    snapshot: sanitizeSnapshot(snapshot) ?? current?.snapshot ?? null,
  });
}

/** Đưa entry lên đầu index, cắt phần quá trần và dọn key của những phim bị loại. */
function putEntry(index: WatchIndex, entry: WatchIndexEntry): void {
  const ordered = [entry, ...index.entries.filter((e) => e.slug !== entry.slug)];
  ordered.slice(WATCH_INDEX_LIMIT).forEach(dropEntryKeys);

  writeIndex({ v: WATCH_INDEX_VERSION, entries: ordered.slice(0, WATCH_INDEX_LIMIT) });
}

/**
 * Xem xong một tập (≥ 95%, §10.5).
 *
 * Khác `clearWatchProgress` ("Xem từ đầu") ở đúng một điểm, nhưng là điểm quyết
 * định: ở đây tập được ĐÁNH DẤU đã xong, còn ở kia người dùng vừa nói là chưa.
 * Bản trước gộp cả hai vào một lời gọi nên mọi lần xem xong đều xoá sạch dấu vết
 * — xem chú thích của `WatchIndexEntry.finished`.
 */
export function markCompleted(slug: string, ep: string, snapshot?: WatchSnapshot): void {
  removeKey(watchKey(slug, ep));

  const index = readIndex();
  const current = index.entries.find((e) => e.slug === slug);

  const eps = { ...current?.eps };
  delete eps[ep];

  putEntry(index, {
    slug,
    lastEp: newestEp(eps)?.[0] ?? ep,
    eps,
    updatedAt: Date.now(),
    finished: (current?.finished ?? 0) + 1,
    snapshot: sanitizeSnapshot(snapshot) ?? current?.snapshot ?? null,
  });
}

export function getWatchProgress(slug: string, ep: string): WatchProgress | null {
  /**
   * Đọc key rời TRƯỚC index, cố ý: trình phát chỉ hỏi về MỘT tập nên đây là một
   * lượt đọc chứ không phải N; và key rời là bản ghi bền, nên nó vẫn đúng khi
   * index trong RAM đã cũ vì một tab khác vừa ghi. Index chỉ đỡ những lượt đọc
   * HÀNG LOẠT (`getMovieProgress`).
   */
  const value = readJson<WatchProgress | null>(watchKey(slug, ep), null);
  if (value && typeof value.position === 'number' && typeof value.duration === 'number') {
    return value;
  }

  const tuple = readIndex().entries.find((e) => e.slug === slug)?.eps[ep];
  return tuple ? { position: tuple[0], duration: tuple[1], updatedAt: tuple[2] } : null;
}

/**
 * Tỉ lệ đã xem của từng tập trong MỘT phim — `{ 'tap-01': 0.42 }`.
 *
 * Một lời gọi cho cả danh sách tập, thay cho vòng lặp `getWatchProgress` từng
 * tập của `EpisodePicker`: bộ 40 tập từ 40 lượt đọc localStorage xuống 0 (index
 * đã nằm trong RAM sau lượt đọc đầu của phiên).
 */
export function getMovieProgress(slug: string): Record<string, number> {
  const entry = readIndex().entries.find((e) => e.slug === slug);
  if (!entry) return {};

  const ratios: Record<string, number> = {};
  for (const [ep, [position, duration]] of Object.entries(entry.eps)) {
    if (duration > 0) ratios[ep] = Math.min(1, position / duration);
  }
  return ratios;
}

/**
 * Danh sách phim đang xem, mới nhất trước — nguồn cho row "Tiếp tục xem".
 *
 * Trả mảng copy: nơi gọi `sort`/`splice` trên kết quả sẽ đảo luôn cache trong RAM
 * nếu trả thẳng mảng gốc.
 */
export function readWatchIndex(): WatchIndexEntry[] {
  return [...readIndex().entries];
}

export function setWatchProgress(
  slug: string,
  ep: string,
  position: number,
  duration: number,
  /**
   * Chỉ nơi đang có dữ liệu phim mới truyền được — trang phát. Bỏ trống thì entry
   * giữ snapshot cũ (nếu có) và tiến độ vẫn được ghi bình thường.
   */
  snapshot?: WatchSnapshot,
): void {
  const updatedAt = Date.now();
  writeJson(watchKey(slug, ep), { position, duration, updatedAt } satisfies WatchProgress);
  upsertIndex(slug, ep, [position, duration, updatedAt], snapshot);
}

export function clearWatchProgress(slug: string, ep: string): void {
  removeKey(watchKey(slug, ep));

  const index = readIndex();
  const entry = index.entries.find((e) => e.slug === slug);
  if (!entry?.eps[ep]) return;

  const eps = { ...entry.eps };
  delete eps[ep];

  const newest = newestEp(eps);

  /**
   * Hết tập dở dang thì phim rời "đang xem" — nhưng CHỈ rời index khi nó cũng
   * chưa xem xong tập nào. Xoá một entry có `finished` là xoá luôn tín hiệu sở
   * thích của cả bộ phim, chỉ vì người dùng bấm "Xem từ đầu" ở tập cuối.
   */
  if (!newest && entry.finished === 0) {
    writeIndex({ v: WATCH_INDEX_VERSION, entries: index.entries.filter((e) => e.slug !== slug) });
    return;
  }

  const entries = index.entries.map((e) =>
    e.slug === slug
      ? {
          ...e,
          eps,
          lastEp: newest?.[0] ?? e.lastEp,
          updatedAt: newest?.[1][2] ?? e.updatedAt,
        }
      : e,
  );

  writeIndex({ v: WATCH_INDEX_VERSION, entries: byRecency(entries) });
}

/**
 * Gỡ hẳn một phim khỏi "đang xem": xoá entry và mọi key tập của nó.
 *
 * Người xem phải gỡ được thứ họ không muốn thấy nữa — máy dùng chung trong gia
 * đình là chuyện thường, và một phim bỏ giữa chừng không có nghĩa là muốn bị hỏi
 * lại mãi. Đây là hành động một chiều, khác `clearWatchProgress` (một tập).
 */
export function forgetMovie(slug: string): void {
  const index = readIndex();
  const entry = index.entries.find((e) => e.slug === slug);
  if (!entry) return;

  dropEntryKeys(entry);
  writeIndex({ v: WATCH_INDEX_VERSION, entries: index.entries.filter((e) => e.slug !== slug) });
}

/**
 * `writeJson` gọi `pruneWatchProgress` khi hết quota, mà `writeIndex` lại đi qua
 * `writeJson` — thiếu cờ này thì một lần hết quota là đệ quy không đáy.
 */
let pruning = false;

/**
 * Dọn tiến độ cũ hơn 90 ngày và cắt index về trần — gọi một lần khi khởi động
 * app (§10.5). Trả về số key `watch:` đã xoá.
 *
 * KHÔNG còn quét localStorage: đọc index (tự dựng lại nếu chưa có), loại tập hết
 * hạn và phim quá trần, rồi xoá đúng những key thuộc về chúng.
 */
export function pruneWatchProgress(ttlDays: number = WATCH_PROGRESS_TTL_DAYS): number {
  if (pruning) return 0;
  pruning = true;

  try {
    const cutoff = Date.now() - ttlDays * DAY_MS;
    const index = readIndex();

    const kept: WatchIndexEntry[] = [];
    let removed = 0;

    for (const entry of byRecency(index.entries)) {
      const fresh: Record<string, WatchTuple> = {};

      for (const [ep, tuple] of Object.entries(entry.eps)) {
        if (tuple[2] >= cutoff) {
          fresh[ep] = tuple;
        } else {
          removeKey(watchKey(entry.slug, ep));
          removed++;
        }
      }

      const newest = newestEp(fresh);
      /**
       * Entry đã xem xong (không còn tập dở) vẫn được ở lại cho tới khi CHÍNH NÓ
       * quá hạn: nó không còn giá trị cho "Tiếp tục xem" nhưng vẫn là tín hiệu sở
       * thích (`lib/taste.ts`). Mốc hết hạn của nó là `updatedAt`, không phải các
       * key tập đã bị dọn từ lâu.
       */
      const alive = newest !== null || (entry.finished > 0 && entry.updatedAt >= cutoff);

      if (!alive || kept.length >= WATCH_INDEX_LIMIT) {
        removed += dropEntryKeys({ ...entry, eps: fresh });
        continue;
      }

      kept.push({
        ...entry,
        eps: fresh,
        lastEp: newest?.[0] ?? entry.lastEp,
        updatedAt: newest?.[1][2] ?? entry.updatedAt,
      });
    }

    /**
     * Sắp lại: `updatedAt` của một entry có thể TỤT khi đúng tập mới nhất của nó
     * là tập hết hạn, nên thứ tự "mới nhất trước" mà cả index dựa vào không còn
     * đúng sau vòng lặp trên.
     */
    writeIndex({ v: WATCH_INDEX_VERSION, entries: byRecency(kept) });
    return removed;
  } finally {
    pruning = false;
  }
}

export const STORAGE_KEYS = PREFIX;

/* ------------------------- tuỳ chọn trình phát ------------------------- */

/**
 * Người xem phim bộ mở lại trình phát hàng chục lần một tuần. Bắt họ chỉnh lại
 * âm lượng / chất lượng mỗi tập là lỗi trải nghiệm, không phải tính năng thiếu.
 */
export interface PlayerSettings {
  volume: number;
  muted: boolean;
  rate: number;
  /** Chiều cao video ưa thích (480, 720…). 0 = tự động theo mạng. */
  qualityHeight: number;
}

const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 1,
  muted: false,
  rate: 1,
  qualityHeight: 0,
};

export function getPlayerSettings(): PlayerSettings {
  const raw = readJson<Partial<PlayerSettings>>(PREFIX.settings, {});
  return {
    volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : 1,
    muted: typeof raw.muted === 'boolean' ? raw.muted : false,
    rate: typeof raw.rate === 'number' && raw.rate > 0 ? raw.rate : 1,
    qualityHeight: typeof raw.qualityHeight === 'number' ? raw.qualityHeight : 0,
  };
}

export function savePlayerSettings(patch: Partial<PlayerSettings>): void {
  writeJson(PREFIX.settings, { ...getPlayerSettings(), ...patch } satisfies PlayerSettings);
}

/* ------------------------- tuỳ chọn cá nhân hoá ------------------------- */

/**
 * Cá nhân hoá đang bật hay không. Chưa có key nghĩa là BẬT.
 *
 * Mặc định bật vì đây là thứ chỉ chạy trên máy người xem và không có gì rời khỏi
 * máy; còn tắt được là bắt buộc vì máy dùng chung trong gia đình là chuyện thường —
 * row "Tiếp tục xem" giữa trang chủ kể cho cả nhà biết tối qua ai xem gì.
 *
 * Nó KHÔNG tắt việc lưu tiến độ: trình phát vẫn nhớ chỗ đang xem của từng tập
 * (§10.5). Tắt là không đem lịch sử đó ra các mặt DẠO — trang chủ và card.
 */
export function getPersonalized(): boolean {
  return readJson<boolean>(PREFIX.personalized, true) !== false;
}

export function setPersonalized(value: boolean): void {
  writeJson(PREFIX.personalized, value);
}

export { DEFAULT_PLAYER_SETTINGS };
