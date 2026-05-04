import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSettings } from '@/lib/supabase';
import { uploadMediaToWP, createWPPost } from '@/lib/wordpress';

export async function POST(req: NextRequest) {
  try {
    const { article_id, status, category_id, tags }: {
      article_id: string;
      status: 'draft' | 'publish';
      category_id?: number;
      tags?: number[];
    } = await req.json();

    if (!article_id) return NextResponse.json({ error: 'article_id bắt buộc' }, { status: 400 });

    const db = createServerClient();
    const { data: article } = await db.from('articles').select('*').eq('id', article_id).single();
    if (!article) return NextResponse.json({ error: 'Không tìm thấy bài viết' }, { status: 404 });

    const settings = await getSettings();
    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json({
        error: 'WordPress chưa được cấu hình. Vào Cài đặt để thêm thông tin WP.',
      }, { status: 400 });
    }

    const wpConfig = {
      wp_url: settings.wp_url,
      wp_username: settings.wp_username,
      wp_app_password: settings.wp_app_password,
    };

    await db.from('articles').update({ status: 'publishing' }).eq('id', article_id);

    let wpMediaId: number | undefined;

    // Upload featured image to WP
    if (article.image_url) {
      try {
        const imageBuffer = await fetchImageBuffer(article.image_url);
        const ext = article.image_url.endsWith('.png') ? 'png' : 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        wpMediaId = await uploadMediaToWP(
          wpConfig,
          imageBuffer,
          `featured-${article_id}.${ext}`,
          mimeType
        );
        await db.from('articles').update({ wp_media_id: wpMediaId }).eq('id', article_id);
      } catch (e) {
        console.error('Media upload failed:', e);
        // Continue without featured image
      }
    }

    // Create WP post
    const { id: wpPostId, link: wpPostUrl } = await createWPPost(wpConfig, {
      title: article.meta_title || article.keyword,
      content: article.content_html || '',
      slug: article.slug || '',
      status: status || 'draft',
      featured_media: wpMediaId,
      categories: category_id ? [category_id] : [],
      tags: tags || [],
      meta_title: article.meta_title,
      meta_description: article.meta_description,
    });

    // Update article as done — lưu URL thật từ WP vào field slug để frontend dùng
    const { data: updatedArticle } = await db
      .from('articles')
      .update({
        wp_post_id: wpPostId,
        slug: wpPostUrl,       // ghi đè slug bằng URL đầy đủ từ WordPress
        status: 'done',
        error_message: null,
      })
      .eq('id', article_id)
      .select()
      .single();

    // Update keyword status if linked
    if (article.keyword_id) {
      await db.from('keywords').update({ status: 'done' }).eq('id', article.keyword_id);
    }

    return NextResponse.json({ article: updatedArticle, wp_post_url: wpPostUrl, wp_post_id: wpPostId });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    const db = createServerClient();
    const { article_id } = await (async () => {
      try { return await req.json(); } catch { return { article_id: '' }; }
    })();

    if (article_id) {
      await db.from('articles').update({
        status: 'failed',
        error_message: msg,
      }).eq('id', article_id);
    }

    if (msg === 'WP_AUTH_FAIL') {
      return NextResponse.json({
        error: 'Xác thực WordPress thất bại. Kiểm tra lại Username và Application Password trong Cài đặt.',
      }, { status: 401 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    return Buffer.from(base64, 'base64');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot download image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
