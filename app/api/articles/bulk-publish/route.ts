import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { uploadMediaToWP, createWPPost } from '@/lib/wordpress';

export async function POST(req: NextRequest) {
  try {
    const { article_ids, wp_status }: {
      article_ids: string[];
      wp_status: 'draft' | 'publish';
    } = await req.json();

    if (!article_ids || article_ids.length === 0) {
      return NextResponse.json({ error: 'article_ids trống' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json({ error: 'WordPress chưa được cấu hình' }, { status: 400 });
    }

    const wpConfig = {
      wp_url: settings.wp_url,
      wp_username: settings.wp_username,
      wp_app_password: settings.wp_app_password,
    };

    const db = createServerClient();
    const success: string[] = [];
    const failed: { id: string; error: string }[] = [];

    // Sequential to avoid WP rate limit
    for (const article_id of article_ids) {
      try {
        const { data: article } = await db.from('articles').select('*').eq('id', article_id).single();
        if (!article) { failed.push({ id: article_id, error: 'Không tìm thấy' }); continue; }

        await db.from('articles').update({ status: 'publishing' }).eq('id', article_id);

        // Upload image if exists
        let wpMediaId: number | undefined;
        if (article.image_url) {
          try {
            const imgRes = await fetch(article.image_url);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const ext = article.image_url.endsWith('.png') ? 'png' : 'jpg';
              wpMediaId = await uploadMediaToWP(wpConfig, buf, `featured-${article_id}.${ext}`, ext === 'png' ? 'image/png' : 'image/jpeg');
            }
          } catch { /* continue without image */ }
        }

        const { id: wpPostId, link: wpPostUrl } = await createWPPost(wpConfig, {
          title: article.meta_title || article.keyword,
          content: article.content_html || '',
          slug: article.slug || '',
          status: wp_status,
          featured_media: wpMediaId,
          categories: [],
          tags: [],
          meta_title: article.meta_title,
          meta_description: article.meta_description,
        });

        await db.from('articles').update({
          wp_post_id: wpPostId,
          slug: wpPostUrl,       // ghi đè slug bằng URL đầy đủ từ WordPress
          status: 'done',
          error_message: null,
        }).eq('id', article_id);

        if (article.keyword_id) {
          await db.from('keywords').update({ status: 'done' }).eq('id', article.keyword_id);
        }

        success.push(article_id);
      } catch (e: unknown) {
        const msg = (e as Error).message;
        failed.push({ id: article_id, error: msg });
        await db.from('articles').update({ status: 'failed', error_message: msg }).eq('id', article_id);
      }
    }

    return NextResponse.json({ success, failed });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
