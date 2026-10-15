'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { PLACEHOLDER_BACKDROP } from '@/lib/constants';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { firstEpisodeHref, matchScore, metaLine } from '@/lib/derive';
import { routes } from '@/lib/routes';
import type { Movie, MovieImages } from '@/types/movie';
import { resumePoint, useWatchEntry } from '@/store/useWatchStore';
import { useDevice } from '@/hooks/useDevice';
import { Button } from '@/components/ui/Button';
import { MatchScore } from '@/components/ui/Chip';
import { InfoIcon, PlayIcon } from '@/components/ui/icons';
import { HeroTrailer } from './HeroTrailer';

interface HeroBillboardProps {
  movie: Movie;
  images: MovieImages;
  /** §8.2 — link YouTube. Rỗng thì hero giữ ảnh tĩnh. */
  trailerUrl?: string;
  /**
   * Tóm tắt phim, CHỮ THƯỜNG đã tính ở server (`toPlainText`) — sanitize kéo theo
   * DOMPurify, không để nó lọt vào bundle client chỉ vì một đoạn văn.
   */
  synopsis?: string;
}

/** Số thể loại đầu tiên hiện dưới tên phim. Quá ba thì thành một dòng liệt kê. */
const HERO_GENRES = 3;

/**
 * Tên dài hơn mốc này thì hạ một bậc cỡ chữ tiêu đề.
 *
 * Ở cỡ 60px khối tiêu đề chỉ chứa ~16 ký tự mỗi dòng, nên tên phim tiếng Việt dài
 * (không hiếm — "… (Nơi Biển Bắt Đầu)") lên 3–4 dòng. Cộng với dòng tóm tắt, tên 4
 * dòng bị đẩy lên đè navbar ở khổ 1280×720, nơi hero chỉ cao 576px (đo thật: đỉnh
 * chữ ở y=24 trong khi navbar cao 64). Hạ cỡ chữ theo độ dài giữ được tóm tắt mà
 * không phải cắt tên phim.
 */
const HERO_LONG_TITLE = 24;

/**
 * §8.2 — HeroBillboard.
 *
 * Lớp hiển thị từ dưới lên:
 *   layer 0  ảnh nền blur(40px) scale(1.15)  ← chỉ khi phải fallback thumb
 *   layer 1  backdrop từ /images, Ken Burns scale 1.0 → 1.08 trong 20s
 *   layer 2  gradient trái
 *   layer 3  gradient đáy nối liền vào row đầu tiên
 *   layer 4  nội dung
 *
 * ⚠️ Sai lệch so với §8.2: API không trả ảnh `logo` nào (khảo sát 10 phim chỉ có
 * `backdrop` và `poster`), nên title luôn dựng bằng chữ. `images.logos` vẫn được
 * đọc phòng khi API bổ sung sau.
 */
