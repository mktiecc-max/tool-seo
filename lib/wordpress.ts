import { WPCategory, WPTag } from '@/types';

interface WPConfig {
  wp_url: string;
  wp_username: string;
  wp_app_password: string;
}

function getAuthHeader(config: WPConfig): string {
  const credentials = `${config.wp_username}:${config.wp_app_password}`;
  return 'Basic ' + Buffer.from(credentials).toString('base64');
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  const delays = [2000, 4000, 8000];
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries) {
        await new Promise((r) => setTimeout(r, delays[i]));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function testWPConnection(config: WPConfig): Promise<boolean> {
  const res = await fetch(`${config.wp_url}/wp-json/wp/v2/users/me`, {
    headers: { Authorization: getAuthHeader(config) },
  });
  return res.ok;
}

export async function getWPCategories(config: WPConfig): Promise<WPCategory[]> {
  const res = await fetch(`${config.wp_url}/wp-json/wp/v2/categories?per_page=100`, {
    headers: { Authorization: getAuthHeader(config) },
  });
  if (!res.ok) throw new Error(`WP categories error: ${res.status}`);
  return res.json();
}

export async function searchWPTags(config: WPConfig, query: string): Promise<WPTag[]> {
  const res = await fetch(
    `${config.wp_url}/wp-json/wp/v2/tags?search=${encodeURIComponent(query)}&per_page=20`,
    { headers: { Authorization: getAuthHeader(config) } }
  );
  if (!res.ok) throw new Error(`WP tags error: ${res.status}`);
  return res.json();
}

export async function uploadMediaToWP(
  config: WPConfig,
  imageBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<number> {
  return withRetry(async () => {
    const res = await fetch(`${config.wp_url}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(config),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(imageBuffer),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('WP_AUTH_FAIL');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WP media upload failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.id as number;
  }, 2);
}

export async function createWPPost(
  config: WPConfig,
  post: {
    title: string;
    content: string;
    slug: string;
    status: 'draft' | 'publish' | 'future';
    date?: string;          // ISO8601 — required when status='future'
    featured_media?: number;
    categories?: number[];
    tags?: number[];
    meta_title?: string;
    meta_description?: string;
  }
): Promise<{ id: number; link: string }> {
  return withRetry(async () => {
    const body: Record<string, unknown> = {
      title: post.title,
      content: post.content,
      slug: post.slug,
      status: post.status,
      featured_media: post.featured_media,
      categories: post.categories || [],
      tags: post.tags || [],
      meta: {
        _yoast_wpseo_title: post.meta_title || post.title,
        _yoast_wpseo_metadesc: post.meta_description || '',
      },
    };
    if (post.date) body.date = post.date;

    const res = await fetch(`${config.wp_url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('WP_AUTH_FAIL');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WP create post failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return { id: data.id, link: data.link };
  }, 3);
}
