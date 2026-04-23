import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { ArticleType, ArticleTone, AIModel, ImageAI } from '@/types';

interface BatchConfig {
  article_type: ArticleType;
  tone: ArticleTone;
  h2_count: number;
  target_length: number;
  has_faq: boolean;
  has_cta: boolean;
  ai_model: AIModel;
  image_ai: ImageAI;
}

export async function POST(req: NextRequest) {
  try {
    const { keyword_ids, config }: {
      keyword_ids: string[];
      config: BatchConfig;
    } = await req.json();

    if (!keyword_ids || keyword_ids.length === 0) {
      return NextResponse.json({ error: 'Danh sách keyword_ids trống' }, { status: 400 });
    }
    if (keyword_ids.length > 50) {
      return NextResponse.json({ error: 'Tối đa 50 từ khóa mỗi lần batch' }, { status: 400 });
    }

    const db = createServerClient();

    // Load keywords
    const { data: keywords, error: kwError } = await db
      .from('keywords')
      .select('id, keyword')
      .in('id', keyword_ids);

    if (kwError) throw new Error(kwError.message);
    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy từ khóa nào' }, { status: 404 });
    }

    const article_ids: string[] = [];

    for (const kw of keywords) {
      // Insert article
      const { data: article, error: artError } = await db
        .from('articles')
        .insert({
          keyword_id: kw.id,
          keyword: kw.keyword,
          article_type: config.article_type,
          tone: config.tone,
          h2_count: config.h2_count,
          target_length: config.target_length,
          has_faq: config.has_faq,
          has_cta: config.has_cta,
          ai_model: config.ai_model,
          image_ai: config.image_ai,
          status: 'configuring',
        })
        .select('id')
        .single();

      if (artError || !article) continue;
      article_ids.push(article.id);

      // Insert job
      await db.from('article_jobs').insert({
        article_id: article.id,
        status: 'queued',
      });

      // Update keyword status
      await db.from('keywords').update({ status: 'queued' }).eq('id', kw.id);
    }

    // Kick-start worker (fire-and-forget — no await)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/jobs/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-call': '1' },
    }).catch(() => { /* ignore */ });

    return NextResponse.json({ queued: article_ids.length, article_ids });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
