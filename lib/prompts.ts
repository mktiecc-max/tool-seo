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
  return `Bạn là chuyên gia SEO. Tạo outline cho bài viết với yêu cầu:
- Từ khóa chính: ${params.keyword}
- Loại bài: ${params.article_type}
- Số H2: ${params.h2_count}
- Phong cách: ${params.tone}
- Độ dài mục tiêu: ${params.target_length} ký tự
- Có FAQ: ${params.has_faq ? 'Có' : 'Không'}
- Có CTA: ${params.has_cta ? 'Có' : 'Không'}

Trả về JSON theo format (không có markdown, chỉ JSON thuần):
{
  "h1": "...",
  "sections": [
    { "h2": "...", "h3s": ["...", "..."], "notes": "..." }
  ],
  "faq": ["câu hỏi 1", "câu hỏi 2"],
  "meta_title": "...",
  "meta_description": "..."
}`;
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

  return `Bạn là chuyên gia SEO viết nội dung tiếng Việt. Viết bài hoàn chỉnh theo outline sau.

Từ khóa chính: ${params.keyword}
Phong cách: ${toneMap[params.tone] || params.tone}
Độ dài mục tiêu: ${params.target_length} ký tự
Outline: ${params.outline}

Yêu cầu:
- Viết đầy đủ từng section theo outline
- Từ khóa chính xuất hiện tự nhiên 1-2% mật độ
- Mỗi H2 có ít nhất 2-3 đoạn văn
- Không dùng từ sáo rỗng như "trong bài viết này", "như chúng ta đã biết"
- Trả về HTML thuần: chỉ dùng thẻ h1, h2, h3, p, ul, ol, li, strong, em
- Không có DOCTYPE, html, body, head, style, script`;
}

export function buildImagePromptPrompt(keyword: string, contentSummary: string): string {
  return `Dựa trên bài viết về "${keyword}" với nội dung sau (tóm tắt):
${contentSummary}

Hãy viết 1 image prompt tiếng Anh, mô tả ảnh featured image phù hợp cho bài viết này.
Yêu cầu: ảnh thực tế (photorealistic), không có chữ, ánh sáng tự nhiên, chuyên nghiệp.
Trả về chỉ duy nhất image prompt, không có gì khác.`;
}
