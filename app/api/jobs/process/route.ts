import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { callAI } from '@/lib/ai-router';
import { buildOutlinePrompt, buildContentPrompt, buildImagePromptPrompt } from '@/lib/prompts';
import { generateImageDALLE3 } from '@/lib/ai/openai';
import { generateImageGemini } from '@/lib/ai/gemini';
import { generateSlug, truncate } from '@/lib/utils';
import { OutlineJSON } from '@/types';

// Allow long-running background processing
export const maxDuration = 300;

// Only callable internally
function isInternalCall(req: NextRequest): boolean {
  return req.headers.get('x-internal-call') === '1';
}

async function parseOutline(text: string): Promise<OutlineJSON> {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

async function processJob(jobId: string, articleId: string, settings: Awaited<ReturnType<typeof getSettings>>) {
  const db = createServerClient();
  if (!settings) throw new Error('Settings not available');

  // Mark job as running
  await db.from('article_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', jobId);

  try {
    // Load article
    const { data: article } = await db.from('articles').select('*').eq('id', articleId).single();
    if (!article) throw new Error('Article not found');

    // --- Step 1: Generate Outline ---
    await db.from('articles').update({ status: 'generating_outline' }).eq('id', articleId);

    const outlinePrompt = buildOutlinePrompt({
      keyword: article.keyword,
      article_type: article.article_type,
      h2_count: article.h2_count,
      target_length: article.target_length,
      tone: article.tone,
      has_faq: article.has_faq,
      has_cta: article.has_cta,
    });

    let outline: OutlineJSON | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const rawText = await callAI(article.ai_model, outlinePrompt, settings);
        outline = await parseOutline(rawText);
        break;
      } catch {
        if (attempt === 2) throw new Error('Failed to parse outline after 3 attempts');
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!outline) throw new Error('Outline generation failed');

    const slug = generateSlug(outline.meta_title || article.keyword);

    // Auto-confirm outline
    await db.from('articles').update({
      outline,
      slug,
      meta_title: outline.meta_title,
      meta_description: outline.meta_description,
      status: 'generating_content',
    }).eq('id', articleId);

    // --- Step 2: Generate Content ---
    const contentPrompt = buildContentPrompt({
      keyword: article.keyword,
      tone: article.tone,
      target_length: article.target_length,
      outline: JSON.stringify(outline, null, 2),
    });

    const contentHTML = await callAI(article.ai_model, contentPrompt, settings);
    const plainText = stripHtml(contentHTML);
    const wordCount = countWords(plainText);

    await db.from('articles').update({
      content_html: contentHTML,
      word_count: wordCount,
      status: 'generating_image',
    }).eq('id', articleId);

    // --- Step 3: Generate Image Prompt ---
    const contentSummary = truncate(plainText, 500);
    const imgPromptText = await callAI(
      article.ai_model,
      buildImagePromptPrompt(article.keyword, contentSummary),
      settings
    );
    const imagePrompt = imgPromptText.trim();

    await db.from('articles').update({ image_prompt: imagePrompt }).eq('id', articleId);

    // --- Step 4: Generate Image ---
    const imageAI = article.image_ai || 'dalle3';
    let imageUrl = '';

    try {
      if (imageAI === 'dalle3' && settings.openai_api_key) {
        imageUrl = await generateImageDALLE3(settings.openai_api_key, imagePrompt);
      } else if (settings.gemini_api_key) {
        imageUrl = await generateImageGemini(settings.gemini_api_key, imagePrompt);
      }

      // Save to Supabase Storage
      if (imageUrl) {
        let buffer: Buffer;
        if (imageUrl.startsWith('data:')) {
          buffer = Buffer.from(imageUrl.split(',')[1], 'base64');
        } else {
          const imgRes = await fetch(imageUrl);
          buffer = Buffer.from(await imgRes.arrayBuffer());
        }

        const filename = `articles/${articleId}/featured-${Date.now()}.jpg`;
        const { error: upErr } = await db.storage
          .from('images')
          .upload(filename, new Uint8Array(buffer), { contentType: 'image/jpeg', upsert: true });

        if (!upErr) {
          const { data: urlData } = db.storage.from('images').getPublicUrl(filename);
          imageUrl = urlData.publicUrl;
        }
      }
    } catch (imgErr) {
      // Image generation failed — continue without image
      console.error('Image generation failed:', (imgErr as Error).message);
    }

    // --- Done --- Mark as ready_to_review
    await db.from('articles').update({
      image_url: imageUrl || null,
      image_ai: imageAI,
      status: 'ready_to_review',
      error_message: null,
    }).eq('id', articleId);

    await db.from('article_jobs').update({
      status: 'done',
      finished_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', jobId);

  } catch (err: unknown) {
    const msg = (err as Error).message;
    await db.from('articles').update({ status: 'failed', error_message: msg }).eq('id', articleId);
    await db.from('article_jobs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_message: msg,
    }).eq('id', jobId);
  }
}

export async function POST(req: NextRequest) {
  if (!isInternalCall(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = createServerClient();
    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 500 });

    const maxConcurrent = settings.max_concurrent_jobs || 3;

    // Count running jobs
    const { count: runningCount } = await db
      .from('article_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running');

    const running = runningCount || 0;
    const slots = maxConcurrent - running;

    if (slots <= 0) {
      return NextResponse.json({ message: 'No slots available', running });
    }

    // Pick queued jobs
    const { data: queuedJobs } = await db
      .from('article_jobs')
      .select('id, article_id')
      .eq('status', 'queued')
      .order('queued_at', { ascending: true })
      .limit(slots);

    if (!queuedJobs || queuedJobs.length === 0) {
      return NextResponse.json({ message: 'No queued jobs' });
    }

    // Process each job — each in its own try/catch
    const results = await Promise.allSettled(
      queuedJobs.map((job: { id: string; article_id: string }) =>
        processJob(job.id, job.article_id, settings)
      )
    );

    const processed = results.filter((r) => r.status === 'fulfilled').length;
    const errors = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({ processed, errors, total: queuedJobs.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
