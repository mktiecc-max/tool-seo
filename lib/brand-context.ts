import { BrandKit } from '@/types';

/**
 * Tổng hợp toàn bộ Brand Kit thành 1 đoạn text để inject vào system prompt của AI.
 * Trả về chuỗi rỗng nếu không có brand kit.
 */
export function buildBrandContext(kit: BrandKit | null | undefined): string {
  if (!kit) return '';

  const sections: string[] = [];

  sections.push(`=== BỘ NHẬN DIỆN THƯƠNG HIỆU ===`);
  sections.push(`Tên thương hiệu: ${kit.name}`);

  if (kit.description) {
    sections.push(`Mô tả: ${kit.description}`);
  }

  if (kit.target_audience) {
    sections.push(`\nĐỐI TƯỢNG MỤC TIÊU: ${kit.target_audience}`);
  }

  if (kit.tone_of_voice) {
    sections.push(`\nGIỌNG VĂN & PHONG CÁCH: ${kit.tone_of_voice}`);
  }

  if (kit.forbidden_words && kit.forbidden_words.length > 0) {
    sections.push(`\nTỪ NGỮ CẦN TRÁNH (KHÔNG được dùng các từ này): ${kit.forbidden_words.join(', ')}`);
  }

  if (kit.writing_rules) {
    sections.push(`\nQUY TẮC VIẾT BÀI:\n${kit.writing_rules}`);
  }

  if (kit.brand_colors && kit.brand_colors.length > 0) {
    sections.push(`\nMÀU SẮC THƯƠNG HIỆU: ${kit.brand_colors.join(', ')}`);
  }

  // Inject nội dung từ các file hướng dẫn đã upload
  if (kit.guide_files && kit.guide_files.length > 0) {
    const fileContents = kit.guide_files
      .filter((f) => f.content_text?.trim())
      .map((f) => `--- File: ${f.name} ---\n${f.content_text.trim()}`)
      .join('\n\n');
    if (fileContents) {
      sections.push(`\nTÀI LIỆU HƯỚNG DẪN THƯƠNG HIỆU:\n${fileContents}`);
    }
  }

  sections.push(`\n=== KẾT THÚC BỘ NHẬN DIỆN THƯƠNG HIỆU ===`);
  sections.push(`QUAN TRỌNG: Toàn bộ nội dung bạn tạo ra PHẢI tuân thủ đúng bộ nhận diện thương hiệu ở trên.`);

  return sections.join('\n');
}

/**
 * Tổng hợp image rules từ Brand Kit để inject vào image prompt.
 */
export function buildBrandImageContext(kit: BrandKit | null | undefined): string {
  if (!kit) return '';

  const parts: string[] = [];

  if (kit.image_style) {
    parts.push(`Phong cách ảnh: ${kit.image_style}`);
  }
  if (kit.image_rules) {
    parts.push(`Quy tắc ảnh:\n${kit.image_rules}`);
  }
  if (kit.brand_colors && kit.brand_colors.length > 0) {
    parts.push(`Màu sắc thương hiệu (ưu tiên dùng): ${kit.brand_colors.join(', ')}`);
  }

  if (parts.length === 0) return '';
  return `\n\n[BRAND IMAGE RULES]\n${parts.join('\n')}\n[/BRAND IMAGE RULES]`;
}
