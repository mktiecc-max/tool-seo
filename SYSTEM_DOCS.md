# 📘 SEO Automation — Tài liệu Hệ thống

> **Phiên bản:** 0.1.0 | **Stack:** Next.js 14 · Supabase · Claude / GPT-4o / Gemini · DALL-E 3 / Gemini Imagen · WordPress REST API

---

## 🎯 Tổng quan

**SEO Automation** là công cụ nội bộ tự động hóa toàn bộ quy trình sản xuất nội dung SEO — từ nghiên cứu từ khóa, lên outline, viết bài, tạo ảnh, đến đăng lên WordPress. Hệ thống hỗ trợ nhiều mô hình AI, Brand Kit riêng biệt và xử lý hàng loạt bài viết song song.

---

## 🏗️ Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js 14 App Router                   │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Frontend UI  │  │  API Routes  │  │  Lib Modules  │  │
│  │  (React/TSX)  │  │  (/app/api)  │  │  (/lib/*.ts)  │  │
│  └───────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
└──────────┼─────────────────┼───────────────────┼──────────┘
           │                 │                   │
    ┌──────▼──────┐  ┌───────▼──────┐  ┌────────▼────────┐
    │  Supabase   │  │   AI Models  │  │  External APIs  │
    │  (DB + Storage) │  │ Claude/GPT/Gemini │  │ WP/Sheets/SERP │
    └─────────────┘  └──────────────┘  └─────────────────┘
```

---

## 📁 Cấu trúc thư mục

```
seo-automation/
├── app/
│   ├── api/
│   │   ├── articles/          # 14 API endpoints xử lý vòng đời bài viết
│   │   ├── brand-kits/        # CRUD Brand Kit
│   │   ├── keywords/          # Quản lý từ khóa, SERP crawl
│   │   ├── settings/          # Cấu hình API keys
│   │   ├── wordpress/         # Tích hợp WordPress
│   │   └── jobs/              # Hàng đợi batch
│   ├── articles/              # Trang quản lý bài viết
│   ├── brand-kits/            # Trang Brand Kit editor
│   ├── dashboard/             # Dashboard tổng quan
│   └── keywords/              # Trang từ khóa
├── components/
│   ├── articles/
│   │   ├── ArticleStepper.tsx # Stepper 6 bước
│   │   ├── BatchBoard.tsx     # Batch Pipeline board
│   │   ├── BatchCard.tsx      # Card từng bài trong batch
│   │   ├── BatchCreateModal.tsx
│   │   ├── BrandKitSelector.tsx
│   │   └── steps/
│   │       ├── Step1Config.tsx    # Cấu hình bài viết
│   │       ├── Step2Outline.tsx   # Review & chỉnh outline
│   │       ├── Step3Generating.tsx # Theo dõi sinh nội dung
│   │       ├── Step4Review.tsx    # Review nội dung (Tiptap editor)
│   │       ├── Step5Image.tsx     # Tạo ảnh (type + size + AI)
│   │       └── Step6Publish.tsx   # Đăng WordPress
│   ├── keywords/
│   │   └── BatchCreateModal.tsx   # Tạo batch từ từ khóa
│   ├── layout/
│   │   └── Sidebar.tsx
│   └── ui/                        # Radix UI components
├── lib/
│   ├── ai/
│   │   ├── openai.ts     # callOpenAI, generateImageDALLE3 (hỗ trợ size)
│   │   ├── gemini.ts     # callGemini, generateImageGemini
│   │   └── claude.ts     # callClaude (streaming)
│   ├── ai-router.ts      # Router chọn AI theo model
│   ├── brand-context.ts  # buildBrandContext, buildBrandImageContext
│   ├── prompts.ts        # Tất cả prompt templates
│   ├── supabase.ts       # Client/Server Supabase clients
│   ├── wordpress.ts      # WordPress REST API helpers
│   ├── google-sheets.ts  # Google Sheets sync
│   └── utils.ts          # truncate, formatDate, cn...
├── types/
│   └── index.ts          # Tất cả TypeScript types
└── supabase/
    ├── schema.sql                    # Schema gốc
    ├── brand_kits_migration.sql      # Migration Brand Kit
    └── brand_images_migration.sql    # Migration brand_images
```

---

## 🗄️ Database Schema (Supabase / PostgreSQL)

### Bảng `keywords`
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | uuid PK | ID duy nhất |
| `keyword` | text | Từ khóa chính |
| `source` | text | `manual` / `competitor` / `serp` |
| `source_url` | text | URL nguồn (competitor crawl) |
| `volume` | integer | Lượng tìm kiếm tháng |
| `difficulty` | integer | Độ khó SEO (0-100) |
| `intent` | text | `informational` / `commercial` / `transactional` / `navigational` |
| `cluster` | text | Nhóm chủ đề |
| `status` | text | `pending` / `queued` / `done` |

### Bảng `articles`
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | uuid PK | ID bài viết |
| `keyword_id` | uuid FK | Liên kết từ khóa |
| `keyword` | text | Từ khóa chính |
| `article_type` | text | `pillar` / `howto` / `listicle` / `review` / `comparison` |
| `tone` | text | `expert` / `friendly` / `persuasive` / `neutral` |
| `h2_count` | integer | Số heading H2 |
| `target_length` | integer | Số ký tự mục tiêu |
| `has_faq` | boolean | Có section FAQ |
| `has_cta` | boolean | Có CTA cuối bài |
| `ai_model` | text | `claude` / `gpt4o` / `gemini` |
| `brand_kit_id` | uuid FK | Brand Kit áp dụng |
| `outline` | jsonb | Cấu trúc outline (`{h1, sections[{h2, h3s[]}]}`) |
| `content_html` | text | Nội dung HTML đã sinh |
| `meta_title` | text | SEO title |
| `meta_description` | text | SEO description |
| `slug` | text | URL slug |
| `image_prompt` | text | Prompt tạo ảnh |
| `image_ai` | text | `dalle3` / `gemini-imagen` |
| `image_url` | text | URL ảnh featured |
| `wp_post_id` | integer | WordPress Post ID sau khi đăng |
| `word_count` | integer | Số từ nội dung |
| `status` | text | *(xem vòng đời bên dưới)* |
| `error_message` | text | Thông báo lỗi (nếu có) |

**Vòng đời trạng thái bài viết:**
```
configuring → generating_outline → outline_review
           → generating_content → content_review
           → generating_image  → image_review
           → publishing → done
                ↘ failed (bất kỳ bước nào)
```

### Bảng `brand_kits`
| Cột | Kiểu | Mô tả |
|-----|------|--------|
| `id` | uuid PK | |
| `name` | text | Tên thương hiệu |
| `description` | text | Mô tả |
| `brand_colors` | jsonb | Mảng hex colors `["#6B21A8", ...]` |
| `logo_url` | text | URL hoặc base64 data URL logo |
| `writing_rules` | text | Quy tắc viết (markdown) |
| `tone_of_voice` | text | Tone giọng văn |
| `forbidden_words` | jsonb | Danh sách từ cấm |
| `target_audience` | text | Đối tượng mục tiêu |
| `image_style` | text | Phong cách ảnh |
| `image_rules` | text | Quy tắc tạo ảnh |
| `guide_files` | jsonb | `[{name, content_text, size}]` |
| `brand_images` | jsonb | `[{name, data_url, description}]` |

### Bảng `settings` (1 hàng)
| Cột | Mô tả |
|-----|--------|
| `openai_api_key` | OpenAI API key (DALL-E 3, GPT-4o) |
| `gemini_api_key` | Google Gemini API key |
| `anthropic_api_key` | Anthropic Claude API key |
| `serpapi_key` | SerpAPI key (SERP research) |
| `wp_url` | WordPress site URL |
| `wp_username` | WordPress username |
| `wp_app_password` | WordPress Application Password |
| `default_ai_model` | Model AI mặc định |
| `default_image_ai` | AI tạo ảnh mặc định |
| `max_concurrent_jobs` | Số job song song tối đa |

---

## 🔌 API Endpoints

### Articles (`/api/articles/`)

| Endpoint | Method | Chức năng |
|----------|--------|-----------|
| `generate-outline` | POST | Tạo outline từ keyword + cấu hình |
| `confirm-outline` | POST | Duyệt outline → chuyển `generating_content` |
| `generate-content` | POST | Viết nội dung (streaming) |
| `save-content` | POST | Lưu nội dung đã chỉnh sửa |
| `generate-image-prompt` | POST | Sinh image prompt từ nội dung |
| `generate-image` | POST | Tạo ảnh (DALL-E 3 / Gemini Imagen) |
| `upload-image` | POST | Upload ảnh thủ công lên Storage |
| `confirm-image` | POST | Duyệt ảnh → `image_review` |
| `publish` | POST | Đăng lên WordPress |
| `bulk-publish` | POST | Đăng hàng loạt |
| `batch-create` | POST | Tạo nhiều bài cùng lúc |
| `export-csv` | POST | Xuất CSV |
| `sync-sheets` | POST | Đồng bộ Google Sheets |
| `[id]` | GET/PATCH/DELETE | CRUD bài viết |

### Brand Kits (`/api/brand-kits/`)

| Endpoint | Method | Chức năng |
|----------|--------|-----------|
| `/` | GET | Danh sách Brand Kit |
| `/` | POST | Tạo Brand Kit mới |
| `/[id]` | GET | Chi tiết Brand Kit |
| `/[id]` | PATCH | Cập nhật Brand Kit |
| `/[id]` | DELETE | Xóa Brand Kit |

---

## 🤖 AI Integration

### Text Generation
```
User chọn model → ai-router.ts → callAI()
                             ├─ claude   → callClaude() [Anthropic SDK, streaming]
                             ├─ gpt4o    → callOpenAI() [OpenAI SDK, streaming]
                             └─ gemini   → callGemini() [Google GenAI SDK]
```

### Image Generation
```
User chọn AI + size + type → generate-image API
                          ├─ dalle3         → generateImageDALLE3(key, prompt, size)
                          │                    size: 1024x1024 | 1792x1024 | 1024x1792
                          └─ gemini-imagen  → generateImageGemini(key, prompt)
                                               → base64 → upload Supabase Storage
```

### Brand Context Injection
Khi bài viết có `brand_kit_id`, hệ thống tự động inject brand context vào **System Prompt** của AI:

```typescript
// lib/brand-context.ts
buildBrandContext(brandKit) → systemPrompt:
  "Bạn đang viết cho thương hiệu [name].
   Màu sắc: [colors]
   Quy tắc viết: [writing_rules]
   Tone: [tone_of_voice]
   Từ cấm: [forbidden_words]
   ..."
```

---

## 🎨 Brand Kit

Bộ nhận diện thương hiệu cho phép AI tạo nội dung và ảnh đúng theo brand guidelines.

### Các tính năng:
1. **Logo** — Upload file ảnh (base64) hoặc nhập URL
2. **Trích xuất màu từ logo** — Canvas API đọc pixels, lấy 5 màu chủ đạo
3. **Bảng màu** — Thêm/xóa màu hex thủ công
4. **Quy tắc viết** — Markdown free-text
5. **Từ cấm** — Danh sách từ AI không được dùng
6. **File hướng dẫn** — Upload `.md` / `.txt`, nội dung được inject vào prompt
7. **Gallery ảnh** — Upload nhiều ảnh brand (logo variant, banner, icon...) kèm mô tả

### Áp dụng Brand Kit:
- Chọn trong **Step 1 Config** (bài đơn lẻ)
- Chọn trong **Batch Create Modal** (tạo hàng loạt)
- AI tự động nhận brand context qua System Prompt ở tất cả các bước

---

## 📊 Batch Pipeline

Giao diện xử lý hàng loạt bài viết dạng Kanban:

```
[Chọn bài] → [Duyệt & Viết bài / Tạo ảnh] → Polling 3s → Cập nhật trạng thái
```

### Nút "Duyệt & Viết / Tạo ảnh" (bulk action):
- **`outline_review`** → Confirm outline → trigger `generate-content`
- **`content_review`** → Generate image prompt → trigger `generate-image`
- Nhãn nút thông minh theo trạng thái bài được chọn

### Chọn loại & kích thước ảnh trong BatchCard:
Khi card ở `content_review`, hiển thị trực tiếp:
- **Loại ảnh:** Minh họa / Ảnh thực / Poster / Banner / Infographic
- **Kích thước:** Vuông 1:1 / Ngang 16:9 (mặc định) / Dọc 9:16

---

## 🖼️ Image Generation Flow

```
Step 5 Image (single article):
  1. Auto-sinh image prompt từ nội dung bài
  2. Chọn Loại ảnh (6 loại)
  3. Chọn Kích thước (3 size)
  4. Chọn AI (DALL-E 3 / Gemini Imagen)
  5. Tạo ảnh → Preview → Dùng ảnh này

BatchCard (batch pipeline):
  1. Chọn Loại ảnh + Kích thước inline trong card
  2. Click "Duyệt nội dung → Tạo ảnh"
  3. Auto-sinh prompt → append style hint → generate image
  4. Polling 3s → hiển thị ảnh khi xong
```

---

## 🔗 WordPress Integration

```
Publish flow:
  1. Upload ảnh featured → WordPress Media Library → lấy wp_media_id
  2. Tạo post với: title, content, meta_title, meta_description,
                  slug, featured_media_id, status (draft/publish)
  3. Lưu wp_post_id vào Supabase
  4. Cập nhật status → 'done'
```

**Yêu cầu WordPress:**
- Cài plugin **Application Passwords** (WordPress 5.6+)
- REST API phải public (`/wp-json/wp/v2/`)

---

## 📊 Google Sheets Sync

- Sync bài viết (meta_title, keyword, status, wp_post_id, word_count...) lên Google Sheet
- Dùng **Google Service Account** với quyền Editor trên Sheet
- Tự động tạo/cập nhật hàng theo article_id

---

## ⚙️ Cài đặt & Deploy

### 1. Clone & Install
```bash
git clone https://github.com/mktiecc-max/tool-seo.git
cd seo-automation
npm install
```

### 2. Environment Variables
Tạo file `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### 3. Database Setup (Supabase)
Chạy theo thứ tự trong Supabase SQL Editor:
```sql
-- 1. Schema gốc
-- Chạy: supabase/schema.sql

-- 2. Brand Kit migration
-- Chạy: supabase/brand_kits_migration.sql

-- 3. Brand Images migration
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS brand_images JSONB DEFAULT '[]'::jsonb;
```

### 4. API Keys (trong app /settings)
| Key | Dịch vụ |
|-----|---------|
| OpenAI API Key | GPT-4o text + DALL-E 3 image |
| Anthropic API Key | Claude text |
| Google Gemini API Key | Gemini text + Imagen image |
| SerpAPI Key | SERP keyword research |
| WordPress credentials | Đăng bài tự động |

### 5. Deploy lên Vercel
```bash
git push origin main
# → Vercel auto-deploy khi kết nối GitHub repo
```

---

## 🔒 Bảo mật

- **API Keys** lưu trong bảng `settings` của Supabase (không lưu trong code)
- **Supabase RLS** (Row Level Security) — cấu hình theo nhu cầu
- **Service Role Key** chỉ dùng server-side (trong `/app/api/`)
- **Anon Key** dùng client-side (chỉ read data public)

---

## 📦 Dependencies chính

| Package | Phiên bản | Mục đích |
|---------|-----------|---------|
| `next` | 14.2.35 | Framework chính |
| `@supabase/supabase-js` | ^2.104 | Database & Storage |
| `openai` | ^6.34 | GPT-4o + DALL-E 3 |
| `@anthropic-ai/sdk` | ^0.90 | Claude |
| `@google/generative-ai` | ^0.24 | Gemini |
| `@tiptap/react` | ^3.22 | Rich text editor |
| `react-dropzone` | ^15 | Upload ảnh |
| `lucide-react` | ^1.8 | Icons |
| `zustand` | ^5 | State management |
| `tailwindcss` | ^3.4 | Styling |

---

## 🚀 Roadmap

- [ ] Lên lịch đăng bài tự động (scheduled_date)
- [ ] Multi-site WordPress support
- [ ] Internal linking tự động
- [ ] Keyword clustering nâng cao
- [ ] Analytics dashboard (CTR, ranking tracking)
- [ ] Export WordPress XML

---

*Tài liệu được tạo ngày 29/04/2026 — SEO Automation v0.1.0*
