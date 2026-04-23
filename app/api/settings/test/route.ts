import { NextRequest, NextResponse } from 'next/server';
import { Settings } from '@/types';
import { testWPConnection } from '@/lib/wordpress';

export async function POST(req: NextRequest) {
  try {
    const { service, settings }: { service: string; settings: Partial<Settings> } = await req.json();

    switch (service) {
      case 'openai_api_key': {
        const key = settings.openai_api_key;
        if (!key) return NextResponse.json({ success: false, error: 'No key' });
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        return NextResponse.json({ success: res.ok });
      }
      case 'anthropic_api_key': {
        const key = settings.anthropic_api_key;
        if (!key) return NextResponse.json({ success: false, error: 'No key' });
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        });
        return NextResponse.json({ success: res.ok });
      }
      case 'gemini_api_key': {
        const key = settings.gemini_api_key;
        if (!key) return NextResponse.json({ success: false, error: 'No key' });
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );
        return NextResponse.json({ success: res.ok });
      }
      case 'wp_app_password': {
        if (!settings.wp_url || !settings.wp_username || !settings.wp_app_password) {
          return NextResponse.json({ success: false, error: 'Missing WP config' });
        }
        const ok = await testWPConnection({
          wp_url: settings.wp_url,
          wp_username: settings.wp_username,
          wp_app_password: settings.wp_app_password,
        });
        return NextResponse.json({ success: ok });
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown service' });
    }
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err as Error).message });
  }
}
