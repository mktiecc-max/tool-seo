import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { buildImagePromptPrompt, imagePromptJSONToEnglish, ImagePromptJSON } from '@/lib/prompts';
import { callAI } from '@/lib/ai-router';
import { truncate } from '@/lib/utils';
import { buildBrandImageContext } from '@/lib/brand-context';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { article_id }: { article_id: string } = await req.json();
    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });

    const db = createServerClient();
    const { data: article } = await db.from('articles').select('*').eq('id', article_id).single();
    if (!article) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    const contentSummary = article.content_html
      ? truncate(article.content_html.replace(/<[^>]*>/g, ''), 500)
      : '';

    // Fetch brand kit for image rules
    let brandImageContext = '';
    if (article.brand_kit_id) {
      const { data: brandKit } = await db.from('brand_kits').select('*').eq('id', article.brand_kit_id).single();
      if (brandKit) brandImageContext = buildBrandImageContext(brandKit);
    }

    // Lấy tiêu đề bài viết để dùng làm text trong ảnh
    const articleTitle = article.meta_title || article.keyword;
    const prompt = buildImagePromptPrompt(article.keyword, contentSummary, articleTitle) + brandImageContext;
    const rawText = await callAI(article.ai_model, prompt, settings);

    // Parse JSON từ AI response
    let imagePromptJSON: ImagePromptJSON;
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();
      imagePromptJSON = JSON.parse(cleaned);
    } catch {
      // Nếu AI không trả về JSON hợp lệ, tạo cấu trúc 3-phần mặc định
      imagePromptJSON = {
        background: rawText.trim() || `Không gian học tập hiện đại, ánh sáng tự nhiên, liên quan đến chủ đề ${article.keyword}`,
        logo: 'Logo đặt góc trên bên trái hoặc chính giữa phía trên, kích thước vừa phải, nền trong suốt',
        title_text: articleTitle,
      };
    }

    // Lưu dạng JSON string để UI có thể parse và hiển thị form
    const imagePromptStr = JSON.stringify(imagePromptJSON, null, 2);

    await db.from('articles').update({ image_prompt: imagePromptStr }).eq('id', article_id);

    return NextResponse.json({
      image_prompt: imagePromptStr,
      image_prompt_json: imagePromptJSON,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
