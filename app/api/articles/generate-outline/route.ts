import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { buildOutlinePrompt } from '@/lib/prompts';
import { callAI } from '@/lib/ai-router';
import { generateSlug } from '@/lib/utils';
import { buildBrandContext } from '@/lib/brand-context';
import { OutlineJSON, AIModel, ArticleType, ArticleTone } from '@/types';

async function parseOutlineJSON(text: string): Promise<OutlineJSON> {
  // Strip markdown code blocks if present
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      article_id,
      keyword,
      keyword_id,
      article_type,
      h2_count,
      target_length,
      tone,
      has_faq,
      has_cta,
      ai_model,
      brand_kit_id,
    }: {
      article_id?: string;
      keyword: string;
      keyword_id?: string;
      article_type: ArticleType;
      h2_count: number;
      target_length: number;
      tone: ArticleTone;
      has_faq: boolean;
      has_cta: boolean;
      ai_model: AIModel;
      brand_kit_id?: string;
    } = body;

    if (!keyword) return NextResponse.json({ error: 'Từ khóa không được để trống' }, { status: 400 });

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    const db = createServerClient();

    // Fetch brand kit if provided
    let brandSystemPrompt: string | undefined;
    if (brand_kit_id) {
      const { data: brandKit } = await db.from('brand_kits').select('*').eq('id', brand_kit_id).single();
      if (brandKit) brandSystemPrompt = buildBrandContext(brandKit) || undefined;
    }

    const prompt = buildOutlinePrompt({ keyword, article_type, h2_count, target_length, tone, has_faq, has_cta });

    let outline: OutlineJSON | null = null;
    let lastError = '';

    // Try up to 3 times (2 retries)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rawText = await callAI(ai_model, prompt, settings, brandSystemPrompt);
        outline = await parseOutlineJSON(rawText);
        break;
      } catch (e) {
        lastError = (e as Error).message;
        if (attempt === 2) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!outline) {
      // If DB article exists, mark as failed
      if (article_id) {
        await db.from('articles').update({ status: 'failed', error_message: `JSON parse fail: ${lastError}` }).eq('id', article_id);
      }
      return NextResponse.json({ error: `Không thể parse outline: ${lastError}` }, { status: 500 });
    }

    const slug = generateSlug(outline.meta_title || keyword);

    let article;
    if (article_id) {
      const { data } = await db
        .from('articles')
        .update({ outline, status: 'outline_review', meta_title: outline.meta_title, meta_description: outline.meta_description, slug })
        .eq('id', article_id)
        .select()
        .single();
      article = data;
    } else {
      const { data } = await db
        .from('articles')
        .insert({
          keyword,
          keyword_id: keyword_id || null,
          article_type,
          h2_count,
          target_length,
          tone,
          has_faq,
          has_cta,
          ai_model,
          brand_kit_id: brand_kit_id || null,
          outline,
          meta_title: outline.meta_title,
          meta_description: outline.meta_description,
          slug,
          status: 'outline_review',
        })
        .select()
        .single();
      article = data;

      // Update keyword status if provided
      if (keyword_id) {
        await db.from('keywords').update({ status: 'queued' }).eq('id', keyword_id);
      }
    }

    return NextResponse.json({ article_id: article?.id, outline, article });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
