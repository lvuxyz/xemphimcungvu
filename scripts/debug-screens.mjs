/**
 * Gọi lần lượt các màn hình và KIỂM mã trạng thái, không chỉ in ra.
 *
 *   node scripts/debug-screens.mjs                      → http://localhost:3000
 *   node scripts/debug-screens.mjs http://localhost:3311 → bản `next start -p 3311`
 *
 * Thoát với mã 1 nếu có màn nào lệch. Trước đây mọi status đều in [PASS], nên
 * route lạ trả 200 (thay vì 404) suốt một thời gian mà không ai thấy.
 *
 * Kết quả đáng tin nhất trên `next build` + `next start` (port khác dev, đừng
 * build vào `.next` của dev server đang chạy).
 */
const BASE = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

let failures = 0;

async function check(name, path, expected = 200) {
  const t0 = Date.now();
  try {
    // `manual`: các route /phim/id, /imdb… trả redirect — status của CHÍNH nó mới là thứ cần kiểm.
    const res = await fetch(BASE + path, { redirect: 'manual' });
    const text = await res.text();
    const ok = res.status === expected;
    if (!ok) failures++;
    const tag = ok ? '[PASS]' : '[FAIL]';
    const want = ok ? '' : ` — mong đợi ${expected}`;
    console.log(
      `${tag} ${name} (${path}): Status ${res.status}${want} (${Date.now() - t0}ms, body: ${text.length} bytes)`,
    );
    return { res, text };
  } catch (e) {
    failures++;
    console.error(`[FAIL] ${name} (${path}): ${e.message}`);
    return null;
  }
}

async function testScreens() {
  const routes = [
    ['Trang chu', '/'],
    ['API Home Section', '/api/home/phim-bo'],
    ['Danh sach Phim bo', '/danh-sach/phim-bo'],
    ['Danh sach Phim le', '/danh-sach/phim-le'],
    ['Tat ca phim', '/danh-sach'],
    ['The loai Hanh dong', '/the-loai/hanh-dong'],
    ['Quoc gia Au My', '/quoc-gia/au-my'],
    ['Nam 2024', '/nam/2024'],
    ['Tim kiem', '/tim-kiem?keyword=vu'],
    ['Danh sach cua toi', '/danh-sach-cua-toi'],
    ['Lich su xem', '/lich-su'],
  ];

  console.log(`=== BAT DAU DEBUG CAC MAN HINH (${BASE}) ===`);
  let sampleSlug = '';

  for (const [name, path] of routes) {
    const result = await check(name, path);
    if (result && path === '/api/home/phim-bo') {
      try {
        sampleSlug = JSON.parse(result.text).items?.[0]?.slug ?? '';
      } catch {}
    }
  }

  if (sampleSlug) {
    console.log(`\n=== KIEM TRA MAN HINH CHI TIET & XEM VOI SLUG: ${sampleSlug} ===`);
    await check('Chi tiet phim', `/phim/${sampleSlug}`);
    await check('Trinh phat', `/xem/${sampleSlug}/1`);
  } else {
    failures++;
    console.error('[FAIL] Khong lay duoc slug mau tu /api/home/phim-bo');
  }

  console.log('\n=== ROUTE KHONG TON TAI PHAI TRA 404 ===');
  const missing = [
    ['Phim', '/phim/slug-khong-ton-tai-12345'],
    ['Trinh phat', '/xem/slug-khong-ton-tai-12345/1'],
    ['The loai', '/the-loai/khong-co-that'],
    ['Quoc gia', '/quoc-gia/khong-co-that'],
    ['Loai danh sach', '/danh-sach/khong-co-that'],
    ['Nam', '/nam/1800'],
    ['Phim theo id', '/phim/id/khong-co-that'],
    ['Duong dan la', '/duong-dan-khong-co-that'],
  ];
  for (const [name, path] of missing) await check(name, path, 404);

  console.log(failures ? `\n${failures} man hinh FAIL` : '\nTat ca man hinh PASS');
  process.exitCode = failures ? 1 : 0;
}

testScreens();
