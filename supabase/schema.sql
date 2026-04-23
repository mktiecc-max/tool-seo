-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Keywords table
create table keywords (
  id uuid default uuid_generate_v4() primary key,
  keyword text not null,
  source text not null check (source in ('manual','competitor','serp')),
  source_url text,
  volume integer,
  difficulty integer,
  intent text check (intent in ('informational','commercial','transactional','navigational')),
  cluster text,
  status text not null default 'pending' check (status in ('pending','queued','done')),
  created_at timestamptz default now()
);

-- Articles table
create table articles (
  id uuid default uuid_generate_v4() primary key,
  keyword_id uuid references keywords(id),
  keyword text not null,
  article_type text not null,
  tone text not null,
  h2_count integer not null default 5,
  target_length integer not null default 2000,
  has_faq boolean default false,
  has_cta boolean default true,
  ai_model text not null,
  outline jsonb,
  content_html text,
  meta_title text,
  meta_description text,
  slug text,
  image_prompt text,
  image_ai text,
  image_url text,
  wp_media_id integer,
  wp_post_id integer,
  scheduled_date timestamptz,
  word_count integer,
  status text not null default 'configuring'
    check (status in (
      'configuring','generating_outline','outline_review',
      'generating_content','content_review','generating_image',
      'image_review','publishing','done','failed',
      'ready_to_review','in_review','needs_revision'
    )),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Settings table (single row)
create table settings (
  id uuid default uuid_generate_v4() primary key,
  openai_api_key text,
  gemini_api_key text,
  anthropic_api_key text,
  serpapi_key text,
  wp_url text,
  wp_username text,
  wp_app_password text,
  default_ai_model text default 'claude',
  default_image_ai text default 'dalle3',
  max_concurrent_jobs integer default 3
);

-- Competitor crawls cache
create table competitor_crawls (
  id uuid default uuid_generate_v4() primary key,
  url text not null unique,
  title text,
  headings jsonb,
  meta_description text,
  word_count integer,
  keywords_extracted jsonb,
  crawled_at timestamptz default now()
);

-- Article jobs queue (batch generation)
create table article_jobs (
  id uuid default uuid_generate_v4() primary key,
  article_id uuid references articles(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','running','done','failed')),
  queued_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text
);

create index article_jobs_status_idx on article_jobs(status);
create index article_jobs_article_id_idx on article_jobs(article_id);

-- Trigger auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger articles_updated_at
  before update on articles
  for each row execute function update_updated_at();

-- ============================================================
-- MIGRATION SCRIPT (chạy nếu đã có DB cũ — v1 → v2)
-- ============================================================
-- alter table articles add column if not exists scheduled_date timestamptz;
-- alter table articles add column if not exists word_count integer;
-- alter table articles drop constraint if exists articles_status_check;
-- alter table articles add constraint articles_status_check
--   check (status in (
--     'configuring','generating_outline','outline_review',
--     'generating_content','content_review','generating_image',
--     'image_review','publishing','done','failed',
--     'ready_to_review','in_review','needs_revision'
--   ));
-- alter table settings add column if not exists max_concurrent_jobs integer default 3;
-- create table if not exists article_jobs ( ... );  -- xem bên trên
