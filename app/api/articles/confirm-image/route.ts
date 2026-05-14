import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { article_id, image_url, skip_image }: {
      article_id: string;
      image_url?: string | null;
      skip_image?: boolean;
    } = await req.json();
    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });

    const db = createServerClient();

    // skip_image = true → bỏ qua ảnh, đăng WordPress ngay (status: publishing)
    // skip_image = false/undefined → xác nhận ảnh, vào hàng chờ đăng (status: publishing)
    const updatePayload: Record<string, unknown> = {
      status: 'publishing',
    };
    if (image_url) updatePayload.image_url = image_url;

    const { data, error } = await db
      .from('articles')
      .update(updatePayload)
      .eq('id', article_id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Fire-and-forget publish to WordPress
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/articles/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id }),
    }).catch(() => {});

    return NextResponse.json({ article: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
