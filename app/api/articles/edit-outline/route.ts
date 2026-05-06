import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { callAI } from '@/lib/ai-router';
import { OutlineJSON, AIModel } from '@/types';

function parseOutlineJSON(text: string): OutlineJSON {
  // Strip markdown code blocks if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      article_id,
      current_outline,
      user_prompt,
      ai_model,
    }: {
      article_id: string;
      current_outline: OutlineJSON;
      user_prompt: string;
      ai_model?: AIModel;
    } = body;

    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });
    if (!user_prompt) return NextResponse.json({ error: 'Vui lòng nhập yêu cầu' }, { status: 400 });

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    const db = createServerClient();

    // Fetch article to get ai_model if not provided
    let model: AIModel = ai_model || 'gpt4o';
    if (!ai_model) {
      const { data: art } = await db.from('articles').select('ai_model').eq('id', article_id).single();
      if (art?.ai_model) model = art.ai_model;
    }

    const prompt = `Bạn là chuyên gia SEO. Đây là outline hiện tại của một bài viết:

${JSON.stringify(current_outline, null, 2)}

Người dùng yêu cầu chỉnh sửa outline như sau:
"${user_prompt}"

Hãy thực hiện yêu cầu trên và trả về outline đã chỉnh sửa dưới dạng JSON (không có markdown, chỉ JSON thuần) theo đúng format:
{
  "h1": "...",
  "sections": [
    { "h2": "...", "h3s": ["...", "..."], "notes": "..." }
  ],
  "faq": ["câu hỏi 1", "câu hỏi 2"],
  "meta_title": "...",
  "meta_description": "..."
}

Lưu ý:
- Giữ nguyên những phần không liên quan đến yêu cầu chỉnh sửa
- Chỉ thay đổi/thêm/xóa đúng phần người dùng yêu cầu
- Đảm bảo outline vẫn logic và mạch lạc sau khi chỉnh sửa
- Luôn trả về JSON thuần, không có text khác`;

    let outline: OutlineJSON | null = null;
    let lastError = '';

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rawText = await callAI(model, prompt, settings);
        outline = parseOutlineJSON(rawText);
        break;
      } catch (e) {
        lastError = (e as Error).message;
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!outline) {
      return NextResponse.json({ error: `Không thể parse outline: ${lastError}` }, { status: 500 });
    }

    // Save updated outline to DB
    const { data, error } = await db
      .from('articles')
      .update({
        outline,
        meta_title: outline.meta_title,
        meta_description: outline.meta_description,
      })
      .eq('id', article_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ article: data, outline });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
