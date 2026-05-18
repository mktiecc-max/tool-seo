import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { generateImageOpenAI } from '@/lib/ai/openai';
import { generateImageGemini } from '@/lib/ai/gemini';
import { imagePromptJSONToEnglish, ImagePromptJSON } from '@/lib/prompts';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { article_id, image_prompt, image_ai, image_size }: {
      article_id: string;
      image_prompt: string;
      image_ai: string;
      image_size?: string;
    } = await req.json();

    if (!article_id || !image_prompt) {
      return NextResponse.json({ error: 'article_id và image_prompt bắt buộc' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    const db = createServerClient();

    // ── Check 1: bài còn tồn tại không? ─────────────────────────────────────
    const { data: existsBefore } = await db
      .from('articles')
      .select('id')
      .eq('id', article_id)
      .maybeSingle();

    if (!existsBefore) {
      console.log(`[generate-image] Article ${article_id} đã bị xóa, bỏ qua.`);
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    await db.from('articles').update({ status: 'generating_image', image_prompt }).eq('id', article_id);

    // ── Convert JSON prompt → English nếu cần ─────────────────────────────
    let finalPrompt = image_prompt;
    try {
      const parsed: ImagePromptJSON = JSON.parse(image_prompt);
      if (parsed.background || (parsed as unknown as Record<string,string>).mo_ta_canh) {
        finalPrompt = imagePromptJSONToEnglish(parsed);
      }
    } catch {
      // Không phải JSON → dùng trực tiếp
    }

    // ── Gọi AI API (có thể mất 15–60s) ──────────────────────────────────────
    let imageSourceUrl: string;
    try {
      if (image_ai === 'gemini-imagen') {
        if (!settings.gemini_api_key) throw new Error('Gemini API key chưa được cấu hình');
        imageSourceUrl = await generateImageGemini(settings.gemini_api_key, finalPrompt);
      } else {
        if (!settings.openai_api_key) throw new Error('OpenAI API key chưa được cấu hình');
        imageSourceUrl = await generateImageOpenAI(settings.openai_api_key, image_ai, finalPrompt, image_size);
      }
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('policy') || msg.toLowerCase().includes('content')) {
        await db.from('articles').update({ status: 'generating_image', error_message: null }).eq('id', article_id);
        return NextResponse.json({
          error: 'Prompt vi phạm chính sách nội dung. Hãy chỉnh sửa prompt và thử lại.',
          policy_violation: true,
        }, { status: 422 });
      }
      throw e;
    }

    // ── Check 2: bài vẫn còn sau khi AI xong không? ──────────────────────────
    const { data: existsAfter } = await db
      .from('articles')
      .select('id')
      .eq('id', article_id)
      .maybeSingle();

    if (!existsAfter) {
      console.log(`[generate-image] Article ${article_id} bị xóa trong lúc AI đang chạy, bỏ qua upload.`);
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    // ── Upload to Supabase Storage ────────────────────────────────────────────
    const imageBuffer = await fetchImageBuffer(imageSourceUrl);
    const ext = imageSourceUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const filename = `articles/${article_id}/featured-${Date.now()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const { data: uploadData, error: uploadError } = await db.storage
      .from('images')
      .upload(filename, imageBuffer, { contentType, upsert: true });

    let finalUrl = imageSourceUrl;
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = db.storage.from('images').getPublicUrl(filename);
      finalUrl = publicUrlData.publicUrl;
    }

    await db.from('articles').update({
      image_url: finalUrl,
      image_ai,
      status: 'image_review',
      error_message: null,
    }).eq('id', article_id);

    return NextResponse.json({ image_url: finalUrl });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    return Buffer.from(base64, 'base64');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

