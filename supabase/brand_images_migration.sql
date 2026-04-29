-- Thêm cột brand_images vào bảng brand_kits
-- Chạy trong Supabase SQL Editor

alter table brand_kits add column if not exists brand_images jsonb default '[]'::jsonb;
-- [{name, data_url, description}] — lưu base64 data URL trực tiếp
