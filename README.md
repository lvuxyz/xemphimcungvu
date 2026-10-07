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
| `/v1/api/home` | `getHome` | chỉ còn là phao của trang chủ khi v3 hỏng (xem sai lệch #11) |
| `/danh-sach/phim-moi-cap-nhat-v3` | `getNewlyUpdated` | RSC trang chủ — request danh sách DUY NHẤT: hero + row "Mới cập nhật" |
| `/v1/api/danh-sach/{type}` | `getListByType` | `/danh-sach/[type]` · `/api/home/{phim-bo,phim-chieu-rap,phim-le,hoat-hinh}` |
| `/v1/api/danh-sach` | `getList` | `/danh-sach` |
| `/v1/api/the-loai/{slug}` | `getByCategory` | `/the-loai/[slug]` · "Có thể bạn thích" |
| `/v1/api/quoc-gia/{slug}` | `getByCountry` | `/quoc-gia/[slug]` |
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
| `/the-loai` · `/quoc-gia` · `/nam-phat-hanh` | `getTaxonomies` · `useTaxonomyLinks` | FilterBar + tên trang taxonomy (RSC) · menu Navbar (client, CHỈ khi mở menu) |

Và một endpoint của chính app:

| Route | Nguồn | Nơi dùng |
|---|---|---|
| `/api/home/{phim-bo,phim-chieu-rap,phim-le,hoat-hinh}` | `getListByType(type, { limit: 49 })` → `excludeShown` → `toCardMovie` | 4 section lazy của trang chủ (`LazyRow`) — ISR 5 phút, 16 phim không trùng section nào khác, chỉ trả field card |

Ba hàm gộp ở tầng trên, để page không phải tự ghép:

- `getHeroSpotlight(items)` — soi 3 phim đầu, chọn phim có backdrop (ưu tiên có
  thêm trailer) làm hero. Tất cả nằm trong MỘT lượt song song, không waterfall.
- `getMovieBundle(slug)` — 4 endpoint §11.3 trong một lời gọi; ba phần bổ trợ
  fail thì về rỗng chứ không kéo cả màn xuống.
- `getRelated(movie)` — "Có thể bạn thích" theo thể loại chính, bỏ chính nó.

### Thứ tự fetch trang chủ (§11.2)

```
RSC     /danh-sach/phim-moi-cap-nhat-v3                    (1 request danh sách, ISR 5 phút)
  └─ rồi images + chi tiết của 3 ứng viên hero            (song song)
client  Phim bộ · Phim chiếu rạp · Phim lẻ · Hoạt hình — mỗi section gọi /api/home/{type}
        khi cuộn gần tới (LazyRow)
```

Trang chủ có đúng **5 section**, mỗi section tối đa `ROW_LIMIT = 16` phim → trần
80 card lấy từ API. TV Shows, quốc gia và thể loại không còn row riêng; lối vào của
chúng là dải chip "Khám phá" (`ExploreChips` — 15 link viết cứng, Server Component,
0 request, `prefetch={false}`), menu Navbar, chân trang và "Xem tất cả".

"Phim chiếu rạp" dùng `type_list = phim-chieu-rap` — không có trong §3.1 nhưng API
nhận (903 phim, lọc được như mọi loại khác). Đây là row poster 2:3 duy nhất, tên phim
luôn hiện dưới ảnh, KHÔNG có HoverPreview (preview 16:9 cùng bề rộng card poster thì
hàng nút không còn chỗ). Nó không bao giờ đứng ở chỗ đầu của các row lazy — xem chú
thích `LAZY_ROWS` về khung chờ giữ theo vị trí.

**Không phim nào hiện hai lần.** Nguồn "Mới cập nhật" gần như toàn phim bộ, và cả
hai nguồn cùng xếp theo lần cập nhật cuối — trước đây "Phim bộ" trùng 12/16 phim với
row đầu (cả 6 card nhìn thấy đầu tiên), 64 card chỉ có 48 phim. Giờ row đầu bỏ phim
đang ở hero (`homeFirstRow`), còn `/api/home/*` xin 49 phim rồi bỏ mọi phim đã có ở
màn đầu, và (với ba section theo loại phim) mọi phim "Phim chiếu rạp" đang giữ
(`excludeShown`). Các nguồn so sánh là đúng lời gọi của RSC (`getHomeFeed`) và của
section chiếu rạp — trúng data cache của Next nên không thêm request nào tới KKPhim.

Hero: tên, dòng meta, thể loại, và tóm tắt 2–3 dòng lấy từ chính lời gọi chi tiết
vốn đã có để lấy trailer (0 request thêm). Tóm tắt ẩn ở điện thoại và khi màn thấp
hơn 700px; trailer chỉ phát ở máy có chuột (hero điện thoại là khung dọc, video 16:9
bị letterbox).

Khi nào một section lazy được tải (`LazyRow` + `useHasScrolled`):

- **Chưa cuộn**: chỉ khi section lộ ≥ 64px trong màn hình. Ở 1920×1080, 1366×768,
  1280×720 và (từ khi có dải chip) 375×812, mọi section đều nằm dưới mép → **0 request
  lúc mở trang**. Section nào lộ thật thì vẫn tải luôn — để khung xám có tiêu đề nằm
  đó chờ người xem chạm vào trang thì trông như trang hỏng.
- **Đã cuộn**: nới 200px để dữ liệu về trước khi section lọt vào màn hình.

Cache và chống request thừa: TanStack Query (5 phút, dedupe theo key, `signal` huỷ
khi unmount) · `Cache-Control: max-age=300, s-maxage=300` trên `/api/home/*` · ISR
phía server nên KKPhim thấy tối đa 1 request mỗi section mỗi 5 phút, bất kể bao
nhiêu người xem.

⚠️ `next start` KHÔNG nén response của route handler (Next ghi thẳng vào response
gốc, vòng qua lớp gzip — trang HTML thì vẫn được nén). Sau CDN/reverse proxy thì
chỗ đó nén (~2.2 kB/section); tự host trần thì ~11 kB/section.

Menu Thể loại / Quốc gia / Năm KHÔNG còn đi kèm HTML của mọi trang: mỗi menu tự
tải danh sách lúc được mở lần đầu (`useTaxonomyLinks`, cache 24 giờ).

#### Đo trước / sau (24/09/2026, `next build` + `next start`, Chrome headless, cache tắt, profile trắng)

| | trước | sau |
|---|---|---|
| Request danh sách ở RSC mỗi lượt dựng trang | 2 (`/home` + v3) | **1** (v3) |
| Request section ở `scrollY = 0` — 1920×1080 / 1366×768 / 1280×720 | 4 / 4 / 3 | **0 / 0 / 0** |
| Request section ở `scrollY = 0` — 375×812 cảm ứng | 6 | **1** (section đang hiện) |
| Request section khi cuộn hết trang | 10 (thẳng tới KKPhim) | **3** (`/api/home/*`) |
| Byte section khi cuộn hết | 60.7 kB (gzip từ KKPhim) | 34.5 kB không nén · ~8 kB nếu gzip |
| Card trên trang (cuộn hết) | 198 | **64** |
| HTML trang chủ (gzip / thô) | 16.4 kB / 162 kB | **14.2 kB / 127 kB** |
| Ảnh khi cuộn hết (1366×768) | 45 ảnh · 317 kB | **25 ảnh · 197 kB** |
| CLS khi cuộn hết — 375×812 | **0.1999** (khung chờ thấp hơn row thật 80px) | **0** |
| CLS khi cuộn hết — desktop | 0.0002–0.0023 | **0** |

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

### Lượt hoàn thiện chuyển động — và năm lỗi nó lôi ra

Mục tiêu của lượt này là "mượt". Nhưng vừa mở màu ra đo thì lộ ra một lỗi lớn
hơn mọi thứ chuyển động cộng lại.

7. **33 utility `bg-…/độ-mờ` trên màu token render ra TRONG SUỐT — im lặng.**
   `tailwind.config.ts` trỏ màu vào `var(--bg-base)`, mà biến đó chứa mã hex.
   Gặp `bg-bg-base/75`, Tailwind sinh ra `rgb(#08080B / 0.75)` — sai cú pháp,
   trình duyệt bỏ nguyên khai báo, không một tiếng động. Đo trên trang đang chạy:

   | Chỗ | Trước | Sau |
   |---|---|---|
   | Gradient bảo vệ chữ navbar | `background-image: none` | gradient thật |
   | Badge FHD / số tập trên card | `rgba(0,0,0,0)` | `rgba(8,8,11,0.75)` |
   | Nền mờ sau modal | không tối đi chút nào | `bg-base/70` + blur |
   | Nền navbar sau khi cuộn | trong suốt | `bg-base/95` + blur |
   | Scrim trên/dưới của trình phát | không có | gradient thật |
   | Nền toast, mega menu, mũi tên row | trong suốt | đúng thiết kế |

   Sửa ở gốc: mỗi màu trong `tokens.css` khai báo thêm biến KÊNH (`--bg-base-rgb:
   8 8 11`), màu đầy đủ dựng lại từ chính ba kênh đó, và Tailwind trỏ vào kênh
   với `<alpha-value>`. Một nguồn số, hai cách đọc.

8. **`bg-bg-elevated/98` chưa bao giờ tồn tại.** 98 không nằm trong thang opacity
   mặc định của Tailwind, nên class đó không được sinh ra — kể cả sau khi sửa lỗi
   7. Ba chỗ dùng nó (mega menu, gợi ý tìm kiếm, menu của trình phát) đổi sang
   `/95`, mắt không phân biệt được.

9. **Mũi tên cuộn row nằm thấp hơn dải card 64px.** `.row-track` chừa 96px phía
   trên và 224px phía dưới cho card phóng to, nên `top: 50%` của vùng cuộn rơi
   hẳn xuống dưới hàng ảnh. Nay hai biến `--row-overflow-*` chuyển lên khung bao
   `.row-viewport` để mũi tên đọc được, và `.row-arrow` trừ đúng hai khoảng đó —
   đo lại: mũi tên `top 241 / cao 125`, card `top 241 / cao 125`.

10. **Bấm vào ảnh card đang phóng to không làm gì.** Lớp preview che kín card gốc
    nhưng bản thân nó chỉ có mấy nút tròn nhỏ là bấm được, nên phản xạ tự nhiên
    nhất — rê chuột vào rồi bấm giữa ảnh — rơi vào khoảng không. Nay có `Link`
    phủ kín ảnh (ẩn với bàn phím và trình đọc màn hình vì đã có nút "Xem chi tiết").

11. **Mọi phần tử `fixed` nhảy ngang 10px mỗi lần mở modal.** Khoá scroll bằng
    `overflow: hidden` làm thanh cuộn biến mất, viewport rộng ra, navbar và toast
    trôi theo (đo ở 1440: header `1430 → 1440`). Nay `html { scrollbar-gutter:
    stable }` giữ sẵn chỗ, và `useScrollLock` bỏ phần bù `padding-right` khi
    trình duyệt đã hỗ trợ — bù thêm nữa là tự tạo lại đúng cú giật đang tránh.
    Đo lại sau khi sửa: `1270 → 1270`.

Phần chuyển động, tất cả đều dùng chung `usePresence` + transition CSS (không kéo
thêm Framer Motion vào bundle initial):

| Chỗ | Trước | Sau |
|---|---|---|
| Ảnh card về | nhảy từ ô xám sang ảnh | fade 300ms (ảnh `priority` KHÔNG fade — Chrome bỏ qua phần tử `opacity: 0` khi đo LCP) |
| Đổi trang | thay nội dung tức thì | fade 300ms; lần vẽ đầu của phiên không animate, giữ nguyên LCP |
| Nền navbar ở ngưỡng cuộn | gradient bị tháo tức thì, blur bật phụt | hai lớp chồng nhau mờ chéo 300ms |
| Mega menu, gợi ý tìm kiếm, dropdown lọc | hiện/tắt tức thì | mờ + trượt 150ms cả hai chiều |
| Drawer mobile | hiện/tắt tức thì | trượt từ mép phải 300ms |
| Toast, banner mất mạng | hiện/tắt tức thì | trượt lên + mờ, gỡ khỏi store sau khi chạy xong |
| Đóng modal chi tiết | tắt phụt (route tháo cả cây, `AnimatePresence` vô dụng) | thu nhỏ + mờ 200ms rồi mới `router.back()` |
| Mũi tên row ở hai mép | biến mất khỏi DOM dưới con trỏ | mờ đi, `disabled` + `aria-hidden` |
| Skeleton trang chủ | khung không khớp trang thật | hero full-bleed `56vw` + row đúng breakpoint card |

Mọi chuyển tiếp mới đều mang `data-motion="fade"` — ngoại lệ duy nhất §9.4 cho
phép giữ lại khi người dùng bật giảm chuyển động.

Bundle initial: **141 kB** trang chủ (140 kB trước lượt hoàn thiện — toàn bộ phần
chuyển động thêm vào tốn 1 kB vì dùng CSS transition chứ không thêm thư viện;
trước khi nối API là 165 kB, bỏ chỉ mục tìm kiếm tĩnh trả lại 25 kB), dưới ngưỡng
180 KB của §12.1. Phần lớn còn lại là
Framer Motion (~50 kB), thứ §9.1 yêu cầu. Nếu cần cắt thêm: `VideoPlayer` đã
code-split sẵn, bước tiếp theo là split `DetailModal`.

### Modal chi tiết dính lại trên trang phát

Mở modal một phim từ trang chủ rồi bấm **Phát**: URL đổi sang `/xem/{slug}/{ep}`,
`<title>` đổi thành "— Tập 01", `<video>` đã có trong DOM và đang chạy — nhưng
modal chi tiết vẫn nằm nguyên trên cùng, che kín màn hình xem phim. Đo lúc đứng ở
trang phát: `document.querySelectorAll('[role=dialog]').length === 1`,
`document.body.style.overflow === 'hidden'` (scroll vẫn bị khoá).

Không riêng nút Phát. Mọi lối ra khỏi modal bằng điều hướng mềm đều dính: bấm một
tập ở "Chọn tập", bấm chip từ khoá sang `/tim-kiem`. Nguyên nhân là hành vi có
ghi trong tài liệu Next (Parallel Routes, mục *Soft Navigation*): điều hướng mềm
sang route mà một slot không khớp thì slot đó **giữ nguyên** nội dung đang hoạt
động. `children` đổi sang trang phát, `@modal` thì vẫn là `(.)phim/[slug]`.

Hai cách thường được mách nhau đều không ăn:

| Thử | Kết quả |
|---|---|
| `@modal/default.tsx` trả null | Đã có sẵn từ đầu — chỉ được hỏi tới ở lần tải CỨNG |
| `@modal/[...catchAll]/page.tsx` trả null | Dev log in `Compiling /[...catchAll]`, modal vẫn dính — client không hỏi lại slot |

Nên chặn ở chính component: `DetailModal` đọc `usePathname()`, không còn là
đường dẫn chi tiết thì trả null. Tháo cả cây chứ không phải ẩn đi — effect dọn
dẹp chạy theo nên scroll lock nhả ra, bẫy focus và phím ESC gỡ đi. Bấm Back từ
trang phát thì slot được khôi phục, `pathname` khớp lại, modal hiện ra như cũ.

Phép so nằm ở `isDetailPath()` trong `lib/routes.ts` chứ không phải
`startsWith('/phim/')` rải trong component: `/phim/id/{id}` cũng khớp tiền tố mà
lại là route tra cứu rồi redirect. Đúng MỘT đoạn sau `/phim` mới tính.

Đo lại sau khi sửa, đứng ở `/xem/{slug}/tap-01`: `dialog 0`, `video 1`,
`body.style.overflow` rỗng.

#### Rà lại toàn bộ lối ra vào modal

Lỗi trên chỉ lộ ở nút Phát, nhưng nguyên nhân nằm ở tầng route nên phải đi hết
mọi cặp (điều hướng mềm) × (màn nền). Đo bằng
`document.querySelectorAll('[role=dialog]').length` ngay sau khi điều hướng xong:

| Lối đi | Trước | Sau |
|---|---|---|
| modal → **Phát** → `/xem/{slug}/{ep}` | dialog 1 đè player | dialog 0 |
| modal → chọn một tập → `/xem/…` | dialog 1 | dialog 0 |
| modal → chip từ khoá → `/tim-kiem` | dialog 1 | dialog 0 |
| modal → phim liên quan → `/phim/{khác}` | đổi nội dung tại chỗ | giữ nguyên |
| modal → ESC / ✕ / bấm nền | về trang nền | giữ nguyên |
| Back từ trang phát → `/phim/{slug}` | modal hiện lại | giữ nguyên |
| Forward trở lại modal | modal hiện lại | giữ nguyên |
| tải cứng `/phim/{slug}` | trang full | giữ nguyên |
| trang phát → navbar → `/danh-sach/{type}` | player tháo sạch | giữ nguyên |
| trang phát → gợi ý tìm kiếm → `/phim/{slug}` | đi cứng, ra trang full | giữ nguyên |

Đi hết trên bốn màn nền — trang chủ, `/danh-sach/{type}`, `/tim-kiem`, và màn
375×812 — cùng một kết quả. `body.style.overflow` nhả về rỗng ở mọi lối ra.

### `<title>` không đi theo modal

Rà cái trên thì lộ ra người anh em cùng gốc: URL đổi mà phần đầu trang thì không.
Đứng ở `/phim/te-cong-hang-long-tru-yeu` với modal đang mở, tab vẫn đề
`Phim bộ · Xem phim cùng vũ` — tên của trang NỀN. Mục lịch sử của URL đó cũng
được ghi bằng cái tên sai ấy, và F5 thì lại ra tên đúng: cùng một URL, hai cái
tên, tuỳ người dùng đến bằng đường nào.

Cùng một nguyên nhân: metadata của Next chỉ đọc theo nhánh `children`, slot
không có phần. Thử `generateMetadata` trong `@modal/(.)phim/[slug]/page.tsx` thì
còn tệ hơn — MỌI route slot không khớp lăn ra 404 (`/danh-sach/phim-bo` trả 404
ngay ở lần tải cứng). Đã gỡ.

Nên modal tự set `document.title`, và lúc tháo chỉ trả lại tên cũ khi KHÔNG ai
đổi title sau mình — bấm Phát thì Next đã kịp đặt tên trang phát trước khi
cleanup chạy, trả về lúc đó là dán ngược tên cũ đè lên tên đúng.

Hai nơi dựng title phải ra cùng kết quả, nên phần chung tách ra dùng lại:
`SITE_NAME` + `pageTitle()` (`lib/constants.ts`) và `movieTitle()`
(`lib/derive.ts`) — cái sau dùng luôn cho `generateMetadata` của trang full.

| Đứng ở | Trước | Sau |
|---|---|---|
| modal mở từ `/danh-sach/phim-bo` | `Phim bộ · …` | `Người Chạy Xuyên Không Gian (Phần 2) (2026) · …` |
| đổi sang phim liên quan | không đổi | đổi theo phim mới |
| bấm Phát sang trang phát | `— Tập 01 · …` | `— Tập 01 · …` (không bị đè) |
| ESC về trang nền | `Phim bộ · …` | `Phim bộ · …` |
| tải cứng `/phim/{slug}` | đúng sẵn | giữ nguyên, cùng một chuỗi |

---

## Ba lỗi trên màn hình xem phim

Rà lỗi modal thì đi qua trang phát ở khổ 375 và nhặt thêm được ba thứ.

### 1. Danh sách tập hiện một tập hai lần

`Tập 01 · Tập 02 · Tập 03 · Tập 03`, kèm cảnh báo trong console: *"Encountered
two children with the same key … tap-03"*. Nguồn trả hai mục cùng `slug` — hôm
sau chính nguồn tự sửa mục thứ hai thành `tap-04`, nên đây là lỗi dữ liệu thoáng
qua, loại sẽ còn quay lại.

Không chỉ là một dòng thừa: React được phép bỏ hoặc nhân đôi node khi key trùng.
`normalizeEpisodes` giờ lọc trùng theo slug, giữ mục ĐẦU — không mất gì, vì slug
là thứ duy nhất đi vào URL nên hai mục trùng trỏ về đúng một trang, và
`resolveEpisode` dù sao cũng chỉ trả mục đầu. Mục rỗng slug cũng bỏ:
`/xem/{phim}/` không phải một địa chỉ. Tab chọn server đổi sang key theo vị trí,
vì tên server cũng do API đặt và cũng không có gì bảo đảm là duy nhất.

### 2. Nút điều khiển bị xén cụt ở khổ điện thoại

Player 16:9 ở khổ 375 chỉ cao **193px**, mà hai thanh điều khiển với đệm của
desktop cộng lại là **224px**. Phần thừa rơi ra ngoài và bị `overflow-hidden` của
khung cắt mất — thứ bị cắt là đáy hàng nút: đo được nút Phát / Toàn màn hình nằm
ở `164→212` trong khung cao `193`, tức vùng chạm 48px **chỉ còn 29px**, dưới mức
44px mà chính app này ép ở mọi chỗ khác.

Đệm hẹp lại dưới `sm` (`p-2`), giữ nguyên `pb-8`/`pt-8` từ `sm` trở lên nơi
player đủ cao cho quãng chạy gradient. Đo lại: 375 → nút thấp nhất cách đáy 8px;
768 và desktop → 16px.

### 3. Prompt "Tiếp tục xem" đè lên thanh tiêu đề

Cùng gốc với lỗi trên: `bottom-20` là con số chọn cho player cao của desktop. Ở
375, prompt chiếm `101→193` còn thanh tiêu đề `110→130` — hai khối chữ nằm chồng
lên nhau.

Thu nhỏ hay dời chỗ đều chỉ đẩy va chạm sang chỗ khác: trừ hai thanh ra, khoảng
trống thật sự trong một player cao 193px không đủ cho một dải hỏi kèm hai nút.
Nên prompt ra hẳn ngoài khung, nằm **dưới** player — hết va chạm ở mọi khổ màn,
và dùng lại đúng hình dạng của dải đếm ngược auto-next ngay bên dưới nó.

⚠️ Đây là **sai lệch có chủ đích so với §10.5** (spec mô tả prompt đè lên mặt
video). Đổi lại: trong chế độ toàn màn hình prompt không hiện — chấp nhận được,
vì nó chỉ xuất hiện lúc mới vào tập, trước khi người xem bật toàn màn hình.

---

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
`thumb_url`. Từ 24/09/2026 trang chủ chỉ gọi v3 (vừa là nguồn hero vừa là row
"Mới cập nhật"); `/home` chỉ còn được gọi khi v3 hỏng. Kiểm tra lại cùng ngày: hai
endpoint vẫn trả đúng 24 phim, cùng thứ tự — và v3 **lờ tham số `limit`**, nên row
đầu được cắt còn 16 ngay trên server trước khi vào HTML.

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

## Cá nhân hoá cho người xem

Nguyên tắc nền: **HTML từ server vẫn là một bản dùng chung cho mọi người.** Trang
chủ là ISR 300s và cả CDN dùng chung một bản; chạm `cookies()` trong RSC để biết
người nào đang xem là mất full-route cache cho *mọi* khách, kể cả người mới. Còn
PPR — cách của Next cho đúng chuyện "vỏ tĩnh, lỗ động" — thì bản 14.2.35 đang pin
ném lỗi, nó chỉ bật được trên canary. Nên mọi thứ mang tính cá nhân chạy ở client,
sau paint, và chỉ ở những chỗ HTML đó vốn còn trống.

**Index tiến độ xem** (`lib/storage.ts`). Một key `watch-index` giữ danh sách phim
đang xem: tập nào, tới đâu, kèm ảnh chụp đủ để vẽ card (tên, poster, thumb, tập).
Đọc một lần rồi giữ trong RAM cho cả phiên.

| | Trước | Sau |
|---|---|---|
| Khởi động app, đã xem 200 tập | 200 `getItem` + 200 `JSON.parse` đồng bộ | 1 + 1 |
| Mở sidebar một bộ 40 tập | 40 `getItem` (mỗi lần đổi server thêm 40) | 0 |
| Mỗi `readJson` | 1 `setItem` + 1 `removeItem` thăm dò | 0 |

Index là CACHE, không phải nguồn sự thật: `watch:{slug}:{ep}` vẫn là bản ghi bền
của từng tập và index dựng lại được từ chúng. Mất index thì mất thứ tự "gần đây" và
snapshot, không mất vị trí đang xem của ai. Người đã dùng app từ trước chịu đúng
MỘT lượt quét localStorage, ở lần mở đầu tiên sau khi cập nhật, để gom key cũ vào.

⚠️ Key tên `watch-index` chứ không `watch:index`: mọi vòng quét theo tiền tố
`watch:` sẽ coi nó là một key tiến độ, thấy `updatedAt` không hợp lệ rồi xoá sạch.

**Row "Tiếp tục xem"** — dựng hoàn toàn từ localStorage, KHÔNG một request nào. Đây
là phần thu lãi của snapshot: không có nó thì row phải gọi `/phim/{slug}` cho từng
phim, mấy request nối tiếp ngay trên màn hình đầu — đúng thứ §11.2 cấm.

**Chống CLS bằng một script đồng bộ.** Row chỉ dựng được ở client, nên chèn nó lúc
hydrate là đẩy cả "Mới cập nhật" xuống — mà row đó đang trong viewport. Cách đi:
một script ~200 byte đứng TRƯỚC chỗ chừa trong HTML, đọc `watch-index` và đánh dấu
`<html data-continue-watching>`; CSS `.continue-slot` lấy dấu đó để chừa sẵn chiều
cao ngay lượt vẽ đầu. Khách mới không có dấu → không chừa gì, không thấy khoảng
trống nào. Điều kiện trong script phải khớp CHÍNH XÁC bộ lọc của row (cùng ngưỡng
`PLAYER.resumeMinPosition`), nếu không chỗ chừa hiện ra rồi xẹp lại.

Vì script đặt attribute trước khi React hydrate, `<html>` phải có
`suppressHydrationWarning` — cùng cách next-themes chống nháy theme.

**Nút hero đổi nhãn** "Phát" → "Tiếp tục", href mang theo `?t=`. Nhãn dài hơn thì
đẩy nút bên cạnh, nên: `sm:min-w` chừa sẵn cho nhãn dài từ 640px lên, và nhãn phụ
ngắn lại ở khổ điện thoại để cả hai nhãn còn chỗ trên một dòng. Đo ở 360px: khối
nút chỉ rộng 331px mà "Phát" + "Thông tin khác" đã chiếm 303px — thiếu hai việc đó
là nút thứ hai rơi xuống dòng, dịch 60px. Nhãn cũng KHÔNG mang số tập vì
"Tiếp tục Tập 12" rộng gần gấp đôi "Phát"; số tập và thời gian còn lại nằm ở row.

**Vạch tiến độ trên card** (`MovieCard`) đọc từ store dùng chung chứ không tự đọc
storage: trang chủ hơn trăm card, mỗi card tự đọc là hơn trăm lượt chạm đồng bộ
ngay lúc hydrate. Vạch `absolute` ở đáy ảnh nên xuất hiện mà không dịch gì.

**Trọng số sở thích** (`lib/taste.ts`) — KHÔNG có key `profile` riêng. Profile tích
luỹ dần (mỗi tín hiệu cộng một ít) thì phải tự chống cộng trùng, và một lần cộng
sai là sai vĩnh viễn. Suy ra từ index thì hàm thuần, tính lại lúc nào cũng ra cùng
kết quả, và phân rã theo thời gian miễn phí vì `updatedAt` đã có sẵn.

```
sức nặng một phim = (1 + tối đa 2 theo số tập xem xong + tối đa 1 theo độ sâu)
                    × 0.97 ^ (số tuần kể từ lần xem gần nhất)
thể loại × 1.0   ·   quốc gia × 0.8   ·   loại phim × 0.5
```

Ba hệ số cuối là bắt buộc, không phải trang trí: `type` chỉ có 4 giá trị và MỌI
phim đều thuộc đúng một cái, nên không hạ nó xuống thì nó gom hết điểm rồi luôn
đứng đầu — người xem phim bộ nào cũng thấy "Phim bộ" ở trên, tức là không cá nhân
hoá gì cả. Hai test bắt đúng lỗi này.

Để tính được trọng số, `WatchSnapshot` chép thêm `type` + slug thể loại + slug quốc
gia lúc ghi: index chỉ giữ slug phim, mà tra ngược slug → thể loại là một lời gọi
`/phim/{slug}` cho mỗi phim.

**`finished` — tín hiệu mạnh nhất từng tự xoá chính nó.** Xem xong một tập là key
tiến độ của tập đó bị dọn (§10.5), nên xem hết một bộ 12 tập là bộ đó biến mất sạch
khỏi index: đúng những người xem nhiều nhất lại là những người app không biết gì về
sở thích. Giờ `markCompleted()` đếm số tập đã xong và giữ entry lại (`eps` rỗng → nó
không còn là "đang xem" nhưng vẫn là "đã xem"). Nó tách khỏi `clearWatchProgress`
("Xem từ đầu") vì hai việc nói hai điều trái ngược nhau về cùng một tập.

> ⚠️ Từ 24/09/2026 trang chủ không còn row thể loại (row lazy hiện tại: Phim bộ · Phim
> chiếu rạp · Phim lẻ · Hoạt hình — xem "Thứ tự fetch trang chủ"). Không còn row thể
> loại nào để nhường chỗ, nên row "Vì bạn đã xem X" không xuất hiện nữa; cá nhân hoá
> trên trang chủ chỉ còn đảo thứ tự các row đó ("Phim chiếu rạp" không có khoá sở
> thích nên chỉ tụt xuống, không bao giờ lên chỗ đầu). Logic trong `lib/taste.ts` giữ nguyên; muốn có lại thì phải thêm row thể loại VÀ
> cho `/api/home` nhận nguồn thể loại (whitelist hiện chỉ có bốn `type_list` —
> `PersonalizedRows` bỏ qua row nào không có section tương ứng).

**Thứ tự 10 row lazy** theo trọng số, sắp ĐỨNG YÊN (row cùng điểm giữ nguyên thứ tự
cũ — phần lớn row có điểm 0, không có nó thì mỗi lượt tải là một thứ tự khác và
trang chủ trông như bị xáo). Số row KHÔNG đổi: row "Vì bạn đã xem X" chiếm chỗ một
row thể loại có sẵn chứ không chèn thêm. Bằng điểm thì ưu tiên thể loại đã có row —
một phim mang 3–4 thể loại và tất cả cùng điểm, mà chọn nhầm nhánh thì mất một row
VÀ có hai row cùng nội dung (`hoat-hinh` vừa là slug thể loại vừa là `type_list`).

⚠️ `key` của các row phải theo VỊ TRÍ, không theo id row. Key theo id thì React DỜI
node DOM khi thứ tự đổi, node bị tháo ra cắm lại làm `IntersectionObserver` của
`LazyRow` bắn theo hình học tạm thời giữa lúc dời, và hai row vừa lên đầu tưởng mình
đã vào viewport → fetch ngay. Đo trên bản build thật: **2 request tới KKPhim ở
`scrollY = 0`** (không có cá nhân hoá thì 0). Key theo vị trí thì không node nào
dời, React chỉ đổi props — trạng thái "đã vào viewport" thuộc về vị trí chứ không
thuộc về row, và đó mới đúng nghĩa.

**Prefetch một route khi máy rỗi**: mục đầu của "Tiếp tục xem" là cú bấm có xác suất
cao nhất trên cả trang chủ. `requestIdleCallback` + chỉ tier `high`, đúng một route.

**Danh sách của tôi là tín hiệu thứ hai** (`LIST_WEIGHT = 1.2`, phân rã theo `addedAt`,
chỉ tính 20 phim lưu gần nhất). Lưu một phim là một lời nói rõ về sở thích — rõ hơn
việc bấm vào xem thử — nhưng ý định vẫn là bằng chứng yếu hơn thời gian đã bỏ ra, nên
nó nằm trên mức "đã mở xem" (1) và dưới mọi mức có thời gian xem thật. Đây cũng là
tín hiệu DUY NHẤT có được với người mới: đo thật, một người chưa xem gì mà đã lưu 3
phim kinh dị Hàn thì trang chủ ra "Kinh dị · Hàn Quốc · Phim lẻ" ở ba row đầu.

Ba field taxonomy trong `MyListEntry` để TUỲ CHỌN thay vì viết `migrate` cho persist:
entry lưu từ trước bản này không biết loại phim của nó, và "không biết" là một trạng
thái thật — migrate mà điền `single` thì mọi phim cũ trong danh sách bỗng thành phiếu
bầu cho "Phim lẻ".

⚠️ Hai cái chốt ở `PersonalizedRows` khi dùng danh sách này, cả hai đều cần:
`useMyListHydrated()` (persist của zustand đọc localStorage ĐỒNG BỘ ngay trong
`create()`, nên dùng thẳng là thứ tự row lượt render đầu khác HTML server → hydration
mismatch; `entries` của `useWatchStore` không có vấn đề này vì nó chỉ nạp trong
effect), và cờ `personalized` (cổng tắt chỉ rút `entries` của chính store đó, danh
sách này đến từ store khác nên phải tự đi qua cùng cái cổng).

Và vì "Vì bạn đã xem X" buộc phải nói về một phim ĐÃ XEM: khi thể loại đứng đầu đến
hoàn toàn từ phim đã lưu mà chưa xem, `topCategory` đi tiếp xuống thể loại kế tiếp
thay vì để cả dòng tiêu đề đó lặng lẽ biến mất.

**Tắt được cá nhân hoá** — công tắc trong navbar (dropdown ⚙ từ `lg` lên, chân menu
điện thoại ở dưới). Nó tồn tại không phải vì dữ liệu đi đâu — không có gì rời khỏi
máy — mà vì máy dùng chung trong gia đình là chuyện thường, và row "Tiếp tục xem"
giữa trang chủ kể cho cả nhà biết tối qua ai xem gì.

Tắt được ép ở ĐÚNG MỘT CHỖ: `entries` của store về rỗng. Nhờ vậy mọi mặt hiển thị tự
tắt theo mà không nơi nào phải tự kiểm cờ — row "Tiếp tục xem", thứ tự row, nút hero,
vạch tiến độ trên card. Rải cờ ra từng chỗ thì chỉ cần quên một chỗ là lịch sử vẫn
lộ ở đó.

Nó KHÔNG xoá gì và KHÔNG tắt việc lưu tiến độ: trình phát vẫn nhớ chỗ đang xem của
từng tập (§10.5), bật lại thì mọi thứ còn nguyên. **Xoá** thì có nút riêng ngay dưới
công tắc (xác nhận hai bước tại chỗ, không `window.confirm`): nó xoá index và mọi key
`watch:`, kể cả key mồ côi index không biết tới — đây là chỗ duy nhất còn quét toàn bộ
localStorage ngoài `rebuildIndex`, và ở đây quét là đúng vì sót một key khi người dùng
vừa bấm xoá là sai nặng hơn nhiều so với tốn vài ms. Nó KHÔNG chạm `my-list` (thứ
người dùng tự tay chọn) và KHÔNG bật lại cá nhân hoá hộ ai. Cờ nằm ở key riêng `personalized`
chứ không trong `settings` hay trong index, vì `CONTINUE_PROBE` phải đọc nó trước
lượt vẽ đầu — đọc một key vài byte khác hẳn parse cả index 14 kB để biết một cờ.

### Đã đo được gì

Trên **bản build production** (`next build` + `next start`), trang chủ, có hồ sơ sở
thích thật (xem một tập anime Nhật):

| | |
|---|---|
| CLS | **0** (không một entry layout-shift nào) |
| Request tới KKPhim ở `scrollY = 0` | **0** — mốc §11.2 còn nguyên |
| Prefetch | đúng 1 route, chính tập đang xem dở |
| Thứ tự row | Tiếp tục xem · Mới cập nhật · Vì bạn đã xem … · Nhật Bản · Hoạt hình · rồi phần còn lại theo thứ tự cũ |
| Trang chủ | vẫn `○ (Static)` trong bảng build — cá nhân hoá KHÔNG làm nó thành dynamic |
| First Load JS | 146 kB |

Ở dev, thêm hai khổ màn: 360px và 1280px, cả hai trạng thái (có và không có phim
đang xem) → CLS 0 – 0.001.

⚠️ Một thứ KHÔNG kiểm được trong phiên đó: row lazy có fetch khi cuộn tới hay không.
`IntersectionObserver` không bắn khi cửa sổ trình duyệt bị ẩn (`document.hidden`),
nên phần đó chỉ còn lý lẽ: cùng `LazyRow`, cùng hook, và hành vi giống nhau y hệt
giữa có và không có cá nhân hoá.

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

- [ ] Kiểm lazy fetch khi cuộn trên máy có cửa sổ hiện (IntersectionObserver không
      bắn khi cửa sổ bị ẩn)
- [ ] Virtualize item trong row — hiện mới lazy-mount cả row, chưa cắt theo ±1 viewport (§8.3)
- [ ] Audit Lighthouse a11y ≥ 95 và hiệu năng (Phụ lục B)
- [ ] Test trên Safari — native HLS đi đường khác Chrome (Phụ lục B)
- [ ] Thay icon manifest bằng icon thật (đang tạm dùng `placeholder-poster.svg`)

Hai mục Phụ lục A chưa kiểm tra được:

- [ ] CORS của CDN HLS cho domain triển khai (§17 rủi ro #6) — cần domain thật
- [ ] Font Be Vietnam Pro weight 800 với `ế ộ ữ ỡ ẳ` — cần mắt người xem

---

Chỉ dùng cho mục đích học tập / cá nhân (§17 #12).
