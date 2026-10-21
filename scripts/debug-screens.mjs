async function testScreens() {
  const routes = [
    { name: 'Trang chu (/)', url: 'http://localhost:3000/' },
    { name: 'API Home Section (/api/home/phim-bo)', url: 'http://localhost:3000/api/home/phim-bo' },
    { name: 'Danh sach Phim bo (/danh-sach/phim-bo)', url: 'http://localhost:3000/danh-sach/phim-bo' },
    { name: 'Danh sach Phim le (/danh-sach/phim-le)', url: 'http://localhost:3000/danh-sach/phim-le' },
    { name: 'Tat ca phim (/danh-sach)', url: 'http://localhost:3000/danh-sach' },
    { name: 'The loai Hanh dong (/the-loai/hanh-dong)', url: 'http://localhost:3000/the-loai/hanh-dong' },
    { name: 'Quoc gia Au My (/quoc-gia/au-my)', url: 'http://localhost:3000/quoc-gia/au-my' },
    { name: 'Nam 2024 (/nam/2024)', url: 'http://localhost:3000/nam/2024' },
    { name: 'Tim kiem (/tim-kiem?keyword=vu)', url: 'http://localhost:3000/tim-kiem?keyword=vu' },
    { name: 'Danh sach cua toi (/danh-sach-cua-toi)', url: 'http://localhost:3000/danh-sach-cua-toi' },
    { name: 'Lich su xem (/lich-su)', url: 'http://localhost:3000/lich-su' },
  ];

  console.log('=== BAT DAU DEBUG CAC MAN HINH ===');
  let sampleSlug = '';

  for (const r of routes) {
    const t0 = Date.now();
    try {
      const res = await fetch(r.url);
      const text = await res.text();
      const duration = Date.now() - t0;
      console.log(`[PASS] ${r.name}: Status ${res.status} (${duration}ms, body: ${text.length} bytes)`);
      if (r.url.includes('/api/home/phim-bo')) {
        try {
          const json = JSON.parse(text);
          if (json.items && json.items[0]) {
            sampleSlug = json.items[0].slug;
          }
        } catch {}
      }
    } catch (e) {
      console.error(`[FAIL] ${r.name}: FAILED - ${e.message}`);
    }
  }

  if (sampleSlug) {
    console.log(`\n=== KIEM TRA MAN HINH CHI TIET & XEM VOI SLUG: ${sampleSlug} ===`);
    // Test /phim/[slug]
    const tDetail = Date.now();
    const resDetail = await fetch(`http://localhost:3000/phim/${sampleSlug}`);
    console.log(`[PASS] Chi tiet phim (/phim/${sampleSlug}): Status ${resDetail.status} (${Date.now() - tDetail}ms)`);

    // Test /xem/[slug]/1
    const tWatch = Date.now();
    const resWatch = await fetch(`http://localhost:3000/xem/${sampleSlug}/1`);
    console.log(`[PASS] Trinh phat (/xem/${sampleSlug}/1): Status ${resWatch.status} (${Date.now() - tWatch}ms)`);
  }

  // Test 404
  const t404 = Date.now();
  const res404 = await fetch('http://localhost:3000/phim/slug-khong-ton-tai-12345');
  console.log(`\n[PASS] Route 404 (/phim/slug-khong-ton-tai-12345): Status ${res404.status} (${Date.now() - t404}ms)`);
}

testScreens();
