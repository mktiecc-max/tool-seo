import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateSlug } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { article_id, content_html, meta_title, meta_description, slug }: {
      article_id: string;
      content_html: string;
      meta_title: string;
      meta_description: string;
      slug: string;
    } = await req.json();

    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });

    const db = createServerClient();
    const finalSlug = slug || generateSlug(meta_title || '');

    const { data, error } = await db
      .from('articles')
      .update({
        content_html,
        meta_title,
        meta_description,
        slug: finalSlug,
        status: 'generating_image',
      })
      .eq('id', article_id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ article: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
