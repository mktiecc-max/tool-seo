import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sheetsGet, sheetsAppend, sheetsUpdate } from '@/lib/google-sheets';
import { Article } from '@/types';

// Sheet structure:
// A=Post ID | B=Từ khóa | C=H1 | D=Các H2 | E=Meta Title | F=Meta Desc | G=URL Ảnh | H=Link WP | I=Trạng thái | J=Ngày cập nhật
const SHEET_RANGE = 'Sheet1!A:J';
const HEADER_ROW = ['Post ID', 'Từ khóa', 'H1', 'Các H2', 'Meta Title', 'Meta Desc', 'URL Ảnh', 'Link WP', 'Trạng thái', 'Ngày cập nhật'];

function articleToRow(a: Article): string[] {
  const h2s = a.outline?.sections?.map((s) => s.h2).join(' | ') ?? '';
  const wpLink = a.wp_post_id ? `WP #${a.wp_post_id}` : '';
  const now = new Date().toLocaleDateString('vi-VN');
  return [
    a.wp_post_id?.toString() ?? '',
    a.keyword ?? '',
    a.outline?.h1 ?? '',
    h2s,
    a.meta_title ?? '',
    a.meta_description ?? '',
    a.image_url ?? '',
    wpLink,
    a.status ?? '',
    now,
  ];
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SA_EMAIL || !process.env.GOOGLE_SA_PRIVATE_KEY) {
      return NextResponse.json({
        error: 'Google Sheets chưa được cấu hình. Vui lòng thêm GOOGLE_SHEET_ID, GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY vào env vars.',
      }, { status: 503 });
    }

    const { article_ids }: { article_ids: string[] } = await req.json();
    if (!article_ids?.length) {
      return NextResponse.json({ error: 'Cần ít nhất 1 article_id' }, { status: 400 });
    }

    // Fetch articles from DB
    const db = createServerClient();
    const { data, error } = await db.from('articles').select('*').in('id', article_ids);
    if (error) throw new Error(error.message);
    const articles = (data ?? []) as Article[];

    // Fetch existing sheet data to find rows by Post ID or keyword
    let existingRows: string[][] = [];
    try {
      existingRows = await sheetsGet(SHEET_RANGE);
    } catch { /* sheet might be empty */ }

    // Ensure header exists
    if (existingRows.length === 0) {
      await sheetsAppend(SHEET_RANGE, [HEADER_ROW]);
      existingRows = [HEADER_ROW];
    }

    let inserted = 0;
    let updated = 0;

    for (const article of articles) {
      const newRow = articleToRow(article);
      const postId = article.wp_post_id?.toString() ?? '';
      const keyword = article.keyword?.toLowerCase() ?? '';

      // Find existing row: match by Post ID (col A) if present, else by keyword (col B)
      let matchRowIndex = -1;
      for (let i = 1; i < existingRows.length; i++) {
        const row = existingRows[i] ?? [];
        if (postId && row[0] && row[0].trim() === postId) {
          matchRowIndex = i;
          break;
        }
        if (!postId && row[1] && row[1].toLowerCase().trim() === keyword) {
          matchRowIndex = i;
          break;
        }
      }

      if (matchRowIndex >= 0) {
        // UPDATE — row is 1-indexed in Sheets, +1 for header
        const sheetRow = matchRowIndex + 1;
        await sheetsUpdate(`Sheet1!A${sheetRow}:J${sheetRow}`, [newRow]);
        // Update local cache
        existingRows[matchRowIndex] = newRow;
        updated++;
      } else {
        // INSERT new row
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
