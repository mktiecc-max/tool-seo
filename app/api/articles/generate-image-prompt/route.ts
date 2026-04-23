import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { buildImagePromptPrompt } from '@/lib/prompts';
import { callAI } from '@/lib/ai-router';
import { truncate } from '@/lib/utils';

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

    const prompt = buildImagePromptPrompt(article.keyword, contentSummary);
    const imagePromptText = await callAI(article.ai_model, prompt, settings);

    await db.from('articles').update({ image_prompt: imagePromptText.trim() }).eq('id', article_id);

    return NextResponse.json({ image_prompt: imagePromptText.trim() });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
