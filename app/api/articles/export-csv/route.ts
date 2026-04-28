import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { Article } from '@/types';

function escapeCSV(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function articleToRow(a: Article): string {
  const h2s = a.outline?.sections?.map((s) => s.h2).join(' | ') || '';
  const wpUrl = a.wp_post_id
    ? `${a.slug ? `[see WP #${a.wp_post_id}]` : `WP #${a.wp_post_id}`}`
    : '';

  return [
    escapeCSV(a.keyword),
    escapeCSV(a.outline?.h1),
    escapeCSV(h2s),
    escapeCSV(a.meta_title),
    escapeCSV(a.meta_description),
    escapeCSV(a.image_url),
    escapeCSV(wpUrl),
    escapeCSV(a.status),
  ].join(',');
}

export async function POST(req: NextRequest) {
  try {
    const { article_ids }: { article_ids: string[] } = await req.json();
    if (!article_ids?.length) {
      return NextResponse.json({ error: 'Cần ít nhất 1 article_id' }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('articles')
      .select('*')
      .in('id', article_ids)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    const header = ['Từ khóa', 'H1', 'Các H2', 'Meta Title', 'Meta Description', 'URL Ảnh', 'Link WordPress', 'Trạng thái']
      .map(escapeCSV)
      .join(',');

    const rows = (data as Article[]).map(articleToRow);
    const csv = [header, ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="seo-articles.csv"',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
