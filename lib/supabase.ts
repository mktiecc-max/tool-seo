import { createClient } from '@supabase/supabase-js';
import { Settings } from '@/types';

// ---- Browser client (anon key) ----
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---- Server client (service role key) ----
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ---- Get settings from DB, fallback to env ----
export async function getSettings(): Promise<Settings | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('settings')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) {
    // Return env-based defaults
    return {
      id: 'env',
      openai_api_key: process.env.OPENAI_API_KEY,
      gemini_api_key: process.env.GEMINI_API_KEY,
      anthropic_api_key: process.env.ANTHROPIC_API_KEY,
      serpapi_key: process.env.SERPAPI_KEY,
      wp_url: process.env.WP_URL,
      wp_username: process.env.WP_USERNAME,
      wp_app_password: process.env.WP_APP_PASSWORD,
      default_ai_model: 'claude',
      default_image_ai: 'dalle3',
      max_concurrent_jobs: 3,
    };
  }

  // Merge DB values with env fallbacks
  return {
    ...data,
    openai_api_key: data.openai_api_key || process.env.OPENAI_API_KEY,
    gemini_api_key: data.gemini_api_key || process.env.GEMINI_API_KEY,
    anthropic_api_key: data.anthropic_api_key || process.env.ANTHROPIC_API_KEY,
    serpapi_key: data.serpapi_key || process.env.SERPAPI_KEY,
    wp_url: data.wp_url || process.env.WP_URL,
    wp_username: data.wp_username || process.env.WP_USERNAME,
    wp_app_password: data.wp_app_password || process.env.WP_APP_PASSWORD,
    max_concurrent_jobs: data.max_concurrent_jobs ?? 3,
  };
}
