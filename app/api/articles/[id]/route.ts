import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ArticleStatus } from '@/types';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const db = createServerClient();
    const { data, error } = await db.from('articles').select('*').eq('id', params.id).single();
    if (error || !data) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });
    return NextResponse.json({ article: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body: {
      content_html?: string;
      meta_title?: string;
      meta_description?: string;
      slug?: string;
      image_prompt?: string;
      status?: ArticleStatus;
    } = await req.json();

    const updatePayload: Record<string, unknown> = {};
    if (body.content_html !== undefined) updatePayload.content_html = body.content_html;
    if (body.meta_title !== undefined) updatePayload.meta_title = body.meta_title;
    if (body.meta_description !== undefined) updatePayload.meta_description = body.meta_description;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.image_prompt !== undefined) updatePayload.image_prompt = body.image_prompt;
    if (body.status !== undefined) updatePayload.status = body.status;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Không có field nào cần cập nhật' }, { status: 400 });
    }

    const db = createServerClient();
    const { error } = await db.from('articles').update(updatePayload).eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const db = createServerClient();
    const { error } = await db.from('articles').delete().eq('id', params.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
