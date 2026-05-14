import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/supabase';

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'openai' | 'gemini' | 'anthropic';
  type: 'text' | 'image' | 'both';
  description?: string;
  isNew?: boolean;
}

// ── Hardcoded curated lists (updated regularly) ──────────────────────────────
// These are authoritative lists updated to May 2025

const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-pro',          name: 'Gemini 2.5 Pro',          provider: 'gemini', type: 'text', description: 'Mạnh nhất của Google', isNew: true },
  { id: 'gemini-2.5-flash',        name: 'Gemini 2.5 Flash',        provider: 'gemini', type: 'text', description: 'Nhanh + cân bằng', isNew: true },
  { id: 'gemini-2.0-flash',        name: 'Gemini 2.0 Flash',        provider: 'gemini', type: 'text', description: 'Mặc định, miễn phí' },
  { id: 'gemini-2.0-flash-lite',   name: 'Gemini 2.0 Flash Lite',   provider: 'gemini', type: 'text', description: 'Nhanh nhất, rẻ nhất' },
  { id: 'gemini-1.5-pro',          name: 'Gemini 1.5 Pro',          provider: 'gemini', type: 'text', description: 'Ổn định, context dài' },
];

const GEMINI_IMAGE_MODELS: ModelInfo[] = [
  { id: 'imagen-3.0-generate-002', name: 'Imagen 3',                provider: 'gemini', type: 'image', description: 'Ảnh chất lượng cao' },
  { id: 'imagen-4.0-generate-preview-05-20', name: 'Imagen 4 (Preview)', provider: 'gemini', type: 'image', description: 'Mới nhất, đang preview', isNew: true },
];

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-5',              name: 'Claude Opus 4.5',         provider: 'anthropic', type: 'text', description: 'Mạnh nhất', isNew: true },
  { id: 'claude-sonnet-4-5',            name: 'Claude Sonnet 4.5',       provider: 'anthropic', type: 'text', description: 'Cân bằng tốt nhất', isNew: true },
  { id: 'claude-3-5-sonnet-20241022',   name: 'Claude 3.5 Sonnet',       provider: 'anthropic', type: 'text', description: 'Ổn định, phổ biến' },
  { id: 'claude-3-5-haiku-20241022',    name: 'Claude 3.5 Haiku',        provider: 'anthropic', type: 'text', description: 'Nhanh, rẻ' },
  { id: 'claude-3-opus-20240229',       name: 'Claude 3 Opus',           provider: 'anthropic', type: 'text', description: 'Thế hệ cũ, mạnh' },
];

// OpenAI image models — curated list (synced with API screenshot May 2026)
const OPENAI_IMAGE_MODELS: ModelInfo[] = [
  { id: 'gpt-image-2',              name: 'GPT Image 2',               provider: 'openai', type: 'image', description: 'Mới nhất, chất lượng cao', isNew: true },
  { id: 'gpt-image-2-2026-04-21',   name: 'GPT Image 2 (Apr 2026)',    provider: 'openai', type: 'image', description: 'Snapshot ổn định', isNew: true },
  { id: 'chatgpt-image-latest',     name: 'ChatGPT Image Latest',      provider: 'openai', type: 'image', description: 'Luôn dùng phiên bản mới nhất', isNew: true },
  { id: 'gpt-image-1',              name: 'GPT Image 1',               provider: 'openai', type: 'image', description: 'Model ChatGPT dùng, thực tế nhất' },
  { id: 'gpt-image-1.5',            name: 'GPT Image 1.5',             provider: 'openai', type: 'image', description: 'Cải tiến từ GPT Image 1', isNew: true },
  { id: 'gpt-image-1-mini',         name: 'GPT Image 1 Mini',          provider: 'openai', type: 'image', description: 'Nhanh hơn, rẻ hơn', isNew: true },
  { id: 'dall-e-3',                 name: 'DALL-E 3',                  provider: 'openai', type: 'image', description: 'Ổn định, nhiều style' },
  { id: 'dall-e-2',                 name: 'DALL-E 2',                  provider: 'openai', type: 'image', description: 'Cũ hơn, rẻ hơn' },
];

// ── Fetch OpenAI models dynamically ─────────────────────────────────────────

async function fetchOpenAITextModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return getOpenAIFallback();
    const json = await res.json();
    const models: { id: string; created: number }[] = json.data || [];

    // Filter to known GPT text models, sort by newest
    const textModels = models
      .filter((m) => /^(gpt-4|gpt-3\.5|o1|o3|o4)/.test(m.id) && !m.id.includes('instruct'))
      .sort((a, b) => b.created - a.created)
      .slice(0, 12)
      .map((m) => ({
        id: m.id,
        name: formatOpenAIName(m.id),
        provider: 'openai' as const,
        type: 'text' as const,
        isNew: m.created > Date.now() / 1000 - 90 * 86400, // new if < 90 days old
      }));

    return textModels.length > 0 ? textModels : getOpenAIFallback();
  } catch {
    return getOpenAIFallback();
  }
}

function getOpenAIFallback(): ModelInfo[] {
  return [
    { id: 'gpt-4o',       name: 'GPT-4o',       provider: 'openai', type: 'text', description: 'Đa năng, mặc định' },
    { id: 'gpt-4o-mini',  name: 'GPT-4o Mini',  provider: 'openai', type: 'text', description: 'Nhanh, rẻ hơn' },
    { id: 'o4-mini',      name: 'o4-mini',       provider: 'openai', type: 'text', description: 'Reasoning', isNew: true },
    { id: 'o3',           name: 'o3',            provider: 'openai', type: 'text', description: 'Reasoning mạnh nhất', isNew: true },
  ];
}

function formatOpenAIName(id: string): string {
  return id
    .replace('gpt-4o-mini', 'GPT-4o Mini')
    .replace('gpt-4o', 'GPT-4o')
    .replace(/^o(\d)/, 'o$1')
    .replace(/-(\d{4}-\d{2}-\d{2})$/, ' ($1)')
    .replace(/-preview$/, ' (Preview)');
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all'; // 'text' | 'image' | 'all'

    const settings = await getSettings();

    let openaiText: ModelInfo[] = [];
    if (settings?.openai_api_key) {
      openaiText = await fetchOpenAITextModels(settings.openai_api_key);
    } else {
      openaiText = getOpenAIFallback();
    }

    const result: Record<string, ModelInfo[]> = {
      openai_text:   openaiText,
      openai_image:  OPENAI_IMAGE_MODELS,
      gemini_text:   GEMINI_MODELS,
      gemini_image:  GEMINI_IMAGE_MODELS,
      anthropic_text: ANTHROPIC_MODELS,
    };

    if (category === 'image') {
      return NextResponse.json({
        openai:  OPENAI_IMAGE_MODELS,
        gemini:  GEMINI_IMAGE_MODELS,
      });
    }

    if (category === 'text') {
      return NextResponse.json({
        openai:    openaiText,
        gemini:    GEMINI_MODELS,
        anthropic: ANTHROPIC_MODELS,
      });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
