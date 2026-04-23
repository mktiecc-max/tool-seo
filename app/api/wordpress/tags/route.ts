import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/supabase';
import { searchWPTags } from '@/lib/wordpress';

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q') || '';
    const settings = await getSettings();

    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json({ tags: [] });
    }

    const tags = await searchWPTags({
      wp_url: settings.wp_url,
      wp_username: settings.wp_username,
      wp_app_password: settings.wp_app_password,
    }, query);

    return NextResponse.json({ tags });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message, tags: [] }, { status: 500 });
  }
}
