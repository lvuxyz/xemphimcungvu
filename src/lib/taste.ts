/**
 * Trọng số sở thích, suy ra từ index tiến độ xem.
 *
 * KHÔNG có key `profile` riêng, cố ý: profile tích luỹ dần (mỗi tín hiệu cộng một
 * ít) thì phải tự chống cộng trùng, và một lần cộng sai là sai vĩnh viễn — không
 * có đường nào tính lại. Suy ra từ index thì hàm này thuần, tính lại lúc nào cũng
 * ra cùng kết quả, và phân rã theo thời gian là miễn phí vì `updatedAt` đã có sẵn.
 *
 * Toàn bộ dữ liệu vào nằm trên máy người xem (`lib/storage.ts`) và không có gì đi
 * ra ngoài: không endpoint, không id, không ai ở phía server biết gì về nó.
 */

import type { MovieType } from '@/types/movie';
import type { TypeList } from '@/types/filters';
import type { ListSource } from './list-source';
import { routes } from './routes';
import type { WatchIndexEntry } from './storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sở thích nhạt dần: 0.97 mỗi tuần, tức còn ~68% sau 3 tháng.
 *
 * Không cần thêm TTL riêng — cái gì cũ thì tự chìm xuống dưới cái vừa xem, mà vẫn
 * không bị xoá hẳn (một bộ xem hết từ tháng trước vẫn nói được điều gì đó).
 */
const DECAY_PER_WEEK = 0.97;

/**
 * Nhóm càng rộng thì càng nói được ít về sở thích, nên trọng số càng thấp.
 *
 * Không có hai hệ số này thì `type` — vỏn vẹn 4 giá trị, và MỌI phim đều thuộc
 * đúng một cái — gom hết điểm rồi luôn đứng đầu: người xem phim bộ nào cũng thấy
 * "Phim bộ" ở trên, tức là trang chủ không cá nhân hoá gì cả. Thang này đặt cái cụ
 * thể (thể loại) lên trước cái chung.
 */
const COUNTRY_FACTOR = 0.8;
const TYPE_FACTOR = 0.5;

/** Trần số tập đã xem xong còn được tính. Hết 40 tập không "thích" gấp 10 lần hết 4 tập. */
const FINISHED_CAP = 5;

/**
 * Sức nặng của một phim trong "Danh sách của tôi".
 *
 * Đặt trên mức "đã mở xem" (1) và dưới mọi mức có thời gian xem thật: lưu một phim là
 * một lời nói RÕ về sở thích — rõ hơn việc bấm vào xem thử — nhưng ý định vẫn là bằng
 * chứng yếu hơn thời gian đã bỏ ra. Đây cũng là tín hiệu duy nhất có được với người
 * mới: lưu vài phim rồi chưa xem gì thì trang chủ vẫn nói được điều gì đó về họ.
 */
const LIST_WEIGHT = 1.2;

/**
 * Chỉ tính N phim lưu gần nhất.
 *
 * Danh sách của tôi không có trần, mà 80 phim lưu từ năm ngoái × 1.2 thì dìm hẳn vài
 * bộ vừa xem tuần này — phân rã theo tuần đỡ được phần nào nhưng không đỡ hết khi số
 * lượng chênh nhau quá xa.
 */
const LIST_CAP = 20;

/**
 * Phim trong "Danh sách của tôi", ở dạng `lib/taste.ts` cần.
 *
 * Khai lại tại đây thay vì import `MyListEntry`: `lib/` không được phụ thuộc vào
 * `store/` (§2.1 — tầng dưới không biết gì về tầng trên). `MyListEntry` khớp cấu trúc
 * này nên nơi gọi truyền thẳng vào được.
 *
 * Ba field taxonomy để TUỲ CHỌN vì entry lưu từ trước bản này không có chúng —
 * "không biết" là một trạng thái thật, và bịa ra một giá trị mặc định thì mọi phim cũ
 * thành phiếu bầu cho cùng một thứ.
 */
