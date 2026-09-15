# TÀI LIỆU KỸ THUẬT — WEB APP XEM PHIM

**Phiên bản:** 1.0
**Ngày:** 15/09/2026
**Nguồn dữ liệu:** KKPhim Public API (`https://phimapi.com`)
**Stack:** Next.js 14 App Router · TypeScript · TailwindCSS · Framer Motion · TanStack Query · hls.js · Zustand

---

## MỤC LỤC

1. [Tổng quan](#1-tổng-quan)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Đặc tả API](#3-đặc-tả-api)
4. [Tầng chuẩn hóa dữ liệu (Adapter)](#4-tầng-chuẩn-hóa-dữ-liệu-adapter)
5. [Data model & TypeScript types](#5-data-model--typescript-types)
6. [Bản đồ route](#6-bản-đồ-route)
7. [Design system](#7-design-system)
8. [Đặc tả component](#8-đặc-tả-component)
9. [Đặc tả motion](#9-đặc-tả-motion)
10. [Video player](#10-video-player)
11. [Chiến lược caching & fetch](#11-chiến-lược-caching--fetch)
12. [Ngân sách hiệu năng](#12-ngân-sách-hiệu-năng)
13. [Accessibility](#13-accessibility)
14. [Xử lý lỗi](#14-xử-lý-lỗi)
15. [Cấu trúc thư mục](#15-cấu-trúc-thư-mục)
16. [Lộ trình triển khai](#16-lộ-trình-triển-khai)
17. [Rủi ro & vấn đề đã biết](#17-rủi-ro--vấn-đề-đã-biết)

---

## 1. TỔNG QUAN

### 1.1 Mục tiêu

Xây dựng frontend web xem phim đạt chất lượng production, trải nghiệm và hiệu ứng tương đương Netflix, sử dụng API công khai của KKPhim.

### 1.2 Phạm vi

**Trong phạm vi:**
- Toàn bộ tầng frontend (UI, motion, state, data layer)
- Video player tùy biến với HLS
- Duyệt phim, tìm kiếm, lọc, xem chi tiết, phát video
- Lưu tiến độ xem và danh sách cá nhân (localStorage)

**Ngoài phạm vi:**
- Backend riêng, database
- Hệ thống tài khoản / đăng nhập
- Thanh toán
- CMS quản trị

### 1.3 Tiêu chí thành công

| Tiêu chí | Ngưỡng |
|---|---|
| LCP | < 2.0s |
| CLS | < 0.05 |
| INP | < 200ms |
| Frame rate khi hover carousel | ≥ 58fps |
| Thời gian từ click Play đến khung hình đầu | < 2.5s |
| Lighthouse Accessibility | ≥ 95 |

---

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Sơ đồ tầng

```
┌───────────────────────────────────────────────────┐
│  PRESENTATION                                     │
│  app/ (RSC) · components/feature · components/ui  │
└──────────────────────┬────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────┐
│  STATE                                            │
│  TanStack Query (server state)                    │
│  Zustand (UI state: modal, player, my-list)       │
└──────────────────────┬────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────┐
│  DATA ACCESS                                      │
│  lib/api.ts       — HTTP client, retry, timeout   │
│  lib/normalize.ts — ADAPTER (bắt buộc)            │
│  lib/image.ts     — resolve URL + WEBP loader     │
└──────────────────────┬────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────┐
│  EXTERNAL                                         │
│  phimapi.com · phimimg.com CDN · HLS CDN · YouTube│
└───────────────────────────────────────────────────┘
```

### 2.2 Nguyên tắc kiến trúc

1. **Không component nào chạm trực tiếp vào raw response.** Mọi dữ liệu phải đi qua `normalize.ts`.
2. **Server Component mặc định.** Chỉ đánh `"use client"` khi cần state, effect, hoặc event handler.
3. **Một nguồn sự thật cho URL.** Filter, phân trang, modal đều phản ánh trong URL — reload phải ra đúng trạng thái.
4. **Fail mềm.** API thiếu field không được làm sập UI; luôn có fallback hình ảnh và fallback player.

### 2.3 Server vs Client Component

| Thành phần | Loại | Lý do |
|---|---|---|
| Trang chủ, trang danh sách | Server | Fetch dữ liệu ban đầu, tốt cho LCP/SEO |
| HeroBillboard (khung + ảnh) | Server | Ảnh là LCP element |
| HeroTrailer | Client | YouTube IFrame API, IntersectionObserver |
| ContentRow | Client | Scroll, arrow, virtualize |
| MovieCard / HoverPreview | Client | Hover state, timer |
| DetailModal | Client | Animation, focus trap |
| VideoPlayer | Client | hls.js, keyboard, media events |
| Navbar | Client | Scroll listener, search |

---

## 3. ĐẶC TẢ API

Base URL: `https://phimapi.com`
Header bắt buộc: `accept: application/json`
Không cần API key. Không giới hạn rate công bố (vẫn nên throttle phía client).

### 3.1 Nhóm danh sách

| Endpoint | Mô tả |
|---|---|
| `GET /v1/api/home` | Tổng hợp trang chủ — **gọi đầu tiên** |
| `GET /danh-sach/phim-moi-cap-nhat?page=` | Phim mới (bản cũ) |
| `GET /danh-sach/phim-moi-cap-nhat-v2?page=` | Phim mới (v2) |
| `GET /danh-sach/phim-moi-cap-nhat-v3?page=` | Phim mới (v3) |
| `GET /danh-sach/{type_list}` | Danh sách theo loại, bản đơn giản |
| `GET /v1/api/danh-sach/{type_list}` | Danh sách theo loại, đủ filter |
| `GET /v1/api/danh-sach?page=` | Danh sách tổng hợp, không cần slug |
| `GET /v1/api/the-loai/{slug}` | Phim theo thể loại |
| `GET /v1/api/quoc-gia/{slug}` | Phim theo quốc gia |
| `GET /v1/api/nam/{year}` | Phim theo năm |
| `GET /v1/api/tim-kiem?keyword=` | Tìm kiếm |

**`type_list` hợp lệ:** `phim-bo`, `phim-le`, `tv-shows`, `hoat-hinh`, `phim-vietsub`, `phim-thuyet-minh`, `phim-long-tieng`

**Filter dùng chung:**

| Param | Giá trị | Ghi chú |
|---|---|---|
| `page` | int | Dùng `totalPages` để biết giới hạn |
| `sort_field` | `modified.time` \| `_id` \| `year` | |
| `sort_type` | `asc` \| `desc` | |
| `sort_lang` | `vietsub` \| `thuyet-minh` \| `long-tieng` | |
| `category` | slug | Lấy từ `/the-loai` |
| `country` | slug | Lấy từ `/quoc-gia` |
| `year` | int | 1911 → hiện tại |
| `limit` | int | **Tối đa 64** |

### 3.2 Nhóm chi tiết phim

| Endpoint | Shape | Ghi chú |
|---|---|---|
| `GET /phim/{slug}` | Format 1 | `episodes` **tách ngoài** `movie` |
| `GET /phim/id/{_id}` | Format 1 | Tra theo `_id` |
| `GET /tmdb/{movie\|tv}/{id}` | Format 1 | Tra theo TMDB ID |
| `GET /imdb/title/{ttid}` | Format 1 | Tra theo IMDB ID |
| `GET /v1/api/phim/{slug}` | Format 2 | Bọc `data.item`, `episodes` **bên trong** item |

### 3.3 Nhóm bổ trợ chi tiết

| Endpoint | Dùng cho |
|---|---|
| `GET /v1/api/phim/{slug}/images` | **Backdrop hero + logo title** |
| `GET /v1/api/phim/{slug}/peoples` | Cast row có avatar |
| `GET /v1/api/phim/{slug}/keywords` | Tag chips |

> Ba endpoint này là yếu tố quyết định chất lượng thị giác. Nếu bỏ qua `/images`, hero buộc phải dùng `thumb_url` độ phân giải thấp và sẽ lộ pixel ở màn hình lớn.

### 3.4 Nhóm danh mục

| Endpoint | Cache |
|---|---|
| `GET /the-loai` · `GET /v1/api/the-loai` | 24 giờ |
| `GET /quoc-gia` · `GET /v1/api/quoc-gia` | 24 giờ |
| `GET /nam-phat-hanh` | 24 giờ |

### 3.5 Ảnh

```
GET /image.php?url={absoluteImageUrl}   →  trả về WEBP
```

Dùng làm custom loader cho `next/image`. CDN gốc: `https://phimimg.com`.

---

## 4. TẦNG CHUẨN HÓA DỮ LIỆU (ADAPTER)

### 4.1 Vấn đề

API trả về **4 shape khác nhau**. Đây là nguồn bug lớn nhất của dự án nếu không xử lý tập trung.

**Shape A — `/danh-sach/*`** — phẳng, ảnh URL **tuyệt đối**:
```jsonc
{
  "status": true,
  "msg": "done",
  "items": [ /* MovieItem[] */ ],
  "pagination": {
    "totalItems": 30027,
    "totalItemsPerPage": 24,
    "currentPage": 1,
    "totalPages": 1252,
    "updateToday": 3
  }
}
```

**Shape B — `/v1/api/*` (list)** — bọc `data`, ảnh URL **tương đối**:
```jsonc
{
  "status": true,
  "msg": "",
  "data": {
    "seoOnPage": { },
    "breadCrumb": [ ],
    "items": [ /* MovieItem[] — poster_url là path tương đối */ ],
    "params": { "pagination": { } },
    "APP_DOMAIN_CDN_IMAGE": "https://phimimg.com",
    "type_list": "phim-bo"
  }
}
```

**Shape C — `/phim/{slug}`** — `episodes` tách ngoài:
```jsonc
{ "status": true, "msg": "", "movie": { }, "episodes": [ ] }
```

**Shape D — `/v1/api/phim/{slug}`** — `episodes` nằm trong `item`:
```jsonc
{ "status": true, "msg": "", "data": { "seoOnPage": {}, "breadCrumb": [], "item": { "episodes": [ ] } } }
```

### 4.2 Hợp đồng adapter

```ts
// lib/normalize.ts

export function normalizeList(raw: unknown): {
  items: Movie[];
  pagination: Pagination;
};

export function normalizeDetail(raw: unknown): {
  movie: MovieDetail;
  episodes: EpisodeServer[];
};

export function resolveImage(path?: string, cdnBase?: string): string;
```

**Quy tắc `resolveImage`:**
```
path rỗng/undefined       → trả về ảnh placeholder nội bộ
path bắt đầu bằng "http"  → giữ nguyên
ngược lại                 → join(cdnBase ?? "https://phimimg.com", path)
```

**Quy tắc bắt buộc:**
- Mọi truy cập field dùng optional chaining.
- Field thiếu → giá trị mặc định an toàn, **không throw**.
- Component **tuyệt đối không** import raw response type.
- Viết unit test cho cả 4 shape với fixture JSON thật.

---

## 5. DATA MODEL & TYPESCRIPT TYPES

### 5.1 Type sau chuẩn hóa

```ts
// types/movie.ts

export type MovieType = "single" | "series" | "hoathinh" | "tvshows";

export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
}

export interface RatingSource {
  id: string | null;
  vote_average: number;
  vote_count: number;
}

export interface Movie {
  id: string;                 // từ _id
  name: string;
  slug: string;
  originName: string;
  type: MovieType;
  poster: string;             // đã resolve, dọc 2:3
  thumb: string;              // đã resolve, ngang
  duration: string;           // "23 phút/tập" | "100 phút"
  episodeCurrent: string;     // "Tập 33" | "Hoàn Tất (24/24)" | "Full"
  quality: string;            // "FHD" | "HD"
  lang: string;               // "Vietsub + Thuyết Minh"
  year: number;
  subExclusive: boolean;      // sub_docquyen
  modifiedAt: string;         // ISO
  tmdb: RatingSource & { type: "tv" | "movie"; season: number | null };
  imdb: RatingSource;
  categories: Taxonomy[];
  countries: Taxonomy[];
}

export interface MovieDetail extends Movie {
  content: string;            // HTML — PHẢI sanitize
  status: string;
  trailerUrl: string;         // link YouTube
  episodeTotal: string;
  view: number;
  isCopyright: boolean;
  inTheater: boolean;         // chieurap
  actors: string[];
  directors: string[];
  createdAt: string;
}

export interface EpisodeItem {
  name: string;               // "1"
  slug: string;               // "1"
  filename: string;
  linkEmbed: string;
  linkM3u8: string;
}

export interface EpisodeServer {
  serverName: string;         // "Vietsub #1"
  episodes: EpisodeItem[];
}

export interface Pagination {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
}
```

### 5.2 Type dữ liệu bổ trợ

```ts
export interface MovieImages {
  backdrops: string[];
  posters: string[];
  logos: string[];            // dùng làm title hero nếu có
}

export interface Person {
  id: string;
  name: string;
  character?: string;         // vai diễn
  job?: string;               // "Director", "Writer"
  profile?: string;           // ảnh chân dung, có thể rỗng
}

export type Keyword = string;
```

> Shape thực tế của `/images`, `/peoples`, `/keywords` cần verify bằng một lần gọi thật trước khi code. Adapter phải viết theo hướng dò field linh hoạt (`backdrops ?? backdrop ?? []`).

### 5.3 Helper dẫn xuất

```ts
// lib/derive.ts

/** Chuyển vote_average → "% phù hợp". Trả null nếu không đủ dữ liệu. */
export function matchScore(m: Movie): number | null {
  const src = m.imdb.vote_count > m.tmdb.vote_count ? m.imdb : m.tmdb;
  if (src.vote_count === 0) return null;      // KHÔNG được hiện 0%
  return Math.round(src.vote_average * 10);
}

export type EpisodeBadge =
  | { kind: "completed"; total: number }
  | { kind: "ongoing"; current: number }
  | { kind: "full" };

/** Parse "Hoàn Tất (24/24)" | "Tập 33" | "Full" */
export function parseEpisodeBadge(raw: string): EpisodeBadge;
```

---

## 6. BẢN ĐỒ ROUTE

```
app/
├─ layout.tsx                        Shell, Navbar, Providers
├─ page.tsx                          Trang chủ (RSC, gọi /v1/api/home)
├─ @modal/
│  ├─ default.tsx
│  └─ (.)phim/[slug]/page.tsx        Intercepting route → DetailModal
├─ phim/[slug]/page.tsx              Trang chi tiết full (khi reload/chia sẻ)
├─ xem/[slug]/[ep]/page.tsx          Trang phát video
├─ danh-sach/[type]/page.tsx         phim-bo, phim-le, hoat-hinh, tv-shows...
├─ the-loai/[slug]/page.tsx
├─ quoc-gia/[slug]/page.tsx
├─ nam/[year]/page.tsx
├─ tim-kiem/page.tsx                 ?keyword=
└─ danh-sach-cua-toi/page.tsx        My List (localStorage)
```

### 6.1 Cơ chế intercepting route

Đây là cơ chế cốt lõi tạo trải nghiệm Netflix:

| Hành động | Kết quả |
|---|---|
| Click card từ trang chủ | Mở modal, URL đổi thành `/phim/{slug}`, nền vẫn giữ trang chủ |
| Nhấn F5 tại URL đó | Render `app/phim/[slug]/page.tsx` — trang full, không phải modal |
| Nhấn Back | Modal đóng, quay về trang chủ đúng vị trí scroll |
| Chia sẻ link | Người nhận thấy trang full |

### 6.2 Đồng bộ trạng thái qua URL

Mọi filter phải nằm trong `searchParams`:
```
/danh-sach/phim-bo?country=han-quoc&year=2024&sort_field=year&sort_type=desc&page=2
```

---

## 7. DESIGN SYSTEM

### 7.1 Color tokens

```css
:root {
  --bg-base:      #08080B;
  --bg-elevated:  #121216;
  --bg-hover:     #1C1C22;

  --text-primary:   #FFFFFF;
  --text-secondary: #A1A1A8;
  --text-muted:     #5F5F68;

  --accent:       /* 1 màu signature — KHÔNG dùng đỏ Netflix */;
  --accent-hover: /* accent sáng hơn 12% */;

  --success: #3FB950;
  --warning: #D29922;
  --danger:  #F85149;
}
```

### 7.2 Typography

| Vai trò | Font | Weight | Tracking |
|---|---|---|---|
| Hero title | Be Vietnam Pro | 800 | -0.02em |
| Section heading | Be Vietnam Pro | 700 | -0.01em |
| Body | Be Vietnam Pro | 400 | 0 |
| Meta / badge | Be Vietnam Pro | 500 | 0.01em |

> Chọn font hỗ trợ dấu tiếng Việt đầy đủ. Be Vietnam Pro hoặc Inter. Kiểm tra kỹ các ký tự `ế ộ ữ ỡ ẳ` ở weight 800 — nhiều font bị vỡ dấu.

### 7.3 Spacing & shape

```
spacing scale : 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96
radius        : 4 (card) · 10 (modal) · 999 (button/chip)
```

### 7.4 Elevation

Dùng shadow nhiều lớp, **không dùng border** để tạo độ nổi:

```css
--elev-1: 0 1px 2px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.3);
--elev-2: 0 4px 8px rgba(0,0,0,.45), 0 12px 28px rgba(0,0,0,.35);
--elev-3: 0 8px 16px rgba(0,0,0,.5), 0 32px 64px rgba(0,0,0,.45);
```

### 7.5 Tỉ lệ ảnh

| Vị trí | Tỉ lệ | Nguồn |
|---|---|---|
| Carousel ngang | 16:9 | `thumb` |
| Grid dọc (trang danh sách) | 2:3 | `poster` |
| Hero | 16:9 | `/images` backdrop |
| Avatar cast | 1:1 tròn | `/peoples` profile |

---

## 8. ĐẶC TẢ COMPONENT

### 8.1 Navbar

| Thuộc tính | Giá trị |
|---|---|
| Trạng thái đầu | `background: transparent` |
| Ngưỡng chuyển | `scrollY > 60` |
| Trạng thái sau | `bg-base/95` + `backdrop-blur(12px)` |
| Transition | 300ms |

**Menu:** Phim bộ · Phim lẻ · Hoạt hình · TV Shows · Thể loại (mega dropdown) · Quốc gia · Năm

**Search:**
- Click icon → input expand `0 → 280px`
- Debounce 350ms → `GET /v1/api/tim-kiem?keyword=&limit=8`
- Dropdown kết quả: poster thumbnail 40×60 + tên + năm + loại
- ESC hoặc blur → thu lại
- Enter → điều hướng `/tim-kiem?keyword=`

### 8.2 HeroBillboard

**Lớp hiển thị (từ dưới lên):**

```
layer 0  ảnh nền blur(40px) scale(1.15)   ← chỉ khi phải fallback thumb
layer 1  backdrop từ /images, object-cover
         Ken Burns: scale 1.0 → 1.08 trong 20s ease-out
layer 2  gradient trái:
         linear-gradient(77deg, rgba(8,8,11,.85) 0%, transparent 78%)
layer 3  gradient đáy nối liền vào row đầu tiên
layer 4  nội dung: logo/title, origin_name, meta row, nút
```

**Quy tắc ảnh:**
1. Ưu tiên backdrop từ `/v1/api/phim/{slug}/images`
2. Nếu có `logos[0]` → render làm title (đúng cách Netflix làm)
3. Nếu `/images` fail → fallback `thumb` + bật layer 0

**Trailer:**
- Sau 2500ms → crossfade sang YouTube IFrame API
- Params: `mute=1&controls=0&modestbranding=1&disablekb=1&loop=1&playlist={id}`
- Nhúng thất bại → **im lặng giữ ảnh**, không hiện lỗi
- `IntersectionObserver` → pause khi hero rời viewport

**Meta row:** `year · quality · duration · lang · episodeCurrent`

**Nút:** Play (→ `/xem/{slug}/1`) · Thông tin (→ mở modal)

### 8.3 ContentRow

> **Tự viết. Không dùng swiper/slick** — cần kiểm soát hoàn toàn transform-origin và timing.

| Thuộc tính | Giá trị |
|---|---|
| Scroll | `scroll-snap-type: x mandatory` |
| Gap | 8px |
| Padding ngang | `4vw` |
| Arrow | Chỉ hiện khi hover row |
| Bước chuyển | **Nguyên trang item**, không phải từng item |
| Virtualize | Chỉ mount item trong ±1 viewport |
| Row ngoài màn | `content-visibility: auto` |
| Lazy fetch | `useInView` + `useQuery({ enabled })` |

**Quan trọng:** khi có card đang hover, row cha phải `overflow: visible`, nếu không card phóng to sẽ bị cắt.

**Row mặc định trang chủ:** Mới cập nhật · Phim bộ · Phim lẻ · Hoạt hình · TV Shows · Hàn Quốc · Trung Quốc · Nhật Bản · Hành động · Tình cảm · Kinh dị

### 8.4 MovieCard + HoverPreview

**Timing (chống nhấp nháy khi rê chuột ngang qua):**

| Sự kiện | Delay |
|---|---|
| Vào | 400ms |
| Ra | 200ms |

`clearTimeout` ngay khi unhover trước lúc timer chạy xong.

**Transform:**
```
scale: 1.0 → 1.35
translateY: 0 → -20px
z-index: raise
```

**`transform-origin` phải theo vị trí trong row:**

| Vị trí | Giá trị |
|---|---|
| Item đầu row | `left center` |
| Item cuối row | `right center` |
| Còn lại | `center` |

Không làm điều này thì card ở mép sẽ tràn ra ngoài viewport.

**Nội dung khi expand:**
- Hàng nút tròn: Play · +Danh sách · Thích · Chi tiết
- Badge: `quality` · `lang` · `episodeCurrent` (đã parse) · `duration` · `year`
- 2 category đầu tiên
- Badge % phù hợp — **ẩn nếu `matchScore()` trả `null`**

**Prefetch:** sau 200ms hover → prefetch `/phim/{slug}` và `/images`

### 8.5 DetailModal

**Route:** `app/@modal/(.)phim/[slug]/page.tsx`

**Chuyển cảnh:** shared element bằng `layoutId` của Framer Motion — **không dùng fade**. Card ở row biến hình thành modal.

**Hành vi bắt buộc:**
- Backdrop `blur(8px)`
- Đóng bằng ESC hoặc click ngoài
- `body` scroll lock khi mở
- Focus trap trong modal
- Trả focus về card gốc khi đóng

**Thứ tự nội dung:**
1. Backdrop hero
2. Title (logo nếu có) + `originName`
3. Meta row + badge % phù hợp
4. `content` — **PHẢI sanitize HTML** trước khi render
5. Keyword chips (tối đa 8, click → tìm kiếm)
6. Cast row từ `/peoples`
7. Tabs chọn server + grid chọn tập
8. "Có thể bạn thích" — query theo `categories[0].slug`

**Progressive rendering:** fetch song song 4 endpoint, mỗi block có skeleton riêng, hiện dần khi data về. **Không chờ đủ 4 rồi mới render.**

### 8.6 Cast row

- Avatar tròn 80px, lazy load
- Tên + vai diễn (2 dòng, ellipsis)
- Không có ảnh → hiện initials trên nền `--bg-elevated`
- Cuộn ngang, dùng lại logic ContentRow

### 8.7 Trang danh sách

- Filter bar: thể loại · quốc gia · năm · ngôn ngữ · sắp xếp
- Mọi filter đồng bộ `searchParams`
- Infinite scroll: `useInfiniteQuery` + `totalPages` từ `pagination`
- Grid poster 2:3, responsive 2/3/4/6 cột

---

## 9. ĐẶC TẢ MOTION

### 9.1 Quy tắc tuyệt đối

1. **Chỉ animate `transform` và `opacity`.** Không bao giờ animate `width`, `height`, `top`, `left`, `margin` — những thuộc tính này gây layout reflow và tụt frame.
2. `will-change` chỉ set khi đang animate, **xoá ngay sau đó**.
3. Chuyển cảnh phức tạp dùng Framer Motion, không dùng CSS transition.

### 9.2 Bảng timing

| Loại | Duration | Easing |
|---|---|---|
| Micro (hover nút, chip) | 150ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` |
| Standard (card, navbar) | 300ms | như trên |
| Modal / shared element | 450ms | spring `stiffness 300, damping 30` |
| Ken Burns | 20000ms | `ease-out` |

### 9.3 Stagger

Row xuất hiện: delay **40ms/item**, tối đa **8 item** rồi dừng stagger.

### 9.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) { /* ... */ }
```

- Tắt scale trên hover card
- Tắt Ken Burns
- Tắt parallax
- **Giữ lại opacity transition** để UI vẫn có phản hồi

---

## 10. VIDEO PLAYER

### 10.1 Nguồn phát

Mỗi tập có 2 nguồn từ `EpisodeItem`:

| Trường | Cách dùng | Thứ tự |
|---|---|---|
| `linkM3u8` | hls.js | Mặc định |
| `linkEmbed` | `<iframe>` | Fallback |

### 10.2 Luồng fallback

```
1. Khởi tạo hls.js với linkM3u8
2. Nếu Hls.isSupported() === false
   → thử native HLS (Safari): video.src = linkM3u8
3. Nếu fatal error (NETWORK_ERROR / MEDIA_ERROR không khôi phục được)
   → chuyển sang <iframe src={linkEmbed}>
   → hiện toast 1 dòng: "Đang dùng nguồn phát dự phòng"
4. Nếu iframe cũng fail → hiện nút "Thử server khác"
```

### 10.3 Control layer

**Không dùng `controls` mặc định của thẻ video.**

| Thành phần | Yêu cầu |
|---|---|
| Progress bar | Có buffered range riêng (màu `--text-muted`), hover hiện tooltip thời gian |
| Volume | Slider dọc xuất hiện khi hover icon |
| Quality | Lấy từ `hls.levels`, có option "Tự động" |
| Tốc độ | 0.5 · 0.75 · 1 · 1.25 · 1.5 · 2 |
| Auto-hide | Sau 3000ms không cử động chuột, fade 300ms |

### 10.4 Phím tắt

| Phím | Chức năng |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | Lùi / tiến 10s |
| `↑` / `↓` | Tăng / giảm âm lượng |
| `F` | Fullscreen |
| `M` | Mute |
| `Esc` | Thoát fullscreen |

### 10.5 Lưu tiến độ

```ts
// localStorage
key:   `watch:${slug}:${ep}`
value: { position: number; duration: number; updatedAt: number }
```

- Ghi mỗi 5 giây khi đang phát
- Quay lại → hiện prompt "Tiếp tục xem từ 12:34" / "Xem từ đầu"
- Xem đủ 95% → xoá key, đánh dấu đã xem
- Dọn key cũ hơn 90 ngày khi khởi động app

### 10.6 Sidebar

- Tabs chọn server (`serverName`)
- Grid chọn tập, tập đang xem highlight bằng `--accent`
- Tập đã xem có thanh tiến độ mỏng phía dưới
- Auto next tập khi hết, có countdown 10s và nút huỷ

---

## 11. CHIẾN LƯỢC CACHING & FETCH

### 11.1 staleTime

| Loại dữ liệu | staleTime | gcTime |
|---|---|---|
| Danh mục (`/the-loai`, `/quoc-gia`, `/nam-phat-hanh`) | 24 giờ | 24 giờ |
| Chi tiết phim | 30 phút | 1 giờ |
| Danh sách phim | 5 phút | 15 phút |
| Kết quả tìm kiếm | 2 phút | 5 phút |
| `/v1/api/home` | 5 phút | 15 phút |

### 11.2 Thứ tự fetch trang chủ

```
1. RSC: GET /v1/api/home
   → render ngay hero + các row có sẵn
2. Client: chỉ fetch bổ sung row mà /home KHÔNG trả về
3. Các row đó fetch lazy khi vào viewport
```

**Không được** bắn 11 request song song ngay khi load. Đây là lỗi làm hỏng LCP phổ biến nhất.

### 11.3 Fetch DetailModal

Gọi **song song** 4 endpoint, render **progressive**:

```
/phim/{slug}              → khung, title, meta        (ưu tiên 1)
/v1/api/phim/{slug}/images → backdrop, logo            (ưu tiên 1)
/v1/api/phim/{slug}/peoples → cast row                 (ưu tiên 2)
/v1/api/phim/{slug}/keywords → chips                   (ưu tiên 3)
```

### 11.4 Prefetch

| Trigger | Prefetch |
|---|---|
| Hover card 200ms | `/phim/{slug}` + `/images` |
| Vào trang chi tiết | Tập 1 `linkM3u8` (HEAD request) |
| Đang xem tập N | Metadata tập N+1 |

---

## 12. NGÂN SÁCH HIỆU NĂNG

### 12.1 Chỉ tiêu

| Metric | Ngưỡng | Đo bằng |
|---|---|---|
| LCP | < 2.0s | Lighthouse, Chrome UX |
| CLS | < 0.05 | Lighthouse |
| INP | < 200ms | Web Vitals |
| TTFB | < 600ms | Network |
| JS bundle (initial) | < 180KB gzip | `@next/bundle-analyzer` |

### 12.2 Kỹ thuật bắt buộc

| Kỹ thuật | Áp dụng |
|---|---|
| `next/image` với `sizes` chính xác | Mọi ảnh |
| `priority` | **Chỉ** ảnh hero |
| Custom loader WEBP | Qua `/image.php?url=` |
| Blur placeholder | Mọi card |
| `content-visibility: auto` | Row ngoài viewport |
| Virtualize | Item trong row, ±1 viewport |
| Code-split | `VideoPlayer`, `DetailModal` |
| Skeleton shimmer | Mọi loading state |

**Không dùng spinner.** Skeleton giữ layout ổn định, spinner gây CLS và cảm giác chậm hơn.

### 12.3 Cấu hình next.config

```js
images: {
  remotePatterns: [
    { protocol: "https", hostname: "phimimg.com" },
    { protocol: "https", hostname: "phimapi.com" },
  ],
  loader: "custom",
  loaderFile: "./lib/image-loader.ts",
}
```

---

## 13. ACCESSIBILITY

Mục tiêu: **WCAG 2.1 AA**

### 13.1 Bàn phím

| Thành phần | Yêu cầu |
|---|---|
| Carousel | Roving tabindex, `←`/`→` điều hướng giữa card |
| Modal | Focus trap, ESC đóng, trả focus về trigger |
| Player | Toàn bộ phím tắt mục 10.4 |
| Dropdown | `↑`/`↓` di chuyển, Enter chọn, ESC đóng |

### 13.2 Focus

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

**Không bao giờ dùng `outline: none` trần** mà không thay thế bằng chỉ báo khác.

### 13.3 Screen reader

- `aria-label` đầy đủ cho mọi icon button
- `aria-live="polite"` cho trạng thái player (đang tải, lỗi, đổi tập)
- `alt` cho poster: `"{name} ({year})"`
- Ảnh trang trí (gradient layer): `aria-hidden="true"`

### 13.4 Tương phản

| Cặp màu | Tỉ lệ | Đạt |
|---|---|---|
| `--text-primary` / `--bg-base` | 19.8:1 | AAA |
| `--text-secondary` / `--bg-base` | 9.1:1 | AAA |
| `--text-muted` / `--bg-base` | 4.6:1 | AA |

`--accent` phải kiểm tra đạt ≥ 4.5:1 trên `--bg-base` sau khi chọn.

---

## 14. XỬ LÝ LỖI

### 14.1 Phân loại và ứng xử

| Tình huống | Ứng xử |
|---|---|
| Ảnh 404 | Placeholder nội bộ, không hiện text lỗi |
| `/images` fail | Fallback `thumb` + layer blur, **im lặng** |
| YouTube nhúng bị chặn | Giữ ảnh tĩnh, **im lặng** |
| `/peoples` fail | Ẩn cast row, không hiện lỗi |
| `/keywords` fail | Ẩn chips, không hiện lỗi |
| List API fail | Ẩn row đó, các row khác vẫn render |
| Chi tiết phim fail | Error state có nút "Thử lại" |
| HLS fatal | Fallback iframe + toast 1 dòng |
| Cả 2 nguồn fail | Nút "Thử server khác" |
| Mất mạng | Banner offline, giữ nguyên dữ liệu đã cache |

**Nguyên tắc:** phần bổ trợ fail thì **ẩn im lặng**; phần cốt lõi fail thì hiện error state có hành động khôi phục.

### 14.2 Retry

```ts
retry: (failureCount, error) => {
  if (error.status === 404) return false;  // không retry 404
  return failureCount < 2;
},
retryDelay: (i) => Math.min(1000 * 2 ** i, 8000),
```

### 14.3 Timeout

- List: 8s
- Detail: 8s
- Images/peoples/keywords: 5s (bổ trợ, không đáng chờ lâu)

### 14.4 Bảo mật nội dung

`movie.content` là **HTML thô từ API** → bắt buộc sanitize (DOMPurify hoặc `rehype-sanitize`) trước khi `dangerouslySetInnerHTML`. Whitelist: `p, br, strong, em, a, ul, ol, li`.

---

## 15. CẤU TRÚC THƯ MỤC

```
src/
├─ app/                         (xem mục 6)
│
├─ components/
│  ├─ ui/                       Primitive tái sử dụng
│  │  ├─ Button.tsx
│  │  ├─ Chip.tsx
│  │  ├─ Skeleton.tsx
│  │  ├─ Toast.tsx
│  │  └─ Dropdown.tsx
│  │
│  └─ feature/                  Component nghiệp vụ
│     ├─ Navbar/
│     ├─ HeroBillboard/
│     ├─ ContentRow/
│     ├─ MovieCard/
│     ├─ HoverPreview/
│     ├─ DetailModal/
│     ├─ CastRow/
│     ├─ FilterBar/
│     └─ VideoPlayer/
│
├─ lib/
│  ├─ api.ts                    HTTP client, timeout, retry
│  ├─ normalize.ts              ADAPTER — 4 shape → 1 model
│  ├─ image-loader.ts           Custom next/image loader
│  ├─ derive.ts                 matchScore, parseEpisodeBadge
│  ├─ sanitize.ts               Làm sạch HTML
│  └─ storage.ts                Wrapper localStorage
│
├─ hooks/
│  ├─ useHoverDelay.ts          400ms vào / 200ms ra
│  ├─ useRowScroll.ts           Logic arrow + snap
│  ├─ useHls.ts                 hls.js lifecycle
│  ├─ useWatchProgress.ts       Lưu/khôi phục tiến độ
│  └─ useKeyboardShortcuts.ts
│
├─ store/
│  ├─ useUIStore.ts             Modal, toast
│  └─ useMyListStore.ts         Danh sách cá nhân
│
├─ types/
│  ├─ movie.ts                  Type sau chuẩn hóa
│  └─ api-raw.ts                Type raw — CHỈ normalize.ts import
│
└─ styles/
   ├─ tokens.css
   └─ globals.css
```

**Quy tắc import:** `types/api-raw.ts` chỉ được import bởi `lib/normalize.ts`. Thêm ESLint rule chặn import từ nơi khác.

---

## 16. LỘ TRÌNH TRIỂN KHAI

### Giai đoạn 1 — Nền tảng
- [ ] `types/` — cả raw và normalized
- [ ] `styles/tokens.css`
- [ ] `lib/api.ts` + `lib/normalize.ts` + test cho 4 shape
- [ ] `lib/image-loader.ts` + cấu hình `next.config`
- [ ] `lib/derive.ts` + unit test cho `parseEpisodeBadge`

**Không viết UI trước khi adapter có test xanh.**

### Giai đoạn 2 — Primitive
- [ ] `components/ui/*`
- [ ] Skeleton shimmer
- [ ] `hooks/useHoverDelay.ts`, `useRowScroll.ts`

### Giai đoạn 3 — Trang chủ
- [ ] Navbar (chưa có search)
- [ ] ContentRow + virtualize
- [ ] MovieCard + HoverPreview (đúng edge-aware origin)
- [ ] HeroBillboard (ảnh tĩnh trước)
- [ ] Ghép `/v1/api/home`

### Giai đoạn 4 — Chi tiết
- [ ] Intercepting route + DetailModal
- [ ] Shared element transition
- [ ] Cast row, keyword chips
- [ ] Trang `/phim/[slug]` full

### Giai đoạn 5 — Player
- [ ] `useHls` + control layer
- [ ] Phím tắt, auto-hide
- [ ] Lưu tiến độ, auto next
- [ ] Fallback iframe

### Giai đoạn 6 — Duyệt & tìm
- [ ] Trang danh sách + FilterBar + infinite scroll
- [ ] Search dropdown
- [ ] My List

### Giai đoạn 7 — Hoàn thiện
- [ ] Hero trailer YouTube
- [ ] Ken Burns, reduced-motion
- [ ] Audit accessibility
- [ ] Audit hiệu năng, cắt bundle

---

## 17. RỦI RO & VẤN ĐỀ ĐÃ BIẾT

| # | Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|---|
| 1 | **4 shape response khác nhau** | Cao | Adapter tập trung + test cho từng shape với fixture thật |
| 2 | Ảnh URL tương đối ở `/v1/api/*` | Cao | `resolveImage()` dùng ở mọi nơi, không nối chuỗi thủ công |
| 3 | Shape `/images`, `/peoples`, `/keywords` chưa verify | Trung bình | Gọi thử trước khi code; adapter dò field linh hoạt |
| 4 | `thumb_url` độ phân giải thấp | Trung bình | Ưu tiên backdrop từ `/images`; fallback có layer blur |
| 5 | `trailer_url` là YouTube, có thể bị chặn nhúng | Trung bình | Fail im lặng, giữ ảnh tĩnh |
| 6 | CORS trên CDN HLS | Trung bình | Fallback `linkEmbed` tự động |
| 7 | `vote_count = 0` trên nhiều phim | Thấp | `matchScore()` trả `null` → ẩn badge |
| 8 | `content` là HTML thô | Cao (bảo mật) | Bắt buộc sanitize, whitelist tag |
| 9 | API không cam kết SLA | Trung bình | Cache dài, error state mềm, giữ dữ liệu cũ khi fail |
| 10 | Hover card bị cắt ở mép row | Thấp | `transform-origin` edge-aware + `overflow: visible` |
| 11 | `limit` tối đa 64 | Thấp | Ghép nhiều trang nếu cần row dài hơn |
| 12 | Bản quyền nội dung | Ngoài kỹ thuật | Chỉ dùng cho mục đích học tập / cá nhân |

---

## PHỤ LỤC A — CHECKLIST TRƯỚC KHI CODE

- [ ] Gọi thử `/v1/api/home`, lưu response làm fixture
- [ ] Gọi thử `/v1/api/phim/{slug}/images` → xác nhận có `backdrops` và `logos` không
- [ ] Gọi thử `/v1/api/phim/{slug}/peoples` → xác nhận trường ảnh chân dung
- [ ] Gọi thử `/v1/api/phim/{slug}/keywords` → xác nhận shape
- [ ] Xác nhận CDN HLS có trả header CORS cho domain của bạn
- [ ] Chọn `--accent` và kiểm tra tương phản ≥ 4.5:1
- [ ] Kiểm tra font ở weight 800 với các ký tự `ế ộ ữ ỡ ẳ`

## PHỤ LỤC B — CHECKLIST TRƯỚC KHI PHÁT HÀNH

- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95
- [ ] Không có `console.log` trong bundle production
- [ ] Test trên Safari (native HLS đi đường khác Chrome)
- [ ] Test `prefers-reduced-motion: reduce`
- [ ] Test điều hướng toàn bộ bằng bàn phím
- [ ] Test offline: banner hiện, cache giữ nguyên
- [ ] Test màn 1366×768 và 2560×1440 (hero và hover card ở 2 đầu)
- [ ] Bundle initial < 180KB gzip
