import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { article_id, image_url }: { article_id: string; image_url: string } = await req.json();
    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });

    const db = createServerClient();
    const { data, error } = await db
      .from('articles')
      .update({ image_url, status: 'image_review' })
      .eq('id', article_id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ article: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