export interface ListedMovie {
  type?: MovieType;
  categories?: string[];
  countries?: string[];
  /** ms — để phim lưu lâu rồi cũng nhạt dần như phim xem lâu rồi. */
  addedAt: number;
}

/**
 * `Movie.type` (đã chuẩn hoá) → `type_list` của endpoint danh sách.
 *
 * Hai thang tên khác nhau cho cùng một thứ: §5.1 dùng `series`/`single`, còn §3.1
 * dùng `phim-bo`/`phim-le`. Row trang chủ khai theo thang thứ hai.
 */
const TYPE_LIST_OF: Record<MovieType, TypeList> = {
  series: 'phim-bo',
  single: 'phim-le',
  hoathinh: 'hoat-hinh',
  tvshows: 'tv-shows',
};

/**
 * Khoá trọng số — `"category:hanh-dong"`, `"country:han-quoc"`, `"type:phim-bo"`.
 *
 * Có tiền tố nhóm vì slug giữa các nhóm KHÔNG đảm bảo khác nhau: API có cả thể
 * loại và quốc gia, chỉ cần một slug trùng là hai sở thích khác hẳn nhau cộng dồn
 * vào một chỗ.
 */
export type TasteKey = string;

const categoryKey = (slug: string): TasteKey => `category:${slug}`;
const countryKey = (slug: string): TasteKey => `country:${slug}`;
const typeKey = (type: TypeList | string): TasteKey => `type:${type}`;

/** Khoá trọng số của một nguồn danh sách, `null` nếu nguồn không mang sở thích nào. */
export function sourceTasteKey(source: ListSource): TasteKey | null {
  switch (source.kind) {
    case 'category':
      return categoryKey(source.slug);
    case 'country':
      return countryKey(source.slug);
    case 'type':
      return typeKey(source.type);
    // "Mới cập nhật", "tất cả", theo năm, tìm kiếm — không nói gì về sở thích.
    default:
      return null;
  }
}

/** Tỉ lệ xem sâu nhất trong các tập của một phim (0..1). */
function deepestRatio(entry: WatchIndexEntry): number {
  let best = 0;
  for (const [position, duration] of Object.values(entry.eps)) {
    if (duration > 0) best = Math.max(best, Math.min(1, position / duration));
  }
  return best;
}

/**
 * Sức nặng của một phim trong hồ sơ sở thích.
 *
 *   1            đã mở xem — chỉ riêng việc này đã là một lựa chọn
 *   + tối đa 2   số tập xem xong (tín hiệu mạnh nhất: xem hết là thích thật)
 *   + tối đa 1   xem sâu tới đâu trong tập đang dở
 *   × phân rã    theo số tuần kể từ lần xem gần nhất
 */
export function entryWeight(entry: WatchIndexEntry, now: number): number {
  const base =
    1 + (Math.min(entry.finished, FINISHED_CAP) / FINISHED_CAP) * 2 + deepestRatio(entry);

  return base * decay(entry.updatedAt, now);
}

/** Hệ số nhạt dần theo số tuần kể từ `at`. */
function decay(at: number, now: number): number {
  return DECAY_PER_WEEK ** Math.max(0, (now - at) / WEEK_MS);
}

export interface TasteInput {
  /** Phim trong "Danh sách của tôi" — tín hiệu thứ hai, xem `LIST_WEIGHT`. */
  listed?: readonly ListedMovie[];
  now?: number;
}

/**
 * Bảng trọng số cho toàn bộ index.
 *
 * O(số phim × số thể loại mỗi phim) — trần 30 phim, mỗi phim vài slug, nên chỉ vài
 * trăm phép cộng. Đủ rẻ để gọi thẳng trong lúc render, không cần worker hay idle.
 */
