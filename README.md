# xemphimcungvu

Web app xem phim — Next.js 14 App Router · TypeScript · TailwindCSS · Framer Motion · TanStack Query · Zustand · hls.js.

Dựng theo [`document/TAI-LIEU-KY-THUAT-WEB-XEM-PHIM.md`](document/TAI-LIEU-KY-THUAT-WEB-XEM-PHIM.md).
Mọi tham chiếu dạng §x trong mã nguồn đều trỏ về mục tương ứng của tài liệu đó.

> **Trạng thái: đã nối API thật — toàn bộ màn hình chạy bằng dữ liệu KKPhim.**
>
> Không còn mock nào trong mã nguồn (`src/mocks` đã xoá). Mọi endpoint của §3 đều
> có nơi dùng thật, xem bảng ["Endpoint nào dùng ở đâu"](#endpoint-nào-dùng-ở-đâu).

---

## Bắt đầu

```bash
npm install
```

```bash
npm run dev
```

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit test (Vitest) |
| `npm run lint` | ESLint |
| `npm run analyze` | Build kèm bundle analyzer |

Smoke test chạm API thật (mặc định bỏ qua, không cần cho việc dựng UI):

```bash
LIVE_API=1 npx vitest run tests/live-api.test.ts
```

---

## Màn hình đã dựng

| Route | Màn | Đặc tả |
|---|---|---|
| `/` | Hero + 11 ContentRow | §8.2, §8.3 |
| `/phim/[slug]` | Chi tiết full | §8.5 |
| `@modal/(.)phim/[slug]` | Modal chi tiết, nền giữ nguyên trang cũ | §6.1 |
| `/xem/[slug]/[ep]` | Trình phát + sidebar chọn tập | §10 |
| `/danh-sach/[type]` | Lưới + FilterBar + infinite scroll | §8.7 |
| `/danh-sach` | Lưới tổng hợp, không bó theo `type_list` | §3.1 |
| `/the-loai/[slug]`, `/quoc-gia/[slug]`, `/nam/[year]` | Lưới theo taxonomy | §8.7 |
| `/tim-kiem` | Kết quả tìm kiếm | §8.1 |
| `/danh-sach-cua-toi` | My List (localStorage) | §1.2 |
| `/phim/id/[id]`, `/tmdb/[type]/[id]`, `/imdb/title/[ttid]` | Tra phim rồi chuyển về `/phim/{slug}` | §3.2 |

---

## Cấu trúc

```
src/
├─ app/                  Route tree §6
│  └─ @modal/            Parallel route slot cho intercepting route §6.1
├─ components/
│  ├─ ui/                Button · Chip · Skeleton · Toast · Dropdown · icons
│  └─ feature/           Navbar · HeroBillboard · ContentRow · MovieCard
│                        HoverPreview · DetailModal · CastRow · FilterBar · VideoPlayer
├─ lib/                  api · endpoints · normalize · list-source · image · derive
│                        sanitize · storage · search-params · text · query-*
├─ hooks/                useHoverDelay · useRowScroll · useHls · useWatchProgress
│                        useKeyboardShortcuts · usePrefersReducedMotion
│                        useScrollLock · useInView
├─ store/                useUIStore · useMyListStore
├─ types/                movie.ts · api-raw.ts · filters.ts
└─ styles/               tokens.css · globals.css
```

### Ba ranh giới được ép bằng công cụ

1. **`types/api-raw.ts` chỉ `lib/normalize.ts` được import** — ESLint `no-restricted-imports` (§15).
2. **Không component nào chạm raw response** — `lib/endpoints.ts` là bề mặt duy nhất (§2.2 #1).
3. **Client component không tự dựng URL endpoint** — nó nhận `ListSource`
   (`lib/list-source.ts`), là object thuần đi qua được ranh giới RSC → client,
   rồi để `fetchListSource` chọn hàm. Một nguồn danh sách = một query key.

### Endpoint nào dùng ở đâu

Mọi endpoint của §3 đều đi qua `lib/endpoints.ts` — không nơi nào khác được gọi
`request()`.

| Endpoint §3 | Hàm | Nơi dùng |
|---|---|---|
| `/v1/api/home` | `getHome` | RSC trang chủ — lời gọi đầu tiên, chọn hero |
| `/danh-sach/phim-moi-cap-nhat-v3` | `getNewlyUpdated` | Row "Mới cập nhật" (xem sai lệch #11) |
| `/v1/api/danh-sach/{type}` | `getListByType` | `/danh-sach/[type]` · row Phim bộ/lẻ/Hoạt hình/TV |
| `/v1/api/danh-sach` | `getList` | `/danh-sach` |
| `/v1/api/the-loai/{slug}` | `getByCategory` | `/the-loai/[slug]` · row thể loại · "Có thể bạn thích" |
| `/v1/api/quoc-gia/{slug}` | `getByCountry` | `/quoc-gia/[slug]` · row quốc gia |
| `/v1/api/nam/{year}` | `getByYear` | `/nam/[year]` |
| `/v1/api/tim-kiem` | `search` | `/tim-kiem` · dropdown SearchBox |
| `/phim/{slug}` | `getMovieDetail` | qua `getDetail` — chi tiết, modal, trang phát |
| `/v1/api/phim/{slug}` | `getMovieDetailV1` | phao của `getDetail` khi Format 1 hỏng |
| `/phim/id/{_id}` | `getMovieById` | `/phim/id/[id]` |
| `/tmdb/{type}/{id}` | `getMovieByTmdb` | `/tmdb/[type]/[id]` |
| `/imdb/title/{ttid}` | `getMovieByImdb` | `/imdb/title/[ttid]` |
| `/v1/api/phim/{slug}/images` | `getMovieImages` | backdrop hero + backdrop modal |
| `/v1/api/phim/{slug}/peoples` | `getMoviePeoples` | CastRow |
| `/v1/api/phim/{slug}/keywords` | `getMovieKeywords` | keyword chips |
| `/the-loai` · `/quoc-gia` · `/nam-phat-hanh` | `getTaxonomies` | Navbar, FilterBar, tên trang taxonomy |

Ba hàm gộp ở tầng trên, để page không phải tự ghép:

- `getHeroSpotlight(items)` — soi 3 phim đầu, chọn phim có backdrop (ưu tiên có
  thêm trailer) làm hero. Tất cả nằm trong MỘT lượt song song, không waterfall.
- `getMovieBundle(slug)` — 4 endpoint §11.3 trong một lời gọi; ba phần bổ trợ
  fail thì về rỗng chứ không kéo cả màn xuống.
- `getRelated(movie)` — "Có thể bạn thích" theo thể loại chính, bỏ chính nó.

### Thứ tự fetch trang chủ (§11.2)

```
RSC     /v1/api/home  +  /danh-sach/phim-moi-cap-nhat-v3   (song song)
  └─ rồi images + chi tiết của 3 ứng viên hero            (song song)
client  10 row còn lại — mỗi row tự gọi khi cuộn gần tới  (LazyRow)
```

Lúc trang vừa load (`scrollY = 0`) **không có request nào** từ phía client — đo
trực tiếp trên trình duyệt. Đây chính là thứ §11.2 cấm: bắn 11 request song song
ngay khi load.

---

## Kiểm chứng

```
✓ tsc --noEmit    không lỗi
✓ next lint       không warning
✓ vitest          92/92 test xanh (+16 live test, opt-in)
✓ next build      17/17 route dựng được
```

Đã kiểm tra trực tiếp trên trình duyệt với dữ liệu thật: trang chủ dựng 11 row
(row đầu từ RSC, 10 row còn lại lazy) · modal chi tiết có đủ cast 10 người,
8 keyword, 12 phim liên quan · trình phát chạy HLS thật (`readyState = 4`,
duration 78 phút) · infinite scroll 18 → 90 phim, tự xin trang tiếp của API ·
lọc `?country=han-quoc&year=2024` ra đúng 117 phim · gõ "co dau" không dấu ra
"Cô Dâu…" · slug lạ ở `/phim`, `/the-loai`, `/nam` đều rơi về not-found ·
`/phim/id/{_id}`, `/tmdb/tv/{id}`, `/imdb/title/{ttid}` chuyển đúng về slug ·
bố cục mobile 375px.

Từ đợt dựng UI (hành vi không đổi ở lần nối API này): hero trailer tự phát sau
2500ms và tự lặp · hover card phóng to không bị cắt · modal mở đè trang chủ và
URL đổi · roving tabindex đi giữa các card bằng `←`/`→`.

### Lượt rà theo kích thước màn

Chạy lại toàn bộ màn ở **375 · 768 · 1024 · 1366 · 1920 · 2560** với dữ liệu thật.
Ở mọi mức: `documentElement.scrollWidth == clientWidth` (không cuộn ngang ngoài ý
muốn), không có ảnh vỡ, không màn nào rơi vào error state.

| Kiểm tra | Kết quả |
|---|---|
| Lưới danh sách | 2 → 3 → 4 → 6 cột đúng breakpoint |
| Navbar | menu ngang từ `lg`, dưới đó là drawer; drawer khoá scroll, chọn xong tự đóng |
| Mega menu | mở khi rê chuột, đủ 26 thể loại / 36 quốc gia từ API |
| FilterBar | đổi lọc ghi vào URL, số phim đổi theo (7652 → 447 khi thêm `country=han-quoc`) |
| Infinite scroll | 18 → 90 phim, tự xin trang tiếp |
| Modal | ESC đóng, quay lại đúng vị trí cuộn của trang nền |
| Bàn phím | `←`/`→`/`End` chạy giữa các card, mỗi row chỉ một card nhận Tab |
| My List | thêm từ hover preview và từ trang chi tiết, gỡ ở trang My List, còn nguyên sau F5 |
| Trình phát | play/pause, `k`, `←`/`→` tua 10s, đổi tập, lưu tiến độ, thanh tiến độ ở tập đang xem dở |
| Hover preview mép row | ở 2560 vẫn nằm trong viewport (transform-origin edge-aware) |

Chưa kiểm được trong môi trường này: banner mất mạng (§14.1) — không giả lập được
`navigator.onLine` từ bên ngoài trang.

### Ba lỗi bắt được trong lượt rà này

1. **Skeleton của `LazyRow` làm cả trang cuộn ngang 160px** ở màn 1366. Sáu ô
   `shrink-0` rộng hơn màn hình mà thiếu `overflow-hidden`. Lỗi mới, do chính
   lần nối API sinh ra.
2. **Trang "Danh sách của tôi" kẹt ở skeleton vĩnh viễn.** Lỗi có sẵn từ trước:
   cờ `hydrated` được đặt trong `onRehydrateStorage` bằng `useMyListStore.setState`,
   mà callback đó chạy ngay giữa lúc `create()` còn đang chạy (localStorage là API
   đồng bộ) — biến còn ở TDZ, setState ném lỗi và bị persist nuốt. Nay hỏi thẳng
   `persist.hasHydrated()` / `onFinishHydration`.
3. **Nút "Danh sách" ở trang chi tiết không làm gì** — cũng là lỗi có sẵn: nó là
   `<Button>` trần không có handler. Nay là `MyListButton`, cùng hành vi với nút +
   trong hover preview (toggle + toast + đổi nhãn "Đã lưu").

### Ba lỗi bố cục sửa tiếp sau đó

4. **Card đầu mỗi row dán sát mép màn hình** trong khi tiêu đề row vẫn thụt vào
   (rõ nhất ở 1920: card ở `x=0`, chữ ở `x=77`). `scroll-snap-type: x mandatory`
   snap theo mép scrollport, mà điểm snap của card đầu lại nằm sau `padding-left`
   — trình duyệt kéo row sang phải đúng bằng gutter. Thêm
   `scroll-padding-inline: var(--row-padding-x)` cho `.row-track`: điểm snap
   trùng bố cục, và sau mỗi lần bấm mũi tên card cũng dừng đúng gutter.
5. **Row đầu đè lên chữ của hero.** `-mt-[8vw]` ở 1920 là 154px, nuốt 62px cuối
   của khối tiêu đề + nút Phát ("Mới cập nhật" nằm chồng lên nút). Kẹp lại còn
   `clamp(0.5rem,4vw,4.5rem)` — vẫn chồng đủ để gradient đáy hero nối vào row,
   mà 375 / 768 / 1366 / 1920 / 2560 đều còn hở 20–45px dưới nút.
6. **Click vào "Thể loại" / "Quốc gia" / "Năm" lại ĐÓNG mega menu.** Trình duyệt
   bắn `mouseenter` (mở) ngay trước `click` (toggle → đóng), nên menu vừa bung ra
   đã biến mất dưới chính con trỏ vừa bấm. Nay `onClick` bỏ qua khi con trỏ đang
   ở trên mục đó; bàn phím không có `mouseenter` nên `Enter` vẫn toggle như cũ,
   và thêm `ESC` để đóng + trả focus về nút mở (§13.1).

Bundle initial: **140 kB** trang chủ (trước khi nối API là 165 kB — bỏ chỉ mục
tìm kiếm tĩnh trả lại 25 kB), dưới ngưỡng 180 KB của §12.1. Phần lớn còn lại là
Framer Motion (~50 kB), thứ §9.1 yêu cầu. Nếu cần cắt thêm: `VideoPlayer` đã
code-split sẵn, bước tiếp theo là split `DetailModal`.

---

## Sai lệch so với tài liệu

Tất cả phát hiện khi gọi thật API (Phụ lục A) và khi dựng UI. Tài liệu cần cập nhật.

### 1. `/images`, `/peoples`, `/keywords` có shape khác §5.2

§17 rủi ro #3 dự đoán đúng. Cả ba là dữ liệu **TMDB**, envelope
`{ success, message, status_code, data }` chứ không phải `{ status, msg }`.

`/images` **không** trả `{ backdrops, posters, logos }` mà là mảng phẳng phân loại
bằng `type`, đường dẫn phải ghép với base riêng:

```jsonc
{ "data": {
    "image_sizes": { "backdrop": { "original": "https://image.tmdb.org/t/p/original" } },
    "images": [ { "type": "backdrop", "file_path": "/tBxBchbTsi801LWzyutNqCAACis.jpg" } ]
} }
```

`/peoples` ghép `profile_path` với `data.profile_sizes`; `/keywords` trả
`[{ tmdb_keyword_id, name, name_vn }]` — ưu tiên `name_vn`.

→ Ảnh hero và avatar cast đến từ `image.tmdb.org`, không phải `phimimg.com`.

### 2. Không có logo title — §8.2 không làm được như mô tả

§8.2 yêu cầu *"có `logos[0]` → render làm title"*. Khảo sát 10 phim: chỉ có
`backdrop` (136 ảnh) và `poster` (78 ảnh), **không có `logo` nào**.
HeroBillboard vì thế dựng title bằng chữ, coi logo là bonus.

### 3. `/image.php` trả 404 — §3.5 và §12.3 không còn đúng

```
GET https://phimapi.com/image.php?url=https://phimimg.com/uploads/…/poster.webp
→ 404  {"status":false,"msg":"hmmm!"}
```

Đã thử url thô, url đã encode, có/không `w`&`q`, ảnh phimimg lẫn TMDB — đều 404.
CDN gốc thì phục vụ `image/webp` trực tiếp.

→ Dùng **optimizer sẵn có của Next**, lại tốt hơn: có resize thật theo `sizes`.
`src/lib/image-loader.ts` giữ lại sau cờ `NEXT_PUBLIC_USE_IMAGE_PROXY`.

### 4. §5.3 chọn nhầm nguồn rating, làm hiện "0% phù hợp"

§5.3 chỉ so `vote_count`. Dữ liệu thật có phim `vote_count > 0` nhưng
`vote_average = 0`. Ví dụ "Vạn Giới Độc Tôn": imdb `{avg: 0, count: 10}` và
tmdb `{avg: 9.5, count: 4}` — quy tắc gốc chọn imdb rồi hiện **0%**, đúng thứ
§17 rủi ro #7 muốn tránh. **10/198 phim trong mock dính lỗi này.**

→ `bestRatingSource()` lọc nguồn dùng được (có cả vote lẫn điểm) TRƯỚC rồi mới so vote.

### 5. `episode.name` và `episode.slug` khác §5.1 / §8.2

§5.1 ghi `name: "1"`, `slug: "1"`. Thực tế: `name: "Tập 01"`, `slug: "tap-01"`.

→ Ghép tiền tố thẳng sẽ ra **"Tập Tập 01"** (`episodeLabel()` xử lý), và nút Play
của §8.2 trỏ `/xem/{slug}/1` sẽ không khớp tập nào (`resolveEpisode()` phân giải
theo slug → số thứ tự → tập đầu).

### 6. §8.3 "row cha phải `overflow: visible`" là bất khả thi trong CSS

Khi một trục là `auto`, trục còn lại dù khai báo `visible` cũng bị trình duyệt
tính thành `auto` (CSS Overflow 3). Mà cuộn ngang + `scroll-snap` là bắt buộc,
nên không thể bỏ `overflow-x: auto`.

→ Cách đi được: chừa `padding-block` (vùng clipping là padding box) rồi kéo row
sát lại bằng `margin-block` âm. Phần tràn **xuống dưới lớn hơn lên trên** vì
preview neo ở `top: 0` và cao hơn card, nên padding phải bất đối xứng — đo thực
tế: trên 6rem, dưới 11rem.

### 7. `loop=1&playlist={id}` của §8.2 làm lộ control YouTube giữa hero

§8.2 chỉ định tham số nhúng `mute=1&controls=0&modestbranding=1&disablekb=1&loop=1&playlist={id}`.

`playlist` chuyển player sang chế độ danh sách phát, và YouTube hiện nút
prev/pause/next **ngay giữa hero** — `controls=0` không tắt được. Đã kiểm chứng
trực tiếp trên trình duyệt: bỏ `loop`+`playlist` thì overlay biến mất.

→ Lặp lại bằng cách nghe `playerState === 0` (ended) qua postMessage rồi
`seekTo(0)` + `playVideo`. Cùng kết quả, không có control thừa.

### 8. `EpisodeBadge` có thêm biến thể `unknown`

§5.3 định nghĩa 3 biến thể; thực tế `episode_current` còn có `"Trailer"`,
`"Tập 5-6"`. Thêm `{ kind: 'unknown'; label: string }` để giữ chuỗi gốc thay vì
đoán sai (§2.2 #4).

---

### 9. Ảnh placeholder không đi qua image optimizer được

`detectContentType` của Next 14 chỉ nhận ra SVG khi file mở đầu bằng đúng năm byte
`<?xml`. Hai placeholder trong `public/` mở đầu bằng `<svg`, nên mọi request
`/_next/image?url=%2Fplaceholder-poster.svg` trả **400 "The requested resource
isn't a valid image"** — tức ảnh dự phòng biến mất đúng lúc cần nhất (ảnh CDN
404, §14.1). Kiểm chứng trên dev server ngày 15/09/2026.

Cách xử lý: `components/ui/SmartImage.tsx` đặt `unoptimized` cho mọi src là
placeholder — tối ưu một file 356 byte vốn đã vô nghĩa. Đã thêm cả prolog `<?xml`
vào hai file cho chắc. Cố ý KHÔNG bật `dangerouslyAllowSVG`: nó sẽ mở đường cho
mọi SVG từ CDN phim đi qua origin của mình.

### 10. Chỉ tải 3 weight font thay vì 4

§7.2 dùng 400 / 500 / 700 / 800. Mỗi weight là 2 file (`vietnamese` + `latin`)
được preload trên đường găng của lần tải đầu. Bỏ weight 500 tiết kiệm 2 request
và ~30KB — trên 3G là gần nửa giây. `font-medium` rơi về 400; ở cỡ chữ 12–15px
của UI thì khác biệt gần như không nhận ra. Muốn lấy lại: thêm `'500'` vào mảng
`weight` trong `app/layout.tsx`.

### 11. `/v1/api/home` không trả `thumb_url`

§11.2 bảo trang chủ dựng row từ `/v1/api/home`. Nhưng item của endpoint này chỉ
có `poster_url` (2:3), trong khi ContentRow là card 16:9 — dựng thẳng thì mọi
card row đầu đều là poster bị cắt ngang mặt.

`/danh-sach/phim-moi-cap-nhat-v3` trả **cùng nội dung, cùng thứ tự** nhưng có cả
`thumb_url`. Nên trang chủ gọi song song cả hai: `/home` giữ đúng vai "lời gọi
đầu tiên" và là nguồn chọn hero, v3 là nguồn ảnh cho row "Mới cập nhật".

Adapter vẫn mượn chéo `poster ↔ thumb` khi thiếu một trong hai — ảnh cắt sai tỉ
lệ còn hơn ô xám.

### 12. `poster_url` có thể trỏ sang host bất kỳ — và điều đó làm SẬP trang

Dữ liệu thật có phim để `poster_url` là link báo chí
(`i.ex-cdn.com/danviet.vn/...`). `next/image` **ném lỗi render** với hostname
chưa khai báo trong `images.remotePatterns`, nên đúng một phim như vậy đủ thổi
bay cả trang `/tim-kiem` — bắt được ngay khi tìm "phu sa".

Không mở `hostname: '**'` (server của mình sẽ đi fetch hộ URL bên thứ ba tuỳ ý).
Cách xử lý: `lib/image.ts` giữ danh sách host tối ưu được, `SmartImage` thấy host
lạ thì đặt `unoptimized` — trình duyệt tải thẳng, mất phần resize nhưng ảnh vẫn
hiện và trang vẫn sống.

Đi kèm: `SmartImage` bắt luôn `onError` → rơi về placeholder nội bộ. §14.1 yêu
cầu điều đó từ đầu, nhưng với mock thì mọi URL đều sống nên không ai thấy thiếu.

## Bổ sung ngoài tài liệu

**Tìm kiếm không dấu.** Tài liệu không nói, nhưng người Việt gõ "thien" và mong
ra "Thiên". `lib/text.ts` bỏ dấu hai phía khi so khớp, xử lý riêng `đ/Đ` vì NFD
không tách được ký tự này.

**Nhúng YouTube không cần script bên thứ ba.** §2.3 ghi HeroTrailer dùng
"YouTube IFrame API". Dùng `enablejsapi=1` + postMessage cho kết quả tương đương
(play/pause/mute/lặp lại, biết được nhúng có thành công không) mà không kéo thêm
script ngoài vào bundle (§12.1). Bắt buộc gửi `{event:'listening'}` sau khi
iframe load, nếu không YouTube không bao giờ gửi message về.

---

## Thích ứng mạng và thiết bị

Toàn bộ phần "nặng" của app tự co giãn theo hoàn cảnh chạy thật, thay vì phục vụ
một cấu hình duy nhất cho cả 5G lẫn 3G, cả desktop lẫn điện thoại.

**Nguồn sự thật:** `lib/network.ts` + `lib/device-store.ts`, đọc qua `useDevice()`.
Một bộ listener duy nhất cho cả app (`navigator.connection`, `online/offline`,
`matchMedia` cho hover / pointer / reduced-motion / breakpoint). Xếp hạng thành
ba tier:

| | `low` | `medium` | `high` |
|---|---|---|---|
| Điều kiện | saveData, 2G, < 1.2 Mbps, RTT > 500ms, RAM ≤ 1GB | 3G, < 4 Mbps, RTT > 270ms, ≤ 2 nhân | còn lại |
| `quality` ảnh | 45 | 60 | 75 |
| Buffer HLS | 10s / trần 30s | 20s / 60s | 30s / 120s |
| Trần chất lượng | 480p | 720p | không chặn |
| Timeout fragment | 20s TTFB, 6 lần thử | 12s, 4 lần | 10s, 3 lần |
| Trailer hero | tắt | tắt | bật |
| Hover preview | tắt | bật | bật |
| Item mỗi lượt cuộn | 12 | 18 | 24 |
| Prefetch khi hover | không | có | có |

Tier đổi giữa chừng (vào thang máy, tụt sóng) chỉ chỉnh `autoLevelCapping` —
KHÔNG dựng lại player, để người xem không mất vị trí đang phát.

**Trình phát** (`hooks/useHls.ts`, `VideoPlayer.tsx`):

- lỗi mạng được tự cứu tối đa 4 lần với backoff 0.5→4s rồi mới chuyển sang embed
  (bản cũ gọi `startLoad()` không đếm → mạng chết là lặp vô hạn, không bao giờ
  rơi xuống nguồn dự phòng)
- lỗi media: `recoverMediaError` → `swapAudioCodec` → bỏ cuộc
- có trạng thái chờ / đang kết nối lại / mất mạng hiện rõ, thay cho khung đen câm
- mất mạng rồi có lại thì tự `startLoad()` tiếp, không bắt F5
- nhớ âm lượng, tốc độ, chất lượng đã chọn cho các tập sau
- control ẩn thì ngừng `setState` theo `timeupdate` — xem toàn màn hình trên điện
  thoại không còn 4 lần render mỗi giây cho thứ không ai nhìn

**Cảm ứng và màn hình nhỏ:**

- chạm một lần = bật/tắt control, chạm đôi mép trái/phải = tua ±10s, chạm đôi
  giữa = play/pause; chuột thì giữ nguyên bấm = play/pause, bấm đôi = toàn màn hình
- vùng chạm 48px, thanh tiến độ kéo được (trước đây chỉ bấm), núm hiện sẵn
- fullscreen trên iPhone đi qua `webkitEnterFullscreen` của thẻ video —
  `requestFullscreen` trên div không tồn tại ở iOS
- `MobileMenu` cho màn < `lg`: trước đó điện thoại không có đường nào tới thể
  loại / quốc gia / năm / danh sách của tôi
- `env(safe-area-inset-*)` cho máy có tai thỏ, kể cả control khi xem ngang
- card không hover được thì hiện sẵn tên phim
- row cuộn ngang: `overscroll-behavior-x: contain` (hết row không còn "quay lại
  trang trước"), snap `proximity` thay `mandatory`, bỏ phần padding chừa cho
  hover preview

**Tải và render:**

- `content-visibility` bật lại mỗi lần row rời viewport (trước đây mất vĩnh viễn
  sau lần hiện đầu tiên); card đã mount thì giữ nguyên, không unmount lại
- HoverPreview bỏ framer-motion, chuyển sang CSS transition + `usePresence` —
  framer-motion không còn trong bundle trang chủ, chỉ còn ở route modal
- một `matchMedia` dùng chung thay cho listener `resize` của từng row (trang chủ
  có 11 row)
- AVIF + WEBP, thang `deviceSizes`/`imageSizes` khớp với kích thước card thật,
  cache 30 ngày
- `preconnect` tới CDN ảnh, `dns-prefetch` tới YouTube
- trailer hero chỉ gắn iframe khi ĐỒNG THỜI: đủ 2.5s, hero còn trong viewport,
  tab đang hiện, và tier `high`
- Web App Manifest — thêm vào màn hình chính, chạy standalone, không mất 10%
  chiều cao cho thanh địa chỉ khi xem ngang

---

## Quyết định đã chốt

**`--accent` = `#9184D9`** (tím, lấy từ `document/Lumen Streaming App.dc.html`).
§7.1 chỉ cấm đỏ Netflix, §13.4 đòi tương phản ≥ 4.5:1 trên `--bg-base` — màu này
đạt **6.2:1**. `--accent-hover` = `#B5ABFC`.

**Next.js pin ở `14.2.35`** — bản vá mới nhất của nhánh 14 mà tài liệu chỉ định.
⚠️ `npm audit` vẫn báo advisory cho toàn bộ nhánh Next < 16 (DoS/SSRF/cache
poisoning ở tầng server). Lên Next 16 sẽ sạch nhưng đổi stack so với tài liệu
(`params`/`searchParams` thành async từ 15) — để bạn quyết định.

---

## Việc tiếp theo

- [ ] Virtualize item trong row — hiện mới lazy-mount cả row, chưa cắt theo ±1 viewport (§8.3)
- [ ] Audit Lighthouse a11y ≥ 95 và hiệu năng (Phụ lục B)
- [ ] Test trên Safari — native HLS đi đường khác Chrome (Phụ lục B)
- [ ] Thay icon manifest bằng icon thật (đang tạm dùng `placeholder-poster.svg`)

Hai mục Phụ lục A chưa kiểm tra được:

- [ ] CORS của CDN HLS cho domain triển khai (§17 rủi ro #6) — cần domain thật
- [ ] Font Be Vietnam Pro weight 800 với `ế ộ ữ ỡ ẳ` — cần mắt người xem

---

Chỉ dùng cho mục đích học tập / cá nhân (§17 #12).
