import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { generateImageFromReference } from '@/lib/ai/openai';

export async function POST(req: NextRequest) {
  try {
    const {
      article_id,
      image_prompt,
      reference_image_base64,
      reference_image_mime,
      image_size,
    }: {
      article_id: string;
      image_prompt: string;
      reference_image_base64: string;
      reference_image_mime: string;
      image_size?: string;
    } = await req.json();

    if (!article_id || !image_prompt || !reference_image_base64) {
      return NextResponse.json(
        { error: 'article_id, image_prompt và reference_image_base64 bắt buộc' },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });
    if (!settings.openai_api_key) {
      return NextResponse.json({ error: 'OpenAI API key chưa được cấu hình' }, { status: 400 });
    }

    const db = createServerClient();
    await db
      .from('articles')
      .update({ status: 'generating_image', image_prompt })
      .eq('id', article_id);

    let imageDataUrl: string;
    try {
      imageDataUrl = await generateImageFromReference(
        settings.openai_api_key,
        image_prompt,
        reference_image_base64,
        reference_image_mime || 'image/png',
        image_size
      );
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (
        msg.toLowerCase().includes('safety') ||
        msg.toLowerCase().includes('policy') ||
        msg.toLowerCase().includes('content')
      ) {
        await db
          .from('articles')
          .update({ status: 'generating_image', error_message: null })
          .eq('id', article_id);
        return NextResponse.json(
          {
            error: 'Prompt vi phạm chính sách nội dung. Hãy chỉnh sửa prompt và thử lại.',
            policy_violation: true,
          },
          { status: 422 }
        );
      }
      throw e;
    }

    // Upload base64 image to Supabase Storage
    const base64Data = imageDataUrl.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const filename = `articles/${article_id}/ref-gen-${Date.now()}.png`;

    const { data: uploadData, error: uploadError } = await db.storage
      .from('images')
      .upload(filename, imageBuffer, { contentType: 'image/png', upsert: true });

    let finalUrl = imageDataUrl;
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = db.storage.from('images').getPublicUrl(filename);
      finalUrl = publicUrlData.publicUrl;
    }

    await db
      .from('articles')
      .update({
        image_url: finalUrl,
        image_ai: 'dalle3',
        status: 'image_review',
        error_message: null,
      })
      .eq('id', article_id);

    return NextResponse.json({ image_url: finalUrl });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
