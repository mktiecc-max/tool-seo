import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/articles/reset-status
 * Force-reset one or many articles from a stuck processing state back to a review state.
 * Body: { article_ids: string[], target_status?: string }
 *   target_status defaults based on current status:
 *     generating_image → image_review
 *     generating_content → content_review
 *     publishing → image_review
 */
export async function POST(req: NextRequest) {
  try {
    const { article_ids, target_status }: {
      article_ids: string[];
      target_status?: string;
    } = await req.json();

    if (!article_ids?.length) {
      return NextResponse.json({ error: 'article_ids bắt buộc' }, { status: 400 });
    }

    const db = createServerClient();

    // Fetch current statuses so we can map to correct target
    const { data: rows, error: fetchErr } = await db
      .from('articles')
      .select('id, status')
      .in('id', article_ids);

    if (fetchErr) throw new Error(fetchErr.message);

    const STATUS_MAP: Record<string, string> = {
      generating_image:   'image_review',
      generating_content: 'content_review',
      publishing:         'image_review',
    };

    const results: { id: string; from: string; to: string }[] = [];

    await Promise.allSettled(
      (rows || []).map(async (row) => {
        const to = target_status || STATUS_MAP[row.status] || 'image_review';
        const { error: updErr } = await db
          .from('articles')
          .update({ status: to, error_message: null })
          .eq('id', row.id);
        if (!updErr) results.push({ id: row.id, from: row.status, to });
      })
    );

    return NextResponse.json({ reset: results.length, results });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