export function tasteScores(
  entries: readonly WatchIndexEntry[],
  { listed = [], now = Date.now() }: TasteInput = {},
): Map<TasteKey, number> {
  const scores = new Map<TasteKey, number>();
  const add = (key: TasteKey, value: number) => scores.set(key, (scores.get(key) ?? 0) + value);

  /** Một phim đóng góp cho ba nhóm, cùng một sức nặng nhưng khác hệ số nhóm. */
  const spread = (
    weight: number,
    type: MovieType | undefined,
    categories: readonly string[],
    countries: readonly string[],
  ) => {
    if (type) add(typeKey(TYPE_LIST_OF[type]), weight * TYPE_FACTOR);
    for (const slug of categories) add(categoryKey(slug), weight);
    for (const slug of countries) add(countryKey(slug), weight * COUNTRY_FACTOR);
  };

  for (const entry of entries) {
    // Entry dựng lại từ key cũ không có snapshot thì không đóng góp được gì; snapshot
    // ghi trước khi có ba field taxonomy thì chỉ còn những field nó thật sự có.
    if (!entry.snapshot) continue;

    const { type, categories, countries } = entry.snapshot;
    spread(entryWeight(entry, now), type, categories, countries);
  }

  for (const item of [...listed].sort((a, b) => b.addedAt - a.addedAt).slice(0, LIST_CAP)) {
    spread(
      LIST_WEIGHT * decay(item.addedAt, now),
      item.type,
      item.categories ?? [],
      item.countries ?? [],
    );
  }

  return scores;
}

export interface TasteRow {
  /** Định danh ổn định, KHÔNG đổi khi row được đặt lại tên hay đổi nguồn. */
  id: string;
  title: string;
  source: ListSource;
  href: string;
}

/**
 * Phim tiêu biểu cho một thể loại — cái tên đi vào "Vì bạn đã xem …".
 *
 * Chọn phim có sức nặng lớn nhất trong thể loại đó, không phải phim mới nhất: câu
 * "Vì bạn đã xem X" chỉ đứng vững khi X là thứ người ta thật sự đã xem, không phải
 * thứ họ mở 30 giây rồi tắt.
 */
function championOf(
  entries: readonly WatchIndexEntry[],
  categorySlug: string,
  now: number,
): WatchIndexEntry | null {
  let best: WatchIndexEntry | null = null;
  let bestWeight = 0;

  for (const entry of entries) {
    if (!entry.snapshot?.categories.includes(categorySlug)) continue;

    const weight = entryWeight(entry, now);
    if (weight > bestWeight) {
      best = entry;
      bestWeight = weight;
    }
  }

  return best;
}

/**
 * Thể loại được yêu thích nhất, kèm phim tiêu biểu.
 *
 * Bằng điểm thì ƯU TIÊN thể loại đã có row trên trang. Một phim thường mang 3–4
 * thể loại và tất cả nhận cùng trọng số, nên chuyện bằng điểm là thường xuyên chứ
 * không phải hiếm — mà chọn nhầm nhánh thì trả giá hai lần: một row thể loại bị
 * thay mất, và trang có hai row cùng nội dung (`hoat-hinh` vừa là slug thể loại
 * vừa là `type_list`, nên "Vì bạn đã xem X" đứng ngay cạnh "Hoạt hình" với gần
 * đúng danh sách phim đó).
 */
