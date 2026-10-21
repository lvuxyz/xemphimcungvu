import { describe, expect, it } from 'vitest';
import { sanitizeHtml, toPlainText } from '@/lib/sanitize';

/**
 * `movie.content` là HTML thô từ API (§14.4). Hai lối ra, hai hợp đồng khác nhau:
 * `sanitizeHtml` trả HTML an toàn để `dangerouslySetInnerHTML`, còn `toPlainText`
 * trả CHỮ để React / metadata tự mã hoá.
 */

describe('toPlainText', () => {
  it('trả chữ thật, không phải HTML đã mã hoá', () => {
    // React và metadata của Next mã hoá thêm lần nữa — để "&amp;" lọt qua là
    // người xem thấy nguyên chữ "&amp;".
    expect(toPlainText('<p>Tom &amp; Jerry &lt;3 &quot;hi&quot;</p>')).toBe('Tom & Jerry <3 "hi"');
  });

  it('hai đoạn văn không dính liền nhau', () => {
    expect(toPlainText('<p>Câu cuối.</p><p>Đoạn sau</p>')).toBe('Câu cuối. Đoạn sau');
    expect(toPlainText('Dòng một<br>dòng hai')).toBe('Dòng một dòng hai');
  });

  it('gom khoảng trắng, kể cả &nbsp;', () => {
    expect(toPlainText('<p>  a&nbsp;&nbsp;b \n c </p>')).toBe('a b c');
  });

  it('bỏ hẳn nội dung script/style chứ không chỉ bỏ thẻ', () => {
    expect(toPlainText('<p>Phim</p><script>alert(1)</script><style>p{}</style>')).toBe('Phim');
  });

  it('cắt theo từ và thêm dấu ba chấm', () => {
    expect(toPlainText('<p>một hai ba bốn năm</p>', 10)).toBe('một hai…');
    expect(toPlainText('<p>ngắn</p>', 10)).toBe('ngắn');
  });

  it('rỗng vào, rỗng ra', () => {
    expect(toPlainText('')).toBe('');
  });
});

describe('sanitizeHtml', () => {
  it('giữ thẻ trong whitelist, bỏ script và thuộc tính sự kiện', () => {
    const clean = sanitizeHtml(
      '<p onclick="x()">Hi <strong>there</strong><script>alert(1)</script></p>',
    );
    expect(clean).toBe('<p>Hi <strong>there</strong></p>');
  });

  it('chặn javascript: trên link', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
  });
});
