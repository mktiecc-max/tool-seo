-- ============================================================
-- Brand Kits Migration
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- Bảng brand_kits
create table if not exists brand_kits (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  -- Visual identity
  brand_colors jsonb default '[]'::jsonb,     -- string[] hex codes
  logo_url text,
  -- Writing rules
  writing_rules text,                          -- markdown free-text
  tone_of_voice text,
  forbidden_words jsonb default '[]'::jsonb,  -- string[]
  target_audience text,
  -- Image rules
  image_style text,
  image_rules text,
  -- Uploaded guide files (text stored inline — no Storage needed)
  guide_files jsonb default '[]'::jsonb,       -- [{name, content_text}]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger auto-update updated_at
create trigger brand_kits_updated_at
  before update on brand_kits
  for each row execute function update_updated_at();

-- Thêm brand_kit_id vào articles
alter table articles add column if not exists brand_kit_id uuid references brand_kits(id) on delete set null;

-- Index
create index if not exists articles_brand_kit_id_idx on articles(brand_kit_id);
