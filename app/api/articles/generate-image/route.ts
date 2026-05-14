import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { generateImageOpenAI } from '@/lib/ai/openai';
import { generateImageGemini } from '@/lib/ai/gemini';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { article_id, image_prompt, image_ai, image_size }: {
      article_id: string;
      image_prompt: string;
      image_ai: string; // any OpenAI image model ID or 'gemini-imagen'
      image_size?: string;
    } = await req.json();

    if (!article_id || !image_prompt) {
      return NextResponse.json({ error: 'article_id và image_prompt bắt buộc' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    const db = createServerClient();
    await db.from('articles').update({ status: 'generating_image', image_prompt }).eq('id', article_id);

    let imageSourceUrl: string;

    try {
      if (image_ai === 'gemini-imagen') {
        if (!settings.gemini_api_key) throw new Error('Gemini API key chưa được cấu hình');
        imageSourceUrl = await generateImageGemini(settings.gemini_api_key, image_prompt);
      } else {
        // All OpenAI image models: gpt-image-1, gpt-image-1-mini, gpt-image-1.5,
        // gpt-image-2, gpt-image-2-2026-04-21, chatgpt-image-latest, dall-e-3, dall-e-2
        if (!settings.openai_api_key) throw new Error('OpenAI API key chưa được cấu hình');
        imageSourceUrl = await generateImageOpenAI(settings.openai_api_key, image_ai, image_prompt, image_size);
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

    // Upload to Supabase Storage
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
