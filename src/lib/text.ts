/**
 * Chuẩn hoá chuỗi tiếng Việt để so khớp tìm kiếm.
 *
 * Người dùng gõ không dấu là chuyện bình thường: "thien" phải ra "Thiên",
 * "do kiem" phải ra "Độc Kiếm". Tách dấu bằng NFD rồi bỏ dấu tổ hợp,
 * và xử lý riêng `đ/Đ` vì ký tự này không phân tách được bằng NFD.
 */
export function deaccent(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Khoá so khớp: bỏ dấu, hạ chữ thường, gom khoảng trắng. */
export function searchKey(input: string): string {
  return deaccent(input ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** `needle` đã đi qua `searchKey`; `haystack` là chuỗi gốc. */
export function matchesSearch(haystack: string, needle: string): boolean {
  if (needle === '') return false;
  return searchKey(haystack).includes(needle);
}