export function HeroBillboard({
  movie,
  images,
  trailerUrl = '',
  synopsis = '',
}: HeroBillboardProps) {
  const { reducedMotion, budget, canHover } = useDevice();

  /**
   * Trailer chỉ phát ở máy có chuột thật.
   *
   * Trên điện thoại hero là khung DỌC (375×480 ở 375px) mà video YouTube là 16:9:
   * iframe phóng 135% vẫn chỉ phủ được một dải ngang giữa khung, trên dưới là viền
   * đen — đo thật: ảnh hero biến mất, thay bằng video bị letterbox. Kèm theo là ~1 MB
   * script YouTube cộng luồng video tự phát trên mạng di động.
   *
   * Server snapshot có `canHover = true` nên HTML vẫn như cũ; iframe chỉ gắn sau
   * 2500ms, lúc đó giá trị thật đã về từ lâu — không có lần nhá nào trên điện thoại.
   */
  const playTrailer = budget.heroTrailer && canHover;
  const genres = movie.categories.slice(0, HERO_GENRES).map((category) => category.name);

  /**
   * Phim hero mà người này đang xem dở thì nút chính mở lại đúng chỗ đã dừng.
   *
   * Lượt render đầu ở client luôn ra `null` (store còn rỗng) nên khớp HTML từ
   * server — nhưng chữ trên nút đổi sau khi hydrate, và một nhãn dài hơn thì đẩy
   * nút bên cạnh đi. Cách chừa chỗ khác nhau theo khổ màn, xem khối nút bên dưới.
   *
   * Nhãn cũng KHÔNG mang theo số tập: "Tiếp tục Tập 12" rộng gần gấp đôi "Phát",
   * đủ để phá mọi cách chừa chỗ ở khổ điện thoại. Số tập và thời gian còn lại nằm
   * ở row "Tiếp tục xem" ngay dưới hero, nơi có chỗ cho chúng.
   */
  const resume = resumePoint(useWatchEntry(movie.slug));

  const backdrop = images.backdrops[0];
  // Không có backdrop thì dùng thumb độ phân giải thấp + bật layer 0 (§17 rủi ro #4).
  const source = backdrop ?? movie.thumb;
  const needsBlurLayer = !backdrop;
  const logo = images.logos[0];

  return (
    <section className="relative h-[56vw] max-h-[80svh] min-h-[min(30rem,88svh)] w-full">
      {/* layer 0 — nền blur cứu ảnh độ phân giải thấp */}
      {needsBlurLayer && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <SmartImage
            src={source}
            fallbackSrc={PLACEHOLDER_BACKDROP}
            alt=""
            fill
            // Blur 40px thì chi tiết không còn nghĩa lý gì — lấy bản nhỏ nhất.
            sizes="320px"
            quality={30}
            className="scale-[1.15] object-cover blur-[40px]"
          />
        </div>
      )}

      {/* layer 1 — backdrop + Ken Burns */}
      <div className="absolute inset-0 overflow-hidden">
        <SmartImage
          src={source}
          fallbackSrc={PLACEHOLDER_BACKDROP}
          alt={`${movie.name} (${movie.year})`}
          fill
          sizes={IMAGE_SIZES.hero}
          priority
          fetchPriority="high"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className={cn(
            'object-cover',
            needsBlurLayer && 'object-contain',
            // §9.4 — tắt Ken Burns khi giảm chuyển động, và khi máy/mạng yếu:
            // animation 20s giữ cả layer ảnh full-bleed trên compositor.
            !reducedMotion && budget.kenBurns && 'animate-kenburns',
          )}
        />
      </div>

      {/* layer 1b — trailer đè lên backdrop sau 2500ms (§8.2) */}
      <HeroTrailer trailerUrl={playTrailer ? trailerUrl : ''} title={movie.name} />

      {/* layer 2 — gradient trái */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'var(--hero-gradient-side)' }}
      />

      {/* layer 3 — gradient đáy nối liền vào row đầu tiên */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'var(--hero-gradient-bottom)' }}
      />

      {/* layer 4 — nội dung */}
      <div className="absolute inset-0 flex items-end pb-10 pt-20 sm:pb-12 md:pb-16 lg:pb-20">
        <div className="w-full max-w-2xl space-y-3 px-row drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] sm:space-y-4">
          {logo ? (
            <SmartImage
              src={logo}
              alt={movie.name}
              width={480}
              height={200}
              className="max-h-[22vh] w-auto object-contain"
              priority
            />
          ) : (
            <h1
              className={cn(
                'text-balance font-extrabold leading-[1.05] tracking-[-0.02em] text-text-primary drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]',
                movie.name.length > HERO_LONG_TITLE
                  ? 'text-2xl md:text-4xl lg:text-5xl'
                  : 'text-3xl md:text-5xl lg:text-6xl',
              )}
            >
              {movie.name}
            </h1>
          )}

          {movie.originName && movie.originName !== movie.name && (
            <p className="text-sm font-medium text-text-secondary drop-shadow-md md:text-base">
              {movie.originName}
            </p>
          )}

          {/*
            Thể loại là cụm riêng trong cùng hàng `flex-wrap`: màn rộng thì nó đứng
            ngay sau dòng meta, điện thoại thì tự xuống dòng mới — không cần hai bố
            cục cho hai khổ.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm drop-shadow-md">
            <MatchScore score={matchScore(movie)} />
            <span className="text-text-secondary">{metaLine(movie)}</span>
            {genres.length > 0 && (
              <span className="text-text-primary/85">{genres.join(' • ')}</span>
            )}
          </div>

          {/*
            Tóm tắt là thứ cho người xem một lý do để bấm Phát — trước đây hero chỉ
            có tên và dòng meta. Dữ liệu có sẵn từ chính lời gọi lấy trailer, và chữ
            nằm trong HTML server nên không có lần dịch nào sau hydrate.

            Chỉ hiện khi CÒN CHỖ, vì khối chữ neo đáy hero và mọi dòng thêm vào đều
            đẩy tên phim lên phía navbar:
            · ẩn ở điện thoại — hero là khung dọc 480px, thêm chữ là che mặt diễn
              viên, mà ở khổ đó ảnh mới là thứ bán phim
            · ẩn khi màn thấp hơn 700px — hero co còn 480px; đo thật ở 1280×600,
              tóm tắt đẩy đỉnh tên phim lên y=48, dưới mép navbar (64)
            · 2 dòng, 3 dòng từ `lg`
          */}
          {synopsis && (
            <p className="hidden max-w-xl text-sm leading-relaxed text-text-primary/85 drop-shadow-md md:text-base sm:[@media(min-height:700px)]:line-clamp-2 lg:[@media(min-height:700px)]:line-clamp-3">
              {synopsis}
            </p>
          )}

          {/*
            Nhãn nút chính đổi được sau khi hydrate, nên hai nút phải chịu được
            chuyện đó ở MỌI khổ màn. Đo thật ở 360px: khối này chỉ rộng 331px, mà
            "Phát" + "Thông tin khác" đã chiếm 303px — nút chính rộng thêm 30px là
            đủ ép nút thứ hai xuống dòng, tức dịch 60px theo chiều dọc.

            Hai việc, mỗi việc cho một nút thắt:
            · `sm:min-w` chừa sẵn cho nhãn dài hơn, nên từ 640px lên thì nút thứ
              hai không nhích một pixel nào.
            · nhãn phụ ngắn lại ở khổ điện thoại, để cả hai nhãn của nút chính đều
              còn chỗ trên MỘT dòng. Còn lại đúng một cú nhích ngang ~30px của nút
              phụ — CLS cỡ 0.002, trong khi ngưỡng "tốt" là 0.1.
          */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1.5">
            <Button
              href={
                resume
                  ? routes.watch(movie.slug, resume.ep, { startAt: resume.position })
                  : firstEpisodeHref(movie.slug)
              }
              variant="primary"
              size="lg"
              className="group sm:min-w-[9.25rem] shadow-[0_6px_24px_rgba(255,255,255,0.4)]"
            >
              <PlayIcon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
              <span>{resume ? 'Tiếp tục' : 'Phát'}</span>
            </Button>
            <Button
              href={routes.detail(movie.slug)}
              variant="secondary"
              size="lg"
              className="group sm:min-w-[9.25rem]"
            >
              <InfoIcon className="h-5 w-5 text-text-secondary transition-transform duration-200 group-hover:scale-110 group-hover:text-white" />
              {/*
                Bọc cả nhãn trong MỘT span: `Button` là `inline-flex gap-2`, nên
                "Thông tin" (text node) và span "khác" thành hai flex item và bị
                chèn thêm 8px — ra "Thông tin   khác".
              */}
              <span>
                Thông tin<span className="hidden sm:inline">&nbsp;khác</span>
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
