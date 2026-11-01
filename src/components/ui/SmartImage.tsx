'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { PLACEHOLDER_POSTER } from '@/lib/constants';
import { IMAGE_QUALITY } from '@/lib/network';
import { isOptimizable, isPlaceholder } from '@/lib/image';

/** `useLayoutEffect` ở client, `useEffect` lúc SSR — React 18 cảnh báo layout effect trên server. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Ảnh đã từng tải xong trong phiên này. Card mount lại (Back về trang chủ, đổi
 * trang danh sách) bắt đầu luôn ở trạng thái "đã có" — không vẽ một khung
 * `opacity: 0` nào để rồi fade lại thứ đã nằm sẵn trong cache trình duyệt.
 *
 * Khoá gồm cả `sizes`/`width`/`quality`, không chỉ URL gốc: qua optimizer thì
 * cùng một poster ở card 180px và ở hero là hai file khác nhau — bản to chưa
 * tải mà bị coi là "đã có" thì hiện ra trần trụi, không fade.
 */
const loadedSrcs = new Set<string>();

interface SmartImageProps extends ImageProps {
  /** Ảnh dự phòng khi CDN trả 404. Khung 16:9 truyền `PLACEHOLDER_BACKDROP`. */
  fallbackSrc?: string;
}

/**
 * `next/image` + ba thứ mà mọi chỗ trong app đều cần:
 *
 * 1. `quality` mặc định dùng chung một hằng số. Đặt tay ở từng chỗ gọi thì sớm
 *    muộn cũng sót. Trước đây chỗ này lấy `quality` theo tier mạng và đó là một
 *    cái bẫy: `q` nằm trong URL ảnh, đổi nó sau hydrate là tải lại từ đầu. Lý do
 *    đầy đủ ở `IMAGE_QUALITY` trong `lib/network.ts`.
 *
 * 2. Placeholder nội bộ KHÔNG đi qua optimizer. Hai lý do:
 *    · tối ưu một file SVG 356 byte là vô nghĩa — chỉ thêm một vòng qua server
 *    · Next 14 chỉ nhận diện SVG khi file mở đầu bằng `<?xml`; thiếu prolog là
 *      optimizer trả 400 "isn't a valid image" và ảnh dự phòng biến mất đúng lúc
 *      cần nó nhất (ảnh CDN 404 — §14.1)
 *
 * 3. Host lạ đi thẳng, không qua optimizer (`isOptimizable`) — `next/image` ném
 *    lỗi render với hostname chưa khai báo, đủ để một phim làm sập cả trang.
 *
 * 4. §14.1 — "Ảnh 404 → placeholder nội bộ, không hiện text lỗi". Dữ liệu thật
 *    có phim trỏ `poster_url` sang domain báo chí đã gỡ bài (bắt được một ca khi
 *    nối API: `danviet.vn/.../final--poster-phu-sa-1012.jpg` → 404), lúc đó
 *    `next/image` để lộ icon ảnh vỡ kèm chữ `alt`.
 *
 * 5. Fade 300ms lúc ảnh về. `BLUR_DATA_URL` chỉ là một ô đặc màu `--bg-elevated`
 *    — đúng bằng nền card — nên "blur-up" của next/image thực chất là một cú
 *    NHẢY từ ô xám sang ảnh thật. Lướt một row 18 card là 18 cú nhảy lệch pha
 *    nhau. Fade chồng lên đúng ô xám đó thì không mất thông tin gì, chỉ mượt hơn.
 *    CHỈ ảnh thật sự còn phải tải mới fade — ảnh đã có thì hiện ngay (`loadedSrcs`).
 */
export function SmartImage({
  quality,
  unoptimized,
  fallbackSrc,
  className,
  ...props
}: SmartImageProps) {
  const src = typeof props.src === 'string' ? props.src : '';
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Card được tái sử dụng khi danh sách đổi → ảnh mới phải được thử lại từ đầu.
  useEffect(() => setFailed(false), [src]);

  /**
   * Ảnh `priority` KHÔNG fade. Chrome bỏ qua phần tử đang `opacity: 0` khi đo
   * LCP, nên fade 300ms ở hero là cộng thẳng 300ms vào chính con số §12.1 đang
   * cố giữ.
   */
  const fade = !props.priority;

  const finalSrc = failed ? (fallbackSrc ?? PLACEHOLDER_POSTER) : props.src;
  const srcKey =
    typeof finalSrc === 'string'
      ? [finalSrc, props.sizes ?? '', props.width ?? '', quality ?? ''].join('|')
      : '';
  const [loaded, setLoaded] = useState(() => loadedSrcs.has(srcKey));

  /**
   * Nghe `load` THẲNG trên thẻ <img>, không đi qua prop `onLoad` của next/image.
   *
   * next/image chặn `data-loaded-src` để chỉ chuyển tiếp `onLoad` một lần cho
   * mỗi URL. Khi React dùng lại đúng thẻ <img> cũ mà component lại vừa dựng lại
   * state (Fast Refresh, StrictMode mount hai lần), lần chuyển tiếp đó ĐÃ tiêu
   * mất — `loaded` kẹt ở false và ảnh ở nguyên `opacity: 0`. Bắt được lúc đang
   * dựng: nửa row card trắng trơn chỉ còn cái badge FHD.
   *
   * Sự kiện DOM thì không có bộ nhớ đó, và `complete` cho biết ảnh đã xong từ
   * trước khi kịp gắn listener (cache) — hai đường này phủ hết mọi trường hợp.
   *
   * Layout effect chứ không phải effect thường: điều hướng của App Router chạy
   * trong transition, effect thường chạy SAU lượt vẽ — ảnh đã cache vẫn kịp lộ
   * ra một khung `opacity: 0` rồi fade 300ms. Kiểm `complete` trước lượt vẽ thì
   * class mờ không bao giờ chạm tới màn hình.
   */
  useIsomorphicLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const markLoaded = () => {
      if (srcKey) loadedSrcs.add(srcKey);
      setLoaded(true);
    };

    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
      return;
    }

    setLoaded(loadedSrcs.has(srcKey));
    img.addEventListener('load', markLoaded);
    return () => img.removeEventListener('load', markLoaded);
  }, [srcKey]);

  // Ảnh import tĩnh (StaticImport) luôn tối ưu được — chỉ URL chuỗi mới phải xét.
  const skipOptimizer =
    typeof finalSrc === 'string' && (isPlaceholder(finalSrc) || !isOptimizable(finalSrc));

  return (
    /* `alt` đi qua {...props}; kiểu ImageProps đã bắt buộc có nó ở mọi nơi gọi,
       ESLint chỉ không nhìn xuyên được spread. */
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...props}
      ref={imgRef}
      src={finalSrc}
      quality={quality ?? IMAGE_QUALITY}
      unoptimized={unoptimized || skipOptimizer}
      // §9.4 — fade là ngoại lệ được giữ lại khi người dùng bật giảm chuyển động.
      data-motion={fade ? 'fade' : undefined}
      className={cn(
        className,
        fade && 'transition-opacity duration-standard ease-standard',
        fade && !loaded && 'opacity-0',
      )}
      onError={(event) => {
        setFailed(true);
        props.onError?.(event);
      }}
    />
  );
}
