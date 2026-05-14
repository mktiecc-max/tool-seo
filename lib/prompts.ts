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

export interface ImagePromptJSON {
  mo_ta_canh: string;   // Mô tả cảnh vật/đối tượng trong ảnh (tiếng Việt)
  phong_cach: string;   // Phong cách ảnh (thực tế, minh họa, v.v.)
  mau_sac: string;      // Tông màu chủ đạo
  bo_sung: string;      // Yêu cầu bổ sung (góc chụp, không có chữ, v.v.)
}

export function buildImagePromptPrompt(keyword: string, contentSummary: string): string {
  return `Dựa trên bài viết về "${keyword}" với nội dung tóm tắt:
${contentSummary}

Hãy tạo mô tả ảnh featured image cho bài viết này. Trả về JSON thuần (KHÔNG có markdown, KHÔNG có \`\`\`json, chỉ JSON):
{
  "mo_ta_canh": "Mô tả chi tiết cảnh vật/đối tượng trong ảnh bằng tiếng Việt, liên quan trực tiếp đến chủ đề ${keyword}. Ví dụ: Một người đang làm việc trên laptop tại bàn làm việc hiện đại",
  "phong_cach": "Phong cách ảnh. Ví dụ: Ảnh thực tế chuyên nghiệp (photorealistic), ánh sáng tự nhiên ban ngày",
  "mau_sac": "Tông màu chủ đạo. Ví dụ: Tông xanh lá và trắng, tươi sáng, hiện đại",
  "bo_sung": "Yêu cầu thêm. Ví dụ: Không có chữ trong ảnh, góc chụp ngang, độ sâu trường ảnh얕"
}`;
}

/**
 * Chuyển ImagePromptJSON sang prompt tiếng Anh để gửi cho model ảnh
 */
export function imagePromptJSONToEnglish(json: ImagePromptJSON): string {
  return [
    json.mo_ta_canh,
    json.phong_cach,
    `Color palette: ${json.mau_sac}`,
    json.bo_sung,
    'No text or watermark in the image.',
  ].filter(Boolean).join('. ');
}
