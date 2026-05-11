import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sheetsGet, sheetsAppend, sheetsUpdate } from '@/lib/google-sheets';
import { Article } from '@/types';

/**
 * Sheet structure (5 data columns + metadata):
 * A = Từ khóa
 * B = Outline (H1 + danh sách H2)
 * C = Nội dung (HTML)
 * D = Prompt ảnh
 * E = Link WordPress
 * F = Trạng thái
 * G = Ngày cập nhật
 */
const SHEET_RANGE = 'Sheet1!A:G';
const HEADER_ROW = ['Từ khóa', 'Outline', 'Nội dung', 'Prompt ảnh', 'Link WordPress', 'Trạng thái', 'Ngày cập nhật'];

function buildOutlineText(a: Article): string {
  if (!a.outline) return '';
  const lines: string[] = [];
  if (a.outline.h1) lines.push(`H1: ${a.outline.h1}`);
  a.outline.sections?.forEach((s) => {
    lines.push(`H2: ${s.h2}`);
    s.h3s?.forEach((h3) => lines.push(`  H3: ${h3}`));
  });
  if (a.outline.faq?.length) {
    lines.push('--- FAQ ---');
    a.outline.faq.forEach((q) => lines.push(`Q: ${q}`));
  }
  return lines.join('\n');
}

function buildWpLink(a: Article): string {
  if (!a.wp_post_id) return '';
  // Try to build full URL using site's base URL from env, fallback to post ID
  const base = process.env.WP_URL || process.env.NEXT_PUBLIC_WP_URL || '';
  if (base && a.slug) return `${base.replace(/\/$/, '')}/${a.slug}`;
  if (base) return `${base.replace(/\/$/, '')}/?p=${a.wp_post_id}`;
  return `WP Post #${a.wp_post_id}`;
}

function articleToRow(a: Article): string[] {
  const now = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return [
    a.keyword ?? '',
    buildOutlineText(a),
    a.content_html ?? '',
    a.image_prompt ?? '',
    buildWpLink(a),
    a.status ?? '',
    now,
  ];
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY) {
      return NextResponse.json({
        error: 'Google Sheets chưa được cấu hình. Vui lòng thêm GOOGLE_SHEET_ID, GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY vào .env.local.',
      }, { status: 503 });
    }

    const body = await req.json();
    const article_ids: string[] = body.article_ids ?? [];
    const sync_all: boolean = body.sync_all ?? false;

    const db = createServerClient();

    let articles: Article[] = [];
    if (sync_all) {
      // Sync tất cả bài đã done
      const { data, error } = await db.from('articles').select('*').eq('status', 'done');
      if (error) throw new Error(error.message);
      articles = (data ?? []) as Article[];
    } else {
      if (!article_ids.length) {
        return NextResponse.json({ error: 'Cần ít nhất 1 article_id hoặc sync_all=true' }, { status: 400 });
      }
      const { data, error } = await db.from('articles').select('*').in('id', article_ids);
      if (error) throw new Error(error.message);
      articles = (data ?? []) as Article[];
    }

    if (!articles.length) {
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, total: 0, message: 'Không có bài nào để đồng bộ' });
    }

    // Fetch existing sheet rows
    let existingRows: string[][] = [];
    try {
      existingRows = await sheetsGet(SHEET_RANGE);
    } catch { /* empty sheet */ }

    // Ensure header
    if (existingRows.length === 0) {
      await sheetsAppend(SHEET_RANGE, [HEADER_ROW]);
      existingRows = [HEADER_ROW];
    } else if (existingRows[0]?.[0] !== 'Từ khóa') {
      // Header mismatch — prepend correct header
      await sheetsUpdate('Sheet1!A1:G1', [HEADER_ROW]);
      existingRows[0] = HEADER_ROW;
    }

    let inserted = 0;
    let updated = 0;

    for (const article of articles) {
      const newRow = articleToRow(article);
      const keyword = article.keyword?.toLowerCase().trim() ?? '';

      // Match by keyword (col A, index 0)
      let matchRowIndex = -1;
      for (let i = 1; i < existingRows.length; i++) {
        const rowKeyword = (existingRows[i]?.[0] ?? '').toLowerCase().trim();
        if (rowKeyword && rowKeyword === keyword) {
          matchRowIndex = i;
          break;
        }
      }

      if (matchRowIndex >= 0) {
        const sheetRow = matchRowIndex + 1; // 1-indexed, header is row 1
        await sheetsUpdate(`Sheet1!A${sheetRow}:G${sheetRow}`, [newRow]);
        existingRows[matchRowIndex] = newRow;
        updated++;
      } else {
        await sheetsAppend(SHEET_RANGE, [newRow]);
        existingRows.push(newRow);
        inserted++;
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      total: articles.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
