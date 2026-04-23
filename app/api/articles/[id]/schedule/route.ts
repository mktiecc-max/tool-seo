import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { uploadMediaToWP, createWPPost } from '@/lib/wordpress';

interface Params { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { scheduled_date }: { scheduled_date: string } = await req.json();
    if (!scheduled_date) {
      return NextResponse.json({ error: 'scheduled_date bắt buộc (ISO8601)' }, { status: 400 });
    }

    const db = createServerClient();
    const { data: article } = await db.from('articles').select('*').eq('id', params.id).single();
    if (!article) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });

    const settings = await getSettings();
    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json({ error: 'WordPress chưa được cấu hình' }, { status: 400 });
    }

    const wpConfig = {
      wp_url: settings.wp_url,
      wp_username: settings.wp_username,
      wp_app_password: settings.wp_app_password,
    };

    // Upload featured image if exists
    let wpMediaId: number | undefined;
    if (article.image_url) {
      try {
        const imgRes = await fetch(article.image_url);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ext = article.image_url.endsWith('.png') ? 'png' : 'jpg';
          wpMediaId = await uploadMediaToWP(
            wpConfig,
            buf,
            `featured-${params.id}.${ext}`,
            ext === 'png' ? 'image/png' : 'image/jpeg'
          );
        }
      } catch { /* continue without image */ }
    }

    // Create post with status='future' and scheduled date
    const { id: wpPostId } = await createWPPost(wpConfig, {
      title: article.meta_title || article.keyword,
      content: article.content_html || '',
      slug: article.slug || '',
      status: 'future',
      date: scheduled_date,
      featured_media: wpMediaId,
      categories: [],
      tags: [],
      meta_title: article.meta_title,
      meta_description: article.meta_description,
    });

    // Update article
    await db.from('articles').update({
      scheduled_date,
      wp_post_id: wpPostId,
      status: 'done',
      error_message: null,
    }).eq('id', params.id);

    return NextResponse.json({ wp_post_id: wpPostId, scheduled_date });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
