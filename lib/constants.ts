// ============================================================
// Centralized constants — single source of truth cho toàn app
// Khi thêm model/size/type mới, chỉ cần sửa file này
// ============================================================

// ── Article statuses ─────────────────────────────────────────────────────────
export const PROCESSING_STATUSES = ['generating_content', 'generating_image', 'publishing'] as const;
export const REVIEW_STATUSES = ['outline_review', 'content_review', 'image_review'] as const;

export type ProcessingStatus = typeof PROCESSING_STATUSES[number];
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export function isProcessing(status: string): boolean {
  return (PROCESSING_STATUSES as readonly string[]).includes(status);
}

// ── Image sizes ──────────────────────────────────────────────────────────────
export const IMAGE_SIZES = [
  { value: '1024x1024', label: 'Vuông',  sub: '1:1 · Blog / Social',       icon: '■', aspect: 'aspect-square' },
  { value: '1792x1024', label: 'Ngang',  sub: '16:9 · Banner / Thumbnail', icon: '▬', aspect: 'aspect-video' },
  { value: '1024x1792', label: 'Dọc',   sub: '9:16 · Story / Poster',     icon: '▮', aspect: 'aspect-[9/16]' },
] as const;

export type ImageSizeValue = typeof IMAGE_SIZES[number]['value'];
export const DEFAULT_IMAGE_SIZE: ImageSizeValue = '1792x1024';

// ── Image types ──────────────────────────────────────────────────────────────
export const IMAGE_TYPES = [
  { value: 'photo',        label: 'Ảnh thực',     hint: 'realistic photo, high quality photography, DSLR quality, photorealistic' },
  { value: 'illustration', label: 'Ảnh minh họa', hint: 'flat illustration style, vector art' },
  { value: 'poster',       label: 'Poster',       hint: 'creative poster design, bold typography' },
  { value: 'banner',       label: 'Banner',       hint: 'wide banner design, professional marketing' },
  { value: 'infographic',  label: 'Infographic',  hint: 'infographic design, data visualization, clean layout' },
  { value: 'logo',         label: 'Logo / Icon',  hint: 'minimal logo design, icon, transparent background' },
] as const;

export type ImageTypeValue = typeof IMAGE_TYPES[number]['value'];
export const DEFAULT_IMAGE_TYPE: ImageTypeValue = 'photo';

// ── Default image model ───────────────────────────────────────────────────────
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

// ── Gemini Imagen ID mapping ─────────────────────────────────────────────────
// API trả về model ID dài → map về ID ngắn dùng trong generate-image route
export const GEMINI_IMAGE_ID_MAP: Record<string, string> = {
  'imagen-3.0-generate-002':              'gemini-imagen',
  'imagen-4.0-generate-preview-05-20':   'gemini-imagen',
};

// ── Image model type (shared between BatchCard and Step5Image) ────────────────
export interface ImageModelInfo {
  id: string;
  name: string;
  provider: 'openai' | 'gemini' | string;
  description?: string;
  isNew?: boolean;
}

// Fallback khi API chưa load xong — khớp hoàn toàn với api/models/route.ts
export const DEFAULT_IMAGE_MODELS: ImageModelInfo[] = [
  { id: 'gpt-image-2',          name: 'GPT Image 2',          provider: 'openai', description: 'Mới nhất, chất lượng cao',          isNew: true  },
  { id: 'gpt-image-2-2026-04-21', name: 'GPT Image 2 (Apr 2026)', provider: 'openai', description: 'Snapshot ổn định',             isNew: true  },
  { id: 'chatgpt-image-latest', name: 'ChatGPT Image Latest', provider: 'openai', description: 'Luôn dùng phiên bản mới nhất',     isNew: true  },
  { id: 'gpt-image-1',          name: 'GPT Image 1',          provider: 'openai', description: 'Model ChatGPT dùng, thực tế nhất'               },
  { id: 'gpt-image-1.5',        name: 'GPT Image 1.5',        provider: 'openai', description: 'Cải tiến từ GPT Image 1',          isNew: true  },
  { id: 'gpt-image-1-mini',     name: 'GPT Image 1 Mini',     provider: 'openai', description: 'Nhanh hơn, rẻ hơn',               isNew: true  },
  { id: 'dall-e-3',             name: 'DALL-E 3',             provider: 'openai', description: 'Ổn định, nhiều style'                            },
  { id: 'dall-e-2',             name: 'DALL-E 2',             provider: 'openai', description: 'Cũ hơn, rẻ hơn'                                 },
  { id: 'gemini-imagen',        name: 'Gemini Imagen',        provider: 'gemini', description: 'Google, chất lượng cao'                          },
];

/**
 * Fetch và normalize danh sách image model từ API.
 * Dùng chung cho BatchCard và Step5Image.
 */
export async function fetchImageModels(): Promise<ImageModelInfo[]> {
  try {
    const res = await fetch('/api/models?category=image');
    if (!res.ok) return DEFAULT_IMAGE_MODELS;
    const json = await res.json();

    const models: ImageModelInfo[] = [];
    const seen = new Set<string>();

    for (const m of (json.openai || [])) {
      if (!seen.has(m.id)) { seen.add(m.id); models.push(m); }
    }
    for (const m of (json.gemini || [])) {
      const id = GEMINI_IMAGE_ID_MAP[m.id] || m.id;
      if (!seen.has(id)) { seen.add(id); models.push({ ...m, id }); }
    }

    return models.length > 0 ? models : DEFAULT_IMAGE_MODELS;
  } catch {
    return DEFAULT_IMAGE_MODELS;
  }
}
