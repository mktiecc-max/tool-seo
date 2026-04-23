import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { buildContentPrompt } from '@/lib/prompts';
import { callAIStream } from '@/lib/ai-router';

export async function POST(req: NextRequest) {
  try {
    const { article_id }: { article_id: string } = await req.json();
    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });

    const db = createServerClient();
    const { data: article } = await db.from('articles').select('*').eq('id', article_id).single();
    if (!article) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    await db.from('articles').update({ status: 'generating_content' }).eq('id', article_id);

    const prompt = buildContentPrompt({
      keyword: article.keyword,
      tone: article.tone,
      target_length: article.target_length,
      outline: JSON.stringify(article.outline, null, 2),
    });

    const aiStream = await callAIStream(article.ai_model, prompt, settings);

    // Create a transform stream that collects content and saves to DB on finish
    let fullContent = '';

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        fullContent += text;
        controller.enqueue(chunk);
      },
      async flush() {
        // Save to DB when stream ends
        try {
          // Post-process: ensure clean HTML
          const cleanedHTML = fullContent.trim();
          await db.from('articles').update({
            content_html: cleanedHTML,
            status: 'content_review',
            error_message: null,
          }).eq('id', article_id);
        } catch (e) {
          console.error('Failed to save content:', e);
        }
      },
    });

    const responseStream = aiStream.pipeThrough(transformStream);

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