function topCategory(
  entries: readonly WatchIndexEntry[],
  scores: Map<TasteKey, number>,
  rows: readonly TasteRow[],
  now: number,
): { slug: string; movie: WatchIndexEntry } | null {
  const ranked = [...scores.entries()]
    .filter(([key, score]) => key.startsWith('category:') && score > 0)
    .map(([key, score]) => ({ slug: key.slice('category:'.length), score }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return null;

  // Bằng điểm: đưa thể loại đã có row lên trước, trong cùng nhóm cùng điểm.
  const preferred = [
    ...ranked.filter(
      (item) =>
        item.score === best.score &&
        rows.some((row) => row.source.kind === 'category' && row.source.slug === item.slug),
    ),
    ...ranked,
  ];

  /**
   * Đi tiếp khi thể loại đứng đầu không có phim ĐÃ XEM nào đại diện.
   *
   * Xảy ra thật từ khi "Danh sách của tôi" cũng góp điểm: thể loại đứng đầu có thể
   * hoàn toàn đến từ phim đã lưu mà chưa xem, và "Vì bạn đã xem X" thì buộc phải nói
   * về một phim đã xem. Không đi tiếp thì cả dòng tiêu đề đó lặng lẽ biến mất.
   */
  for (const item of preferred) {
    const movie = championOf(entries, item.slug, now);
    if (movie) return { slug: item.slug, movie };
  }

  return null;
}

/**
 * Sắp lại các row của trang chủ theo sở thích, và đặt lại tên đúng MỘT row thành
 * "Vì bạn đã xem …".
 *
 * Hai điều kiện thiết kế, cả hai đều là để không gây layout shift:
 *
 *   · SỐ ROW KHÔNG ĐỔI. Row "Vì bạn đã xem X" chiếm chỗ của một row thể loại có
 *     sẵn (chính nó nếu thể loại đó đã có row, nếu không thì row thể loại yếu
 *     nhất) chứ không chèn thêm. Thêm một row là trang cao lên một khoảng vào
 *     đúng lúc hydrate.
 *   · Sắp lại thì an toàn vì mọi row lazy lúc đó đều đang là khung chờ CÙNG chiều
 *     cao — đảo chỗ chúng không dịch một pixel nào, chỉ đổi chữ ở tiêu đề.
 *
 * Không có dữ liệu thì trả về ĐÚNG mảng đầu vào: lượt render đầu ở client phải
 * khớp HTML từ server (§13).
 */
export function personalizeRows<T extends TasteRow>(
  rows: readonly T[],
  entries: readonly WatchIndexEntry[],
  { listed = [], now = Date.now() }: TasteInput = {},
): readonly T[] {
  if (entries.length === 0 && listed.length === 0) return rows;

  const scores = tasteScores(entries, { listed, now });
  if (scores.size === 0) return rows;

  const top = topCategory(entries, scores, rows, now);
  let result: T[] = [...rows];

  if (top) {
    const title = `Vì bạn đã xem ${top.movie.snapshot?.name ?? ''}`.trim();
    const existing = result.findIndex(
      (row) => row.source.kind === 'category' && row.source.slug === top.slug,
    );

    if (existing >= 0) {
      const row = result[existing] as T;
      result[existing] = { ...row, title };
    } else {
      // Thể loại đó chưa có row → lấy chỗ của row thể loại yếu nhất.
      let weakest = -1;
      let weakestScore = Infinity;
      result.forEach((row, index) => {
        if (row.source.kind !== 'category') return;
        const score = scores.get(sourceTasteKey(row.source) ?? '') ?? 0;
        if (score < weakestScore) {
          weakest = index;
          weakestScore = score;
        }
      });

      if (weakest >= 0) {
        const row = result[weakest] as T;
        result[weakest] = {
          ...row,
          title,
          source: { kind: 'category', slug: top.slug },
          href: routes.category(top.slug),
        };
      }
    }
  }

  const scoreOf = (row: T): number => {
    const key = sourceTasteKey(row.source);
    return key === null ? 0 : (scores.get(key) ?? 0);
  };

  /**
   * Sắp ĐỨNG YÊN (stable): row cùng điểm giữ nguyên thứ tự ban đầu. Quan trọng vì
   * phần lớn row có điểm 0 — không có nó thì mỗi lượt tải lại là một thứ tự khác
   * cho những row app không biết gì, và trang chủ trông như bị xáo.
   */
  result = result
    .map((row, index) => ({ row, index, score: scoreOf(row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.row);

  return result;
}
