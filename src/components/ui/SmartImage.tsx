'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useState } from 'react';
import { PLACEHOLDER_POSTER } from '@/lib/constants';
import { isOptimizable, isPlaceholder } from '@/lib/image';
import { useDevice } from '@/hooks/useDevice';

interface SmartImageProps extends ImageProps {
  /** Ảnh dự phòng khi CDN trả 404. Khung 16:9 truyền `PLACEHOLDER_BACKDROP`. */
  fallbackSrc?: string;
}

/**
 * `next/image` + ba thứ mà mọi chỗ trong app đều cần:
 *
 * 1. `quality` theo chất lượng mạng thật (45 / 60 / 75). Đặt tay ở từng chỗ gọi
 *    thì sớm muộn cũng sót, mà sót thì mạng 2G phải tải ảnh nặng gấp đôi.
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
 */
export function SmartImage({ quality, unoptimized, fallbackSrc, ...props }: SmartImageProps) {
  const { imageQuality } = useDevice();

  const src = typeof props.src === 'string' ? props.src : '';
  const [failed, setFailed] = useState(false);

  // Card được tái sử dụng khi danh sách đổi → ảnh mới phải được thử lại từ đầu.
  useEffect(() => setFailed(false), [src]);

  const finalSrc = failed ? (fallbackSrc ?? PLACEHOLDER_POSTER) : props.src;
  // Ảnh import tĩnh (StaticImport) luôn tối ưu được — chỉ URL chuỗi mới phải xét.
  const skipOptimizer =
    typeof finalSrc === 'string' && (isPlaceholder(finalSrc) || !isOptimizable(finalSrc));

  return (
    /* `alt` đi qua {...props}; kiểu ImageProps đã bắt buộc có nó ở mọi nơi gọi,
       ESLint chỉ không nhìn xuyên được spread. */
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...props}
      src={finalSrc}
      quality={quality ?? imageQuality}
      unoptimized={unoptimized || skipOptimizer}
      onError={(event) => {
        setFailed(true);
        props.onError?.(event);
      }}
    />
  );
}
