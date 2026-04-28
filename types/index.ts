// ============================================================
// TypeScript Interfaces & Types for SEO Automation Webapp
// ============================================================

// ---- Enums ----

export type KeywordSource = 'manual' | 'competitor' | 'serp';
export type KeywordStatus = 'pending' | 'queued' | 'done';
export type KeywordIntent = 'informational' | 'commercial' | 'transactional' | 'navigational';

export type ArticleType = 'pillar' | 'howto' | 'listicle' | 'review' | 'comparison';
export type ArticleTone = 'expert' | 'friendly' | 'persuasive' | 'neutral';
export type AIModel = 'claude' | 'gpt4o' | 'gemini';
export type ImageAI = 'dalle3' | 'gemini-imagen';

export type ArticleStatus =
  | 'configuring'
  | 'generating_outline'
  | 'outline_review'
  | 'generating_content'
  | 'content_review'
  | 'generating_image'
  | 'image_review'
  | 'publishing'
  | 'done'
  | 'failed'
  | 'ready_to_review'   // batch xong, chờ người duyệt
  | 'in_review'         // đang mở review
  | 'needs_revision';   // bị reject, cần sửa

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

// ---- Database Models ----

export interface Keyword {
  id: string;
  keyword: string;
  source: KeywordSource;
  source_url?: string;
  volume?: number;
  difficulty?: number;
  intent?: KeywordIntent;
  cluster?: string;
  status: KeywordStatus;
  created_at: string;
}

export interface Article {
  id: string;
  keyword_id?: string;
  keyword: string;
  article_type: ArticleType;
  tone: ArticleTone;
  h2_count: number;
  target_length: number;
  has_faq: boolean;
  has_cta: boolean;
  ai_model: AIModel;
  outline?: OutlineJSON;
  content_html?: string;
  meta_title?: string;
  meta_description?: string;
  slug?: string;
  image_prompt?: string;
  image_ai?: ImageAI;
  image_url?: string;
  wp_media_id?: number;
  wp_post_id?: number;
  scheduled_date?: string;  // ISO8601, null nếu không lên lịch
  word_count?: number;      // Tự tính sau khi generate content
  status: ArticleStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleJob {
  id: string;
  article_id: string;
  article?: Article; // joined
  status: JobStatus;
  queued_at: string;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
}

export interface CompetitorCrawl {
  id: string;
  url: string;
  title?: string;
  headings?: HeadingItem[];
  meta_description?: string;
  word_count?: number;
  keywords_extracted?: string[];
  crawled_at: string;
}

export interface Settings {
  id: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  anthropic_api_key?: string;
  serpapi_key?: string;
  wp_url?: string;
  wp_username?: string;
  wp_app_password?: string;
  default_ai_model?: AIModel;
  default_image_ai?: ImageAI;
  max_concurrent_jobs: number;  // default 3
  // Model versions (tùy chọn — dùng default nếu không chọn)
  openai_model?: string;      // e.g. 'gpt-4o', 'gpt-4o-mini', 'o4-mini'
  gemini_model?: string;      // e.g. 'gemini-2.0-flash', 'gemini-2.5-pro'
  anthropic_model?: string;   // e.g. 'claude-opus-4-5', 'claude-3-5-sonnet-20241022'
}

// ---- Outline ----

export interface OutlineSection {
  h2: string;
  h3s: string[];
  notes?: string;
}

export interface OutlineJSON {
  h1: string;
  sections: OutlineSection[];
  faq?: string[];
  meta_title?: string;
  meta_description?: string;
}

// ---- SERP Result ----

export interface SerpOrganicResult {
  position: number;
  title: string;
  link: string;
  snippet?: string;
}

export interface SerpResult {
  keyword: string;
  organic_results: SerpOrganicResult[];
  people_also_ask: string[];
  related_searches: string[];
}

// ---- Competitor Crawl ----

export interface HeadingItem {
  level: number; // 1, 2, 3, 4
  text: string;
}

export interface CompetitorCrawlResult {
  url: string;
  title?: string;
  headings: HeadingItem[];
  meta_description?: string;
  word_count: number;
  keywords_extracted: string[];
  error?: string;
}

// ---- CSV Import ----

export interface CSVKeywordRow {
  keyword: string;
  volume?: number;
  difficulty?: number;
}

// ---- WordPress ----

export interface WPCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WPTag {
  id: number;
  name: string;
  slug: string;
}

// ---- API Responses ----

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface ImportResponse {
  inserted: number;
  skipped: number;
}

export interface GenerateOutlineResponse {
  article_id: string;
  outline: OutlineJSON;
}

export interface GenerateImageResponse {
  image_url: string;
}

export interface PublishResponse {
  wp_post_id: number;
  wp_post_url: string;
}

export interface BatchCreateResponse {
  queued: number;
  article_ids: string[];
}

// ---- UI State ----

export interface ArticleConfig {
  keyword: string;
  keyword_id?: string;
  article_type: ArticleType;
  tone: ArticleTone;
  h2_count: number;
  target_length: number;
  has_faq: boolean;
  has_cta: boolean;
  ai_model: AIModel;
  image_ai: ImageAI;
}

export interface DashboardStats {
  total_keywords: number;
  articles_generating: number;
  articles_review: number;
  articles_done: number;
}

// ---- Status Badge mapping ----

export const STATUS_BADGE: Record<ArticleStatus, string> = {
  configuring:          'bg-gray-700 text-gray-300',
  generating_outline:   'bg-amber-900/50 text-amber-300',
  outline_review:       'bg-amber-900/50 text-amber-300',
  generating_content:   'bg-amber-900/50 text-amber-300',
  content_review:       'bg-amber-900/50 text-amber-300',
  generating_image:     'bg-amber-900/50 text-amber-300',
  image_review:         'bg-amber-900/50 text-amber-300',
  publishing:           'bg-blue-900/50 text-blue-300',
  done:                 'bg-emerald-900/50 text-emerald-300',
  failed:               'bg-red-900/50 text-red-300',
  ready_to_review:      'bg-blue-900/50 text-blue-300',
  in_review:            'bg-purple-900/50 text-purple-300',
  needs_revision:       'bg-red-900/50 text-red-300',
};
