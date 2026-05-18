import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { generateImageOpenAI } from '@/lib/ai/openai';
import { generateImageGemini } from '@/lib/ai/gemini';
import { bannerJSONToPrompt, type BannerDesignJSON } from '@/lib/banner-design';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const {
      article_id,
      banner_json,
      image_ai,
      image_size,
      custom_content,
    }: {
      article_id: string;
      banner_json: BannerDesignJSON;
      image_ai: string;
      image_size?: string;
      custom_content?: {
        dong_1?: string;
        dong_2?: string;
        dong_3?: string;
      };
    } = await req.json();

    if (!article_id || !banner_json) {
      return NextResponse.json({ error: 'article_id và banner_json bắt buộc' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings) return NextResponse.json({ error: 'Không lấy được cấu hình' }, { status: 500 });

    const db = createServerClient();

    // Check article tồn tại
    const { data: article } = await db
      .from('articles')
      .select('id, keyword')
      .eq('id', article_id)
      .maybeSingle();

    if (!article) {
      return NextResponse.json({ error: 'Bài viết không tồn tại' }, { status: 404 });
    }

    // Build English prompt từ banner JSON
    const finalPrompt = bannerJSONToPrompt(banner_json, custom_content, article.keyword);

    // Gọi AI tạo ảnh
    let imageSourceUrl: string;
    try {
      if (image_ai === 'gemini-imagen') {
        if (!settings.gemini_api_key) throw new Error('Gemini API key chưa được cấu hình');
        imageSourceUrl = await generateImageGemini(settings.gemini_api_key, finalPrompt);
      } else {
        if (!settings.openai_api_key) throw new Error('OpenAI API key chưa được cấu hình');
        // Banner dùng size ngang 16:9 mặc định
        const bannerSize = image_size || '1792x1024';
        imageSourceUrl = await generateImageOpenAI(settings.openai_api_key, image_ai, finalPrompt, bannerSize);
      }
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (
        msg.toLowerCase().includes('safety') ||
        msg.toLowerCase().includes('policy') ||
        msg.toLowerCase().includes('content')
      ) {
        return NextResponse.json(
          { error: 'Prompt vi phạm chính sách nội dung. Hãy điều chỉnh nội dung và thử lại.', policy_violation: true },
          { status: 422 }
        );
      }
      throw e;
    }

    // Upload lên Supabase Storage
    const imageBuffer = await fetchImageBuffer(imageSourceUrl);
    const ext = imageSourceUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const filename = `articles/${article_id}/banner-${Date.now()}.${ext}`;
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const { data: uploadData, error: uploadError } = await db.storage
      .from('images')
      .upload(filename, imageBuffer, { contentType, upsert: true });

    let finalUrl = imageSourceUrl;
    if (!uploadError && uploadData) {
      const { data: publicUrlData } = db.storage.from('images').getPublicUrl(filename);
      finalUrl = publicUrlData.publicUrl;
    }

    return NextResponse.json({
      image_url: finalUrl,
      prompt_used: finalPrompt,
    });
  } catch (err: unknown) {
    console.error('[generate-banner]', err);
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
