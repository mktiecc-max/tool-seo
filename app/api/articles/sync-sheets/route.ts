import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sheetsGet, sheetsAppend, sheetsUpdate, getCredentials, getFirstSheetName, resetSheetNameCache, resetCredentialsCache } from '@/lib/google-sheets';
import { Article } from '@/types';

// Force Node.js runtime so crypto.subtle (used for JWT signing) is available
export const runtime = 'nodejs';
// Increase timeout for Vercel (syncing many articles can take time)
export const maxDuration = 60;

/**
 * Sheet structure — 1 bài = 1 hàng, định danh bằng ID (cột A):
 *
 * A = ID (uuid — unique identifier, dùng để match khi cập nhật)
 * B = Từ khóa
 * C = Tiêu đề (meta_title hoặc H1)
 * D = Outline (H1 + danh sách H2/H3)
 * E = Nội dung chi tiết (HTML)
 * F = Link ảnh
 * G = Category (WordPress)
 * H = Permalink / Slug (link click vào ra bài trên trang quản trị WP)
 * I = Trạng thái
 * J = Ngày cập nhật
 */
// SHEET_RANGE is built dynamically using getFirstSheetName()
const HEADER_ROW = [
  'ID', 'Từ khóa', 'Tiêu đề', 'Outline',
  'Nội dung chi tiết', 'Link ảnh', 'Category',
  'Link bài viết', 'Trạng thái', 'Ngày cập nhật', 'Link Tool SEO',
];

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

/**
 * Tạo link trực tiếp đến trang chỉnh sửa bài trên WP Admin.
 * Ưu tiên: wp-admin/post.php?post=ID&action=edit (link luôn hoạt động)
 * Fallback: permalink hoặc ?p=ID
 */
function buildWpLinks(a: Article, wpUrl: string): { editLink: string; frontLink: string } {
  const base = wpUrl.replace(/\/$/, '');
  let editLink = '';
  let frontLink = '';

  if (a.wp_post_id && base) {
    // Link đến trang quản trị — click vào là chỉnh sửa luôn
    editLink = `${base}/wp-admin/post.php?post=${a.wp_post_id}&action=edit`;
    // Link đến front-end
    if (a.slug?.startsWith('http')) {
      frontLink = a.slug;
    } else if (a.slug) {
      frontLink = `${base}/${a.slug}`;
    } else {
      frontLink = `${base}/?p=${a.wp_post_id}`;
    }
  }

  return { editLink, frontLink };
}

function articleToRow(a: Article, wpUrl: string, categories: Record<number, string>, toolUrl: string): string[] {
  const now = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const title = a.meta_title || a.outline?.h1 || a.keyword || '';
  const { editLink, frontLink } = buildWpLinks(a, wpUrl);
  // Ưu tiên hiện editLink (link quản trị WP), nếu không có thì fallback frontLink
  const displayLink = editLink || frontLink;

  // Resolve category name from WP category ID (nếu có)
  let categoryName = '';
  const catId = (a as unknown as Record<string, unknown>).wp_category_id as number | undefined;
  if (catId && categories[catId]) {
    categoryName = categories[catId];
  }

  const linkToolSeo = `${toolUrl}/articles/${a.id}`;

  return [
    a.id,
    a.keyword ?? '',
    title,
    buildOutlineText(a),
    a.content_html ?? '',
    a.image_url ?? '',
    categoryName,
    displayLink,
    a.status ?? '',
    now,
    linkToolSeo,
  ];
}

