import { describe, expect, it } from 'vitest';
import {
  cardQualityLabel,
  episodeBadgeLabel,
  episodeLabel,
  firstEpisodeHref,
  formatTime,
  matchScore,
  parseEpisodeBadge,
  resolveEpisode,
  youtubeId,
  movieTitle,
} from '@/lib/derive';
import type { Movie } from '@/types/movie';

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: '1',
    name: 'Phim',
    slug: 'phim',
    originName: 'Movie',
    type: 'single',
    poster: '',
    thumb: '',
    duration: '100 phút',
    episodeCurrent: 'Full',
    quality: 'FHD',
    lang: 'Vietsub',
    year: 2024,
    subExclusive: false,
    modifiedAt: '',
    tmdb: { id: null, type: 'movie', season: null, vote_average: 0, vote_count: 0 },
    imdb: { id: null, vote_average: 0, vote_count: 0 },
    categories: [],
    countries: [],
    ...overrides,
  };
}

describe('matchScore — §5.3, §17 rủi ro #7', () => {
  it('trả null khi không có lượt vote nào — UI phải ẩn badge, KHÔNG hiện 0%', () => {
    expect(matchScore(movie())).toBeNull();
  });

  it('quy đổi vote_average sang phần trăm', () => {
    expect(matchScore(movie({ imdb: { id: null, vote_average: 8.4, vote_count: 120 } }))).toBe(84);
  });

  it('chọn nguồn có nhiều lượt vote hơn', () => {
    const m = movie({
      imdb: { id: null, vote_average: 5, vote_count: 10 },
      tmdb: { id: null, type: 'movie', season: null, vote_average: 9, vote_count: 900 },
    });
    expect(matchScore(m)).toBe(90);
  });

  it('bỏ qua nguồn có vote_count > 0 nhưng vote_average = 0', () => {
    // Ca thật của "Vạn Giới Độc Tôn": imdb nhiều vote hơn nhưng chưa có điểm.
    const m = movie({
      imdb: { id: 'tt34882755', vote_average: 0, vote_count: 10 },
      tmdb: { id: '122612', type: 'tv', season: 1, vote_average: 9.5, vote_count: 4 },
    });
    expect(matchScore(m)).toBe(95);
  });

  it('cả hai nguồn đều rỗng điểm → null, không hiện 0%', () => {
    const m = movie({
      imdb: { id: null, vote_average: 0, vote_count: 10 },
      tmdb: { id: null, type: 'tv', season: null, vote_average: 0, vote_count: 3 },
    });
    expect(matchScore(m)).toBeNull();
  });
});

describe('parseEpisodeBadge — §5.3', () => {
  it('parse "Hoàn Tất (24/24)"', () => {
    expect(parseEpisodeBadge('Hoàn Tất (24/24)')).toEqual({ kind: 'completed', total: 24 });
  });

  it('parse "Hoàn Tất (16/16)" không phân biệt hoa thường / dấu', () => {
    expect(parseEpisodeBadge('hoan tat (16/16)')).toEqual({ kind: 'completed', total: 16 });
  });

  it('parse "Tập 33"', () => {
    expect(parseEpisodeBadge('Tập 33')).toEqual({ kind: 'ongoing', current: 33 });
  });

  it('parse "Tập 8 VietSub"', () => {
    expect(parseEpisodeBadge('Tập 8 VietSub')).toEqual({ kind: 'ongoing', current: 8 });
  });

  it('parse "Full"', () => {
    expect(parseEpisodeBadge('Full')).toEqual({ kind: 'full' });
    expect(parseEpisodeBadge('FULL HD')).toEqual({ kind: 'full' });
  });

  it('giữ nguyên chuỗi lạ thay vì đoán sai', () => {
    expect(parseEpisodeBadge('Trailer')).toEqual({ kind: 'unknown', label: 'Trailer' });
    expect(parseEpisodeBadge('')).toEqual({ kind: 'unknown', label: '' });
  });

  it('không throw với chuỗi rỗng / khoảng trắng', () => {
    expect(() => parseEpisodeBadge('   ')).not.toThrow();
  });

  it('episodeBadgeLabel ra nhãn tiếng Việt', () => {
    expect(episodeBadgeLabel({ kind: 'completed', total: 24 })).toBe('Trọn bộ 24 tập');
    expect(episodeBadgeLabel({ kind: 'ongoing', current: 3 })).toBe('Tập 3');
    expect(episodeBadgeLabel({ kind: 'full' })).toBe('Bản đầy đủ');
  });
});

