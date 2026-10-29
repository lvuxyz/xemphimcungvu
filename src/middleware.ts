import { NextResponse, type NextRequest } from 'next/server';
import { ApiError } from '@/lib/api';
import { getMovieById, getMovieByImdb, getMovieByTmdb } from '@/lib/endpoints';
import { routes } from '@/lib/routes';

/**
 * Middleware làm đúng hai việc, đều là chuyện Next 14 không tự làm đúng được:
 *
 *   1. Link tra cứu trả status THẬT — xem bên dưới.
 *   2. Request router từ trang 404 không làm sập server — xem `NOT_FOUND_URL`.
 *
 * ── 1. Link tra cứu: 307 khi tìm thấy, 404 khi không ──────────────────────────
 *
 * `redirect()`/`notFound()` trong page không làm được việc này: `app/loading.tsx`
 * bọc mọi trang trong Suspense, nên shell kèm status 200 đã đi trước khi page kịp
 * chạy, và Next chỉ còn cách nhét meta refresh / `noindex` vào nội dung. Trình
 * duyệt vẫn tới nơi, nhưng thứ đọc status hoặc không chạy theo meta refresh — preview
 * link của Facebook, Zalo, link checker — nhận một trang 200 trống.
 *
 * Bỏ `loading.tsx` thì status đúng hết, nhưng mất skeleton khi bấm sang mọi trang
 * động. Nên chỉ ở đây, cho đúng những route là CỬA VÀO từ bên ngoài và không render
 * gì ngoài một cú chuyển hướng. Trang nội dung không có (`/phim/{slug}` lạ…) vẫn để
 * page `notFound()`: 200 kèm `noindex` là cách Next chủ ý xử lý khi streaming.
 *
 * Page của các route này vẫn giữ nguyên làm phao: API lỗi mạng thì middleware để
 * request đi tiếp, và page tự thử lại theo chính sách retry của nó.
 */
export async function middleware(request: NextRequest) {
  if (request.headers.get('next-url') === NOT_FOUND_URL) return skipRouterRequest();

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);

  // `/xem/{slug}` — không cần API: trang phát tự phân giải sentinel về tập đầu.
  if (segments[0] === 'xem' && segments.length === 2) {
    return redirectTo(request, routes.watch(segments[1]!));
  }

  const lookup = lookupFor(segments);
  if (lookup === undefined) return NextResponse.next();
  if (lookup === null) return notFound(request);

  try {
    // Một lần thử, không retry: hỏng thì page phía sau vẫn còn đủ lượt retry của nó.
    const detail = await lookup({ retries: 0 });
    return detail.movie.slug
      ? redirectTo(request, routes.detail(detail.movie.slug))
      : notFound(request);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return notFound(request);
    return NextResponse.next();
  }
}

type Lookup = (opts: { retries: number }) => ReturnType<typeof getMovieById>;

/** `undefined` — không phải route tra cứu; `null` — sai dạng, 404 luôn khỏi gọi API. */
function lookupFor([first, second, third, ...rest]: string[]): Lookup | null | undefined {
  if (rest.length > 0 || !third) return undefined;
  if (first === 'tmdb') {
    if (second !== 'movie' && second !== 'tv') return null;
    return (opts) => getMovieByTmdb(second, third, opts);
  }
  if (first === 'imdb' && second === 'title') return (opts) => getMovieByImdb(third, opts);
  if (first === 'phim' && second === 'id') return (opts) => getMovieById(third, opts);
  return undefined;
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 307);
}

/**
 * Rewrite sang một đường dẫn không khớp route nào → Next render `app/not-found.tsx`
 * với status 404 thật, mà thanh địa chỉ vẫn giữ nguyên link người dùng đã mở.
 */
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL('/_khong-tim-thay', request.url));
}

/**
 * ── 2. Request RSC từ trang 404 ──────────────────────────────────────────────
 *
 * Trang 404 dựng sẵn của Next (`/_not-found` — cả URL lạ lẫn `notFound()` ở trên)
 * mang cây router KHÔNG có slot `modal`, trong khi root layout có `@modal`. Link
 * nav trên trang đó prefetch về route đích kèm cây ấy, và khi slot `modal` của
 * đích rơi về `default.tsx`, Next 14.2 đọc `flightRouterState[1].modal[0]`
 * (`walk-tree-with-flight-router-state.js`) → TypeError. Mỗi lượt xem trang 404
 * là 4 lỗi 500 trong console, 4 stack trace trong log server, và bấm link nào
 * cũng rơi về tải lại cả trang.
 *
 * Trả 204 ngay tại đây: phản hồi không phải RSC thì router của Next coi là "tải
 * trang thường" — prefetch lặng lẽ bỏ qua, bấm link thì trình duyệt tải trang
 * đích từ đầu. Kết cục với người dùng y như trước, chỉ khác là có chủ đích: không
 * còn 500, không còn stack trace, server khỏi render một cây chắc chắn sập. Rời
 * trang 404 bằng một lượt tải đầy đủ là cái giá chấp nhận được.
 *
 * `Next-Url` là thứ DUY NHẤT nhận ra được request này: Next gỡ `RSC` và
 * `Next-Router-State-Tree` khỏi request trước khi đưa cho middleware rồi tự gắn
 * lại sau, nên middleware không xoá được cây router (đã thử — vẫn 500). Router
 * chỉ gửi `Next-Url` kèm request RSC, nên nó đủ để biết đây không phải lượt tải
 * trang của trình duyệt.
 *
 * Đã thử `@modal/[...catchAll]/page.tsx` để slot không bao giờ rơi về default:
 * hết sập, nhưng slot khớp MỌI URL nên URL lạ không còn là "không có route" nữa —
 * `/khong-co-trang` và cả 404 của việc 1 thành 200.
 */
const NOT_FOUND_URL = '/_not-found';

function skipRouterRequest() {
  return new NextResponse(null, { status: 204 });
}

/**
 * ⚠️ Tham số CUỐI phải có pattern riêng — `([^/]+)`.
 *
 * Next nối `(.json)?` vào sau mỗi matcher, nên `/xem/:slug` thành
 * `/xem/:slug(.json)?` và path-to-regexp đọc đó là "tham số `slug` có pattern
 * `.json`": regexp build ra là `\/xem(?:\/(.json))?`, middleware không bao giờ
 * chạy cho `/xem/vung-tu-dia`. Không có lỗi build nào báo — chỉ đọc
 * `.next/server/middleware-manifest.json` mới thấy.
 */
export const config = {
  matcher: [
    '/xem/:slug([^/]+)',
    '/tmdb/:type/:id([^/]+)',
    '/imdb/title/:ttid([^/]+)',
    '/phim/id/:id([^/]+)',
    // Chỉ request RSC phát ra từ trang 404 mới mang header này — việc 2. Literal chứ
    // không dùng `NOT_FOUND_URL`: Next đọc `config` bằng phân tích tĩnh lúc build.
    { source: '/:path*', has: [{ type: 'header', key: 'next-url', value: '/_not-found' }] },
  ],
};
