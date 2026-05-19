import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/articles/fix-slugs
 * Cập nhật lại slug cho các bài có slug dạng ?p=ID hoặc trống.
 * Gọi WP REST API (có auth) để lấy permalink thực.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { article_ids }: { article_ids?: string[] } = body;

    const db = createServerClient();
    const settings = await getSettings();

    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json({ error: 'WordPress chưa cấu hình' }, { status: 400 });
    }

    const base = settings.wp_url.replace(/\/$/, '');
    const authHeader = 'Basic ' + Buffer.from(`${settings.wp_username}:${settings.wp_app_password}`).toString('base64');

    // Lấy bài cần fix: slug là ?p=ID, hoặc trống nhưng có wp_post_id
    let query = db
      .from('articles')
      .select('id, slug, wp_post_id')
      .not('wp_post_id', 'is', null);

    if (article_ids?.length) {
      query = query.in('id', article_ids);
    }

    const { data: articles, error } = await query;
    if (error) throw new Error(error.message);
    if (!articles?.length) {
      return NextResponse.json({ fixed: 0, message: 'Không có bài nào cần fix' });
    }

    // Chỉ fix bài có slug là ?p= hoặc trống
    const needFix = articles.filter(
      (a) => !a.slug || a.slug.includes('?p=') || a.slug.includes('/?p=')
    );

    if (!needFix.length) {
      return NextResponse.json({ fixed: 0, message: 'Tất cả bài đã có permalink đúng' });
    }

    let fixed = 0;
    const errors: string[] = [];
    const results: { id: string; old: string; new: string }[] = [];

    // Batch fetch từ WP REST API (tối đa 100 post/lần)
    const postIds = needFix.map((a) => a.wp_post_id as number);
    const wpLinkMap: Record<number, string> = {};

    for (let i = 0; i < postIds.length; i += 50) {
      const chunk = postIds.slice(i, i + 50);
      try {
        const url = `${base}/wp-json/wp/v2/posts?include=${chunk.join(',')}&per_page=${chunk.length}&_fields=id,link,slug&status=any`;
        const res = await fetch(url, {
          headers: { Authorization: authHeader },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const posts: { id: number; link: string; slug: string }[] = await res.json();
          for (const p of posts) {
            // Ưu tiên link đẹp; nếu vẫn ?p= thì dùng slug để build
            if (p.link && !p.link.includes('?p=')) {
              wpLinkMap[p.id] = p.link;
            } else if (p.slug) {
              wpLinkMap[p.id] = `${base}/${p.slug}/`;
            }
          }
        } else {
          errors.push(`WP API error: HTTP ${res.status}`);
        }
      } catch (e) {
        errors.push(`WP API fetch error: ${(e as Error).message}`);
      }
    }

    // Cập nhật từng bài
    for (const article of needFix) {
      const newLink = wpLinkMap[article.wp_post_id as number];
      if (!newLink) {
        errors.push(`wp_post_id=${article.wp_post_id}: không tìm được permalink`);
        continue;
      }
      const { error: updErr } = await db
        .from('articles')
        .update({ slug: newLink })
        .eq('id', article.id);
      if (updErr) {
        errors.push(`id=${article.id}: ${updErr.message}`);
      } else {
        results.push({ id: article.id, old: article.slug || '', new: newLink });
        fixed++;
      }
    }

    return NextResponse.json({
      fixed,
      total_checked: needFix.length,
      results,
      errors: errors.length ? errors : undefined,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