describe('youtubeId — §8.2, §17 rủi ro #5', () => {
  it('đọc được các dạng link YouTube phổ biến', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('trả null khi không nhận ra — hero giữ ảnh tĩnh, im lặng', () => {
    expect(youtubeId('')).toBeNull();
    expect(youtubeId('https://vimeo.com/123')).toBeNull();
  });
});

describe('formatTime — §10.5', () => {
  it('định dạng mm:ss và h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(754)).toBe('12:34');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('không vỡ với giá trị không hợp lệ', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('episodeLabel / resolveEpisode — lệch giữa §5.1, §8.2 và API thật', () => {
  it('không lặp tiền tố khi name đã là "Tập 01"', () => {
    // §5.1 ghi name là "1", nhưng API thật trả "Tập 01".
    expect(episodeLabel('Tập 01')).toBe('Tập 01');
    expect(episodeLabel('tập 12')).toBe('tập 12');
  });

  it('ghép tiền tố khi name chỉ là số', () => {
    expect(episodeLabel('1')).toBe('Tập 1');
    expect(episodeLabel('')).toBe('');
  });

  const list = [
    { slug: 'tap-01', name: 'Tập 01' },
    { slug: 'tap-02', name: 'Tập 02' },
    { slug: 'tap-03', name: 'Tập 03' },
  ];

  it('khớp theo slug tập thật', () => {
    expect(resolveEpisode(list, 'tap-02')?.slug).toBe('tap-02');
  });

  it('khớp sentinel số của §8.2 (/xem/{slug}/1) về tập đầu', () => {
    expect(resolveEpisode(list, '1')?.slug).toBe('tap-01');
    expect(resolveEpisode(list, '3')?.slug).toBe('tap-03');
  });

  it('tham số lạ thì rơi về tập đầu thay vì trang trắng', () => {
    expect(resolveEpisode(list, 'khong-ton-tai')?.slug).toBe('tap-01');
    expect(resolveEpisode(list, '99')?.slug).toBe('tap-01');
  });

  it('danh sách rỗng trả undefined', () => {
    expect(resolveEpisode([], '1')).toBeUndefined();
  });

  it('firstEpisodeHref dùng slug tập khi biết, sentinel khi chưa biết', () => {
    expect(firstEpisodeHref('phim-abc')).toBe('/xem/phim-abc/1');
    expect(firstEpisodeHref('phim-abc', 'tap-01')).toBe('/xem/phim-abc/tap-01');
  });
});

describe('movieTitle', () => {
  it('ghép năm vào sau tên', () => {
    expect(movieTitle({ name: 'Độc Kiếm Cửu Thiên', year: 2026 })).toBe('Độc Kiếm Cửu Thiên (2026)');
  });

  /** API trả `year: 0` khi không biết — không được đẻ ra "Tên (0)". */
  it('bỏ phần năm khi API không trả', () => {
    expect(movieTitle({ name: 'Phim Không Rõ Năm', year: 0 })).toBe('Phim Không Rõ Năm');
  });
});

describe('cardQualityLabel', () => {
  /** FHD là mặc định của ~97% phim — in lên mọi card là nhiễu, không phải thông tin. */
  it('ẩn nhãn FHD', () => {
    expect(cardQualityLabel('FHD')).toBe('');
    expect(cardQualityLabel(' fhd ')).toBe('');
  });

  it('giữ nhãn đáng biết trước khi bấm', () => {
    expect(cardQualityLabel('CAM')).toBe('CAM');
    expect(cardQualityLabel('HD')).toBe('HD');
  });

  it('không có nhãn thì không có gì để hiện', () => {
    expect(cardQualityLabel('')).toBe('');
  });
});
