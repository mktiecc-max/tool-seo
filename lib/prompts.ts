// ============================================================
// All AI Prompts
// ============================================================

export function buildOutlinePrompt(params: {
  keyword: string;
  article_type: string;
  h2_count: number;
  tone: string;
  target_length: number;
  has_faq: boolean;
  has_cta: boolean;
}): string {
  return `Bạn là chuyên gia SEO. Tạo outline cho bài viết với yêu cầu:\n- Từ khóa chính: ${params.keyword}\n- Loại bài: ${params.article_type}\n- Số H2: ${params.h2_count}\n- Phong cách: ${params.tone}\n- Độ dài mục tiêu: ${params.target_length} ký tự\n- Có FAQ: ${params.has_faq ? 'Có' : 'Không'}\n- Có CTA: ${params.has_cta ? 'Có' : 'Không'}\n\nTrả về JSON theo format (không có markdown, chỉ JSON thuần):\n{\n  "h1": "...",\n  "sections": [\n    { "h2": "...", "h3s": ["...", "..."], "notes": "..." }\n  ],\n  "faq": ["câu hỏi 1", "câu hỏi 2"],\n  "meta_title": "...",\n  "meta_description": "..."\n}`;
}

export function buildContentPrompt(params: {
  keyword: string;
  tone: string;
  target_length: number;
  outline: string;
}): string {
  const toneMap: Record<string, string> = {
    expert: 'Chuyên gia / Học thuật — viết chuyên sâu, trích dẫn số liệu, dùng thuật ngữ chuyên ngành',
    friendly: 'Thân thiện / Gần gũi — viết như đang nói chuyện với bạn bè, dùng từ ngữ đơn giản',
    persuasive: 'Bán hàng / Thuyết phục — tập trung vào lợi ích, kêu gọi hành động',
    neutral: 'Trung lập / Thông tin — cung cấp thông tin khách quan, không thiên vị',
  };

  return `Bạn là chuyên gia SEO viết nội dung tiếng Việt. Viết bài hoàn chỉnh theo outline sau.\n\nTừ khóa chính: ${params.keyword}\nPhong cách: ${toneMap[params.tone] || params.tone}\nĐộ dài mục tiêu: ${params.target_length} ký tự\nOutline: ${params.outline}\n\nYêu cầu:\n- Viết đầy đủ từng section theo outline\n- Từ khóa chính xuất hiện tự nhiên 1-2% mật độ\n- Mỗi H2 có ít nhất 2-3 đoạn văn\n- Không dùng từ sáo rỗng như "trong bài viết này", "như chúng ta đã biết"\n- Trả về HTML thuần: chỉ dùng thẻ h1, h2, h3, p, ul, ol, li, strong, em\n- Không có DOCTYPE, html, body, head, style, script`;
}

/**
 * Cấu trúc prompt ảnh chuẩn — 3 phần chính:
 * 1. background: ảnh nền phù hợp chủ đề nội dung
 * 2. logo: vị trí và cách đặt logo thương hiệu
 * 3. title_text: tiêu đề bài viết hiển thị trực tiếp trong ảnh
 */
export interface ImagePromptJSON {
  background: string;   // Mô tả ảnh nền phù hợp chủ đề (tiếng Việt)
  logo: string;         // Hướng dẫn vị trí logo thương hiệu
  title_text: string;   // Tiêu đề bài viết hiển thị trong ảnh
}

export function buildImagePromptPrompt(keyword: string, contentSummary: string, articleTitle?: string): string {
  const titleNote = articleTitle
    ? `Tiêu đề bài viết (dùng làm text trong ảnh): "${articleTitle}"`
    : `Từ khóa chính: "${keyword}"`;

  return `Dựa trên bài viết về "${keyword}" với nội dung tóm tắt:
${contentSummary}

${titleNote}

Hãy tạo mô tả ảnh featured image theo đúng 3 phần sau. Trả về JSON thuần (KHÔNG có markdown, KHÔNG có \`\`\`json, chỉ JSON thuần):
{
  "background": "Mô tả chi tiết ảnh nền phù hợp với chủ đề '${keyword}'. Ảnh thực tế chuyên nghiệp (photorealistic), ánh sáng tự nhiên, chất lượng cao. Ví dụ: Không gian văn phòng hiện đại với bàn làm việc gọn gàng, ánh sáng tự nhiên từ cửa sổ, tông màu trắng và xanh nhạt",
  "logo": "Vị trí đặt logo thương hiệu trong ảnh. Ví dụ: Logo đặt góc trên bên trái, kích thước vừa phải, nền trong suốt, không che khuất nội dung chính",
  "title_text": "${articleTitle || keyword}"
}`;
}

/**
 * Chuyển ImagePromptJSON (3 phần) sang English prompt gửi cho model ảnh
 */
export function imagePromptJSONToEnglish(json: ImagePromptJSON): string {
  const parts: string[] = [];

  // Part 1: Background
  parts.push(`BACKGROUND: ${json.background}`);

  // Part 2: Logo placement
  if (json.logo) {
    parts.push(`LOGO: ${json.logo}`);
  }

  // Part 3: Title text overlay
  if (json.title_text) {
    parts.push(
      `TEXT OVERLAY: Render the following Vietnamese title text clearly and prominently in the image: "${json.title_text}". ` +
      `Use large, bold, modern sans-serif font. Ensure all Vietnamese diacritical marks are correct. ` +
      `Place text in a readable area with sufficient contrast (white text on dark overlay or dark text on light area).`
    );
  }

  parts.push('High quality, professional marketing image, 4K resolution, wide banner format.');

  return parts.join(' | ');
}
