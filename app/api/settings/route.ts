import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/supabase';

// GET /api/settings — returns public-safe settings (no API keys)
export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings) return NextResponse.json({}, { status: 200 });

    // Only expose non-sensitive fields to client
    return NextResponse.json({
      max_concurrent_jobs: settings.max_concurrent_jobs,
      default_ai_model: settings.default_ai_model,
      default_image_ai: settings.default_image_ai,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
