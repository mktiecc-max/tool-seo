import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/supabase';
import { getWPCategories } from '@/lib/wordpress';

export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings?.wp_url || !settings?.wp_username || !settings?.wp_app_password) {
      return NextResponse.json({ categories: [] });
    }

    const categories = await getWPCategories({
      wp_url: settings.wp_url,
      wp_username: settings.wp_username,
      wp_app_password: settings.wp_app_password,
    });

    return NextResponse.json({ categories });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message, categories: [] }, { status: 500 });
  }
}