export async function POST(req: NextRequest) {
  // Always return JSON — never let an unhandled exception produce an HTML response
  try {
    // ── 1. Parse request body FIRST (before any external API calls) ──────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Body không hợp lệ (expected JSON)' }, { status: 400 });
    }
    const article_ids: string[] = (body.article_ids as string[]) ?? [];
    const sync_all: boolean = (body.sync_all as boolean) ?? false;

    if (!sync_all && !article_ids.length) {
      return NextResponse.json({ error: 'Cần ít nhất 1 article_id hoặc sync_all=true' }, { status: 400 });
    }

    // ── 2. Fetch articles from database ──────────────────────────────────
    const db = createServerClient();

    let articles: Article[] = [];
    if (sync_all) {
      const { data, error } = await db.from('articles').select('*');
      if (error) throw new Error(`DB error: ${error.message}`);
      articles = (data ?? []) as Article[];
    } else {
      const { data, error } = await db.from('articles').select('*').in('id', article_ids);
      if (error) throw new Error(`DB error: ${error.message}`);
      articles = (data ?? []) as Article[];
    }

    if (!articles.length) {
      return NextResponse.json({ ok: true, inserted: 0, updated: 0, total: 0, message: 'Không có bài nào để đồng bộ' });
    }

    // ── 3. Reset caches & connect to Google Sheets ──────────────────────
    resetSheetNameCache();
    resetCredentialsCache();

    // Auto-detect tên sheet đầu tiên (Sheet1, Trang tính1, v.v.)
    const sheetName = await getFirstSheetName();
    const SHEET_RANGE = `${sheetName}!A:K`;

    // Extract toolUrl (origin) from the request URL
    const toolUrl = new URL(req.url).origin;

    // ── 4. Read WP URL from settings ────────────────────────────────────
    const { data: settingsData } = await db
      .from('settings')
      .select('wp_url')
      .limit(1)
      .single();
    const wpUrl = settingsData?.wp_url || process.env.WP_URL || process.env.NEXT_PUBLIC_WP_URL || '';

    // ── 5. Fetch WP categories (optional, non-blocking) ─────────────────
    let wpCategories: Record<number, string> = {};
    try {
      const baseUrl = wpUrl.replace(/\/$/, '');
      if (baseUrl) {
        const catRes = await fetch(`${baseUrl}/wp-json/wp/v2/categories?per_page=100`, {
          signal: AbortSignal.timeout(5000),
        });
        if (catRes.ok) {
          const cats: { id: number; name: string }[] = await catRes.json();
          wpCategories = Object.fromEntries(cats.map((c) => [c.id, c.name]));
        }
      }
    } catch { /* bỏ qua — không có category thì cột trống */ }

    // ── 6. Fetch existing sheet rows ────────────────────────────────────
    let existingRows: string[][] = [];
    try {
      existingRows = await sheetsGet(SHEET_RANGE);
    } catch { /* empty sheet */ }

    // Ensure header
    if (existingRows.length === 0) {
      await sheetsAppend(SHEET_RANGE, [HEADER_ROW]);
      existingRows = [HEADER_ROW];
    } else if (existingRows[0]?.[0] !== 'ID' || existingRows[0].length < HEADER_ROW.length) {
      // Header cũ (từ phiên bản cũ) — ghi đè header mới
      await sheetsUpdate(`${sheetName}!A1:K1`, [HEADER_ROW]);
      // Cập nhật lại row 0 trong existingRows bằng HEADER_ROW để tránh lỗi lúc so sánh
      existingRows[0] = HEADER_ROW;
    }

    // ── 7. Sync each article ────────────────────────────────────────────
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const article of articles) {
      try {
        const newRow = articleToRow(article, wpUrl, wpCategories, toolUrl);

        // Match by ID (cột A, index 0) — unique, không bị trùng keyword
        let matchRowIndex = -1;
        for (let i = 1; i < existingRows.length; i++) {
          const rowId = (existingRows[i]?.[0] ?? '').trim();
          if (rowId && rowId === article.id) {
            matchRowIndex = i;
            break;
          }
        }

        if (matchRowIndex >= 0) {
          const sheetRow = matchRowIndex + 1; // 1-indexed
          await sheetsUpdate(`${sheetName}!A${sheetRow}:K${sheetRow}`, [newRow]);
          existingRows[matchRowIndex] = newRow;
          updated++;
        } else {
          await sheetsAppend(SHEET_RANGE, [newRow]);
          existingRows.push(newRow);
          inserted++;
        }
      } catch (articleErr: unknown) {
        const msg = articleErr instanceof Error ? articleErr.message : String(articleErr);
        errors.push(`[${article.keyword}]: ${msg}`);
        console.error(`[sync-sheets] Error syncing article "${article.keyword}":`, msg);
      }
    }

    const creds = await getCredentials();
    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      total: articles.length,
      errors: errors.length > 0 ? errors : undefined,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${creds.sheetId}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sync-sheets] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
