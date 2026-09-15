'use client';

import Image, { type ImageProps } from 'next/image';
import { isPlaceholder } from '@/lib/image';
import { useDevice } from '@/hooks/useDevice';

/**
 * `next/image` + hai thứ mà mọi chỗ trong app đều cần:
 *
 * 1. `quality` theo chất lượng mạng thật (45 / 60 / 75). Đặt tay ở từng chỗ gọi
 *    thì sớm muộn cũng sót, mà sót thì mạng 2G phải tải ảnh nặng gấp đôi.
 *
 * 2. Placeholder nội bộ KHÔNG đi qua optimizer. Hai lý do:
 *    · tối ưu một file SVG 356 byte là vô nghĩa — chỉ thêm một vòng qua server
 *    · Next 14 chỉ nhận diện SVG khi file mở đầu bằng `<?xml`; thiếu prolog là
 *      optimizer trả 400 "isn't a valid image" và ảnh dự phòng biến mất đúng lúc
 *      cần nó nhất (ảnh CDN 404 — §14.1)
 */
export function SmartImage({ quality, unoptimized, ...props }: ImageProps) {
  const { imageQuality } = useDevice();

  const src = typeof props.src === 'string' ? props.src : '';
  const isLocalPlaceholder = isPlaceholder(src);

  return (
    /* `alt` đi qua {...props}; kiểu ImageProps đã bắt buộc có nó ở mọi nơi gọi,
       ESLint chỉ không nhìn xuyên được spread. */
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...props}
      quality={quality ?? imageQuality}
      unoptimized={unoptimized || isLocalPlaceholder}
    />
  );
}
