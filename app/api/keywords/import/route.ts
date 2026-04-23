import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { CSVKeywordRow } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { keywords, source, source_url }: {
      keywords: CSVKeywordRow[];
      source: string;
      source_url?: string;
    } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Danh sách từ khóa trống' }, { status: 400 });
    }

    const db = createServerClient();

    // Fetch existing keywords to dedup
    const { data: existing } = await db
      .from('keywords')
      .select('keyword')
      .in(
        'keyword',
        keywords.map((k) => k.keyword.toLowerCase().trim())
      );

    const existingSet = new Set((existing || []).map((e) => e.keyword.toLowerCase().trim()));

    const toInsert = keywords
      .filter((k) => k.keyword.trim().length > 0)
      .filter((k) => !existingSet.has(k.keyword.toLowerCase().trim()))
      .map((k) => ({
        keyword: k.keyword.trim(),
        source,
        source_url: source_url || null,
        volume: k.volume || null,
        difficulty: k.difficulty || null,
        status: 'pending',
      }));

    const skipped = keywords.length - toInsert.length;

    if (toInsert.length > 0) {
      const { error } = await db.from('keywords').insert(toInsert);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ inserted: toInsert.length, skipped });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Lỗi server' },
      { status: 500 }
    );
  }
}
