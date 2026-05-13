'use client';

import { useState, useEffect, useRef } from 'react';
import { Article, OutlineJSON, OutlineSection } from '@/types';
import {
  Loader2, RefreshCw, Trash2, CheckCircle2, ChevronRight,
  FileText, ImageIcon, Globe, AlertCircle, ExternalLink, Eye, EyeOff,
  Send, Pencil, Plus, MessageSquare, X, GripVertical, Sheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BATCH_IMG_SIZES = [
  { value: '1024x1024', label: 'Vuông', sub: '1:1' },
  { value: '1792x1024', label: 'Ngang', sub: '16:9' },
  { value: '1024x1792', label: 'Dọc', sub: '9:16' },
];

const BATCH_IMG_TYPES = [
  { value: 'illustration', label: 'Minh họa', hint: 'flat illustration style, vector art' },
  { value: 'photo', label: 'Ảnh thực', hint: 'realistic photo, high quality photography' },
  { value: 'poster', label: 'Poster', hint: 'creative poster design, bold typography' },
  { value: 'banner', label: 'Banner', hint: 'wide banner design, professional marketing' },
  { value: 'infographic', label: 'Infographic', hint: 'infographic design, data visualization' },
];

interface Props {
  article: Article;
  selected?: boolean;
  onToggleSelect?: () => void;
  onUpdate: (updated: Article) => void;
  onDelete: (id: string) => void;
}

const STEP_LABELS: Record<string, string> = {
  outline_review: '📋 Duyệt outline',
  generating_content: '✍️ Đang viết bài...',
  content_review: '👁️ Duyệt nội dung',
  generating_image: '🎨 Đang tạo ảnh...',
  image_review: '🖼️ Duyệt ảnh',
  publishing: '🚀 Đang đăng...',
  done: '✅ Hoàn thành',
  failed: '❌ Thất bại',
  configuring: '⚙️ Đang cấu hình',
};

const STEP_COLOR: Record<string, string> = {
  outline_review: 'border-amber-600/60 bg-amber-950/20',
  generating_content: 'border-blue-600/60 bg-blue-950/20',
  content_review: 'border-violet-600/60 bg-violet-950/20',
  generating_image: 'border-blue-600/60 bg-blue-950/20',
  image_review: 'border-violet-600/60 bg-violet-950/20',
  publishing: 'border-blue-600/60 bg-blue-950/20',
  done: 'border-emerald-600/60 bg-emerald-950/20',
  failed: 'border-red-700/60 bg-red-950/20',
};

export default function BatchCard({ article: initialArticle, selected = false, onToggleSelect, onUpdate, onDelete }: Props) {
  const [article, setArticle] = useState<Article>(initialArticle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOutline, setShowOutline] = useState(true);
  const [showContent, setShowContent] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [imgSize, setImgSize] = useState('1792x1024');
  const [imgType, setImgType] = useState('illustration');
  const [imgAI, setImgAI] = useState<'dalle3' | 'gpt-image-1' | 'gemini-imagen'>('gpt-image-1');

  // Dynamic image model list fetched from API
  const [imageModels, setImageModels] = useState<{
    id: string; name: string; provider: string; description?: string; isNew?: boolean;
  }[]>([
    { id: 'gpt-image-1', name: 'GPT Image 1', provider: 'openai', description: 'ChatGPT Image, thực tế nhất', isNew: true },
    { id: 'dalle3',      name: 'DALL-E 3',    provider: 'openai', description: 'Ổn định, nhiều style' },
    { id: 'gemini-imagen', name: 'Gemini Imagen 3', provider: 'gemini', description: 'Google, chất lượng cao' },
  ]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Google Sheets sync state
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; sheetUrl?: string; message?: string } | null>(null);

  // Outline editing state
  const [editingOutline, setEditingOutline] = useState(false);
  const [localOutline, setLocalOutline] = useState<OutlineJSON | null>(null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync parent updates
  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  // Poll when in an auto-processing state
  const isPolling = ['generating_content', 'generating_image', 'publishing'].includes(article.status);

  useEffect(() => {
    if (isPolling) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/articles/${article.id}`);
          if (!res.ok) return;
          const json = await res.json();
          const updated: Article = json.article;
          setArticle(updated);
          onUpdate(updated);
          if (!['generating_content', 'generating_image', 'publishing'].includes(updated.status)) {
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        } catch { /* ignore */ }
      }, 3000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [article.status, article.id, isPolling, onUpdate]);

  // Fetch image models dynamically when reaching content_review
  useEffect(() => {
    if (article.status !== 'content_review') return;
    setLoadingModels(true);
    fetch('/api/models?category=image')
      .then((r) => r.json())
      .then((json) => {
        const models: { id: string; name: string; provider: string; description?: string; isNew?: boolean }[] = [];
        // Remap API model IDs to our internal image_ai identifiers
        const idMap: Record<string, string> = {
          'dall-e-3': 'dalle3',
          'gpt-image-1': 'gpt-image-1',
          'imagen-3.0-generate-002': 'gemini-imagen',
          'imagen-4.0-generate-preview-05-20': 'gemini-imagen',
        };
        for (const m of [...(json.openai || []), ...(json.gemini || [])]) {
          const mapped = idMap[m.id];
          if (mapped && !models.find((x) => x.id === mapped)) {
            models.push({ ...m, id: mapped });
          }
        }
        if (models.length > 0) setImageModels(models);
      })
      .catch(() => { /* keep defaults */ })
      .finally(() => setLoadingModels(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.status]);

  const update = (updated: Article) => { setArticle(updated); onUpdate(updated); };

  // Sync article to Google Sheets
  const syncToSheet = async () => {
    setSyncingSheet(true);
    setSyncResult(null);
    setError('');
    try {
      const res = await fetch('/api/articles/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: [article.id] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Đồng bộ thất bại');
      setSyncResult({ ok: true, sheetUrl: json.sheetUrl, message: `Đã đồng bộ (${json.updated > 0 ? 'cập nhật' : 'thêm mới'})` });
    } catch (e: unknown) {
      setSyncResult({ ok: false, message: (e as Error).message });
    } finally {
      setSyncingSheet(false);
    }
  };

  const call = async (
    url: string,
    body: Record<string, unknown>,
    onSuccess: (json: Record<string, unknown>) => void
  ) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi không xác định');
      onSuccess(json);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const regenerateOutline = () => call(
    '/api/articles/generate-outline',
    {
      article_id: article.id,
      keyword: article.keyword,
      article_type: article.article_type,
      h2_count: article.h2_count,
      target_length: article.target_length,
      tone: article.tone,
      has_faq: article.has_faq,
      has_cta: article.has_cta,
      ai_model: article.ai_model,
    },
    (json) => update(json.article as Article)
  );

  const approveOutline = () => call(
    '/api/articles/confirm-outline',
    { article_id: article.id, outline: article.outline },
    (json) => {
      const confirmed = json.article as Article;
      update(confirmed);
      // Auto trigger content generation (streaming)
      setTimeout(() => generateContent(confirmed), 300);
    }
  );

  const generateContent = (a: Article = article) => {
    // Set locally immediately — polling will detect content_review when done
    const pending = { ...a, status: 'generating_content' as const };
    setArticle(pending);
    onUpdate(pending);
    setError('');
    // Fire streaming request — response is streamed text, not JSON
    fetch('/api/articles/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: a.id }),
    }).then(async (res) => {
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Lỗi' }));
        setError(json.error || 'Viết bài thất bại');
      }
      // Stream body — consume it so the server flush() saves to DB
      await res.body?.cancel();
    }).catch((e) => setError((e as Error).message));
  };

  const generateImagePrompt = async (a: Article = article) => {
    setError('');
    // 1. Get image prompt
    let prompt: string;
    try {
      const res = await fetch('/api/articles/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: a.id }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Lỗi tạo image prompt'); return; }
      prompt = json.image_prompt;
    } catch (e) { setError((e as Error).message); return; }

    // Append type hint
    const typeHint = BATCH_IMG_TYPES.find(t => t.value === imgType)?.hint || '';
    const finalPrompt = prompt.trim() + (typeHint ? `. Style: ${typeHint}` : '');

    // 2. Immediately trigger image generation (fire and forget)
    const pending = { ...a, status: 'generating_image' as const, image_prompt: finalPrompt };
    update(pending);
    fetch('/api/articles/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: a.id, image_prompt: finalPrompt, image_ai: imgAI, image_size: imgSize }),
    }).catch((e) => setError((e as Error).message));
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    try {
      await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
      onDelete(article.id);
    } catch {
      setError('Xóa thất bại');
      setLoading(false);
    }
  };

  // AI chat edit outline
  const handleChatEditOutline = async () => {
    if (!chatPrompt.trim() || chatLoading) return;
    setChatLoading(true);
    setError('');
    try {
      const currentOutline = localOutline || article.outline;
      const res = await fetch('/api/articles/edit-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          current_outline: currentOutline,
          user_prompt: chatPrompt.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi không xác định');
      const updated = json.article as Article;
      setArticle(updated);
      onUpdate(updated);
      setLocalOutline(updated.outline || null);
      setChatPrompt('');
      // Switch to editing mode to show the changes
      setEditingOutline(false);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setChatLoading(false);
    }
  };

  const outline: OutlineJSON | null = article.outline || null;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all',
      STEP_COLOR[article.status] || 'border-gray-700 bg-gray-800/30'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          className={cn(
            'mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-all',
            selected
              ? 'border-blue-500 bg-blue-600'
              : 'border-gray-600 bg-transparent hover:border-gray-400'
          )}
        >
          {selected && <span className="text-white text-xs font-bold leading-none">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-0.5 uppercase tracking-wide font-medium">Từ khóa</p>
          <p className="text-sm font-bold text-white leading-tight truncate" title={article.keyword}>
            {article.keyword}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 whitespace-nowrap shrink-0">
          {STEP_LABELS[article.status] || article.status}
        </span>
      </div>

      {/* Auto-processing spinner */}
      {isPolling && (
        <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/50 rounded-xl px-4 py-3">
          <Loader2 size={16} className="animate-spin text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">
            {article.status === 'generating_content' && 'AI đang viết bài...'}
            {article.status === 'generating_image' && 'AI đang tạo ảnh...'}
            {article.status === 'publishing' && 'Đang đăng lên WordPress...'}
          </p>
        </div>
      )}

      {/* OUTLINE REVIEW */}
      {article.status === 'outline_review' && outline && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowOutline((v) => !v)}
              className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              {showOutline ? <EyeOff size={12} /> : <Eye size={12} />}
              {showOutline ? 'Ẩn outline' : 'Xem outline'}
            </button>
            {showOutline && (
              <button
                onClick={() => {
                  setEditingOutline((v) => !v);
                  if (!localOutline) setLocalOutline(JSON.parse(JSON.stringify(outline)));
                }}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all',
                  editingOutline
                    ? 'text-amber-300 border-amber-500/50 bg-amber-500/10'
                    : 'text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                )}
              >
                <Pencil size={10} />
                {editingOutline ? 'Đang sửa' : 'Sửa outline'}
              </button>
            )}
          </div>
          {showOutline && (
            <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 text-xs space-y-1.5 max-h-[40vh] overflow-y-auto">
              {editingOutline && localOutline ? (
                /* ---- EDITABLE MODE ---- */
                <div className="space-y-2">
                  <input
                    value={localOutline.h1}
                    onChange={(e) => setLocalOutline({ ...localOutline, h1: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm font-bold focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="H1 - Tiêu đề bài"
                  />
                  {localOutline.sections?.map((s, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-500 font-bold text-[10px] shrink-0">H2</span>
                        <input
                          value={s.h2}
                          onChange={(e) => {
                            const sections = [...localOutline.sections];
                            sections[i] = { ...sections[i], h2: e.target.value };
                            setLocalOutline({ ...localOutline, sections });
                          }}
                          className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-amber-400 text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          onClick={() => {
                            const sections = localOutline.sections.filter((_, idx) => idx !== i);
                            setLocalOutline({ ...localOutline, sections });
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                          title="Xóa section"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      {s.h3s?.map((h3, j) => (
                        <div key={j} className="flex items-center gap-1.5 pl-4">
                          <span className="text-violet-500 font-medium text-[10px] shrink-0">H3</span>
                          <input
                            value={h3}
                            onChange={(e) => {
                              const sections = [...localOutline.sections];
                              const h3s = [...sections[i].h3s];
                              h3s[j] = e.target.value;
                              sections[i] = { ...sections[i], h3s };
                              setLocalOutline({ ...localOutline, sections });
                            }}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-gray-400 text-xs focus:outline-none focus:border-violet-500"
                          />
                          <button
                            onClick={() => {
                              const sections = [...localOutline.sections];
                              const h3s = sections[i].h3s.filter((_, idx) => idx !== j);
                              sections[i] = { ...sections[i], h3s };
                              setLocalOutline({ ...localOutline, sections });
                            }}
                            className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const sections = [...localOutline.sections];
                          const h3s = [...sections[i].h3s, 'Tiêu đề phụ mới'];
                          sections[i] = { ...sections[i], h3s };
                          setLocalOutline({ ...localOutline, sections });
                        }}
                        className="ml-4 flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        <Plus size={9} /> Thêm H3
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setLocalOutline({
                        ...localOutline,
                        sections: [...localOutline.sections, { h2: 'Tiêu đề mới', h3s: [], notes: '' }],
                      });
                    }}
                    className="flex items-center gap-1 w-full justify-center py-1.5 text-[10px] text-amber-400 hover:text-amber-300 border border-dashed border-amber-500/30 hover:border-amber-500/50 rounded-lg transition-colors"
                  >
                    <Plus size={10} /> Thêm H2
                  </button>
                  {/* Save / Cancel buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        // Apply local edits to article
                        const updated = { ...article, outline: localOutline };
                        setArticle(updated);
                        onUpdate(updated);
                        setEditingOutline(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={10} /> Lưu thay đổi
                    </button>
                    <button
                      onClick={() => {
                        setLocalOutline(null);
                        setEditingOutline(false);
                      }}
                      className="flex items-center justify-center gap-1 py-1.5 px-3 text-[10px] text-gray-400 hover:text-gray-300 border border-gray-700 rounded-lg transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                /* ---- READ-ONLY MODE ---- */
                <>
                  <p className="font-bold text-white text-sm leading-tight mb-2">{outline.h1}</p>
                  {outline.sections?.map((s, i) => (
                    <div key={i} className="pb-1.5 border-b border-gray-800/60 last:border-0">
                      <p className="text-amber-400 font-semibold">H2: {s.h2}</p>
                      {s.h3s?.map((h3, j) => (
                        <p key={j} className="text-gray-500 pl-3 leading-relaxed">↳ {h3}</p>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* AI Chat input for outline editing */}
          {showOutline && (
            <div className="relative">
              <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-700 rounded-xl px-3 py-2 focus-within:border-amber-500/50 transition-colors">
                <MessageSquare size={12} className="text-gray-500 shrink-0" />
                <input
                  ref={chatInputRef}
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && chatPrompt.trim() && !chatLoading) {
                      e.preventDefault();
                      handleChatEditOutline();
                    }
                  }}
                  placeholder="Yêu cầu AI sửa outline... (VD: thêm 2 H2 về lợi ích, xóa phần FAQ...)"
                  className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleChatEditOutline}
                  disabled={!chatPrompt.trim() || chatLoading}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                >
                  {chatLoading ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                  Gửi
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTENT REVIEW */}
      {article.status === 'content_review' && (
        <div className="space-y-2 flex-1 min-h-0">
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={12} className="text-violet-400 shrink-0" />
              <span className="text-xs text-gray-400 font-medium">
                ~{article.word_count?.toLocaleString() || '?'} từ
              </span>
              {article.meta_title && (
                <span className="text-xs text-gray-500 truncate" title={article.meta_title}>{article.meta_title}</span>
              )}
              <button
                onClick={() => setShowContent((v) => !v)}
                className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors shrink-0 flex items-center gap-1"
              >
                {showContent ? <EyeOff size={11} /> : <Eye size={11} />}
                {showContent ? 'Ẩn' : 'Xem'}
              </button>
            </div>
            {showContent && article.content_html && (
              <div
                className="text-xs text-gray-300 max-h-[50vh] overflow-y-auto prose prose-sm prose-invert leading-relaxed"
                dangerouslySetInnerHTML={{ __html: article.content_html }}
              />
            )}
          </div>
        </div>
      )}

      {/* IMAGE REVIEW */}
      {article.status === 'image_review' && (
        <div className="space-y-2">
          {article.image_url ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={article.image_url} alt="featured" className="w-full h-28 object-cover" />
              <span className="absolute top-2 right-2 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                ✓ Ảnh sẵn sàng
              </span>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl p-4 border border-dashed border-gray-700 flex items-center gap-3">
              <ImageIcon size={16} className="text-gray-600" />
              <p className="text-xs text-gray-500">Chưa có ảnh — cần tạo ảnh</p>
            </div>
          )}
        </div>
      )}

      {/* DONE */}
      {article.status === 'done' && (
        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs text-emerald-400 font-medium">🎉 Đã đăng thành công!</p>
          {article.wp_post_id && (
            <p className="text-xs text-gray-400">WordPress Post ID: #{article.wp_post_id}</p>
          )}
          {article.slug && (
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <Globe size={10} />
              <span className="truncate">/news/{article.slug}</span>
              <ExternalLink size={10} />
            </div>
          )}
          {/* Sheet sync result */}
          {syncResult && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs mt-1 rounded-lg px-2 py-1',
              syncResult.ok ? 'text-emerald-300 bg-emerald-500/10' : 'text-red-300 bg-red-500/10'
            )}>
              {syncResult.ok ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
              <span>{syncResult.message}</span>
              {syncResult.ok && syncResult.sheetUrl && (
                <a href={syncResult.sheetUrl} target="_blank" rel="noreferrer"
                  className="ml-auto text-emerald-400 hover:text-emerald-300 underline shrink-0"
                >
                  Mở Sheet ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* FAILED */}
      {article.status === 'failed' && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 line-clamp-3">{article.error_message || 'Lỗi không xác định'}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {article.status === 'outline_review' && (
          <>
            <button
              onClick={approveOutline}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Duyệt outline → Viết bài
            </button>
            <div className="flex gap-2">
              <button
                onClick={regenerateOutline}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
              >
                <RefreshCw size={11} /> Tạo lại
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-800 hover:bg-red-900/50 disabled:opacity-50 text-gray-400 hover:text-red-300 text-xs rounded-xl border border-gray-700 hover:border-red-700 transition-colors"
              >
                <Trash2 size={11} /> Xóa
              </button>
            </div>
          </>
        )}

        {article.status === 'content_review' && (
          <>
            {/* ── AI Model selector ── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400 font-medium">AI tạo ảnh</p>
                {loadingModels && <Loader2 size={10} className="animate-spin text-gray-500" />}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {imageModels.map((m) => {
                  const providerColor = m.provider === 'openai'
                    ? 'border-emerald-700 bg-emerald-500/10 text-emerald-300'
                    : 'border-blue-700 bg-blue-500/10 text-blue-300';
                  return (
                    <button
                      key={m.id}
                      onClick={() => setImgAI(m.id as typeof imgAI)}
                      className={cn(
                        'flex items-center gap-2 py-1.5 px-3 rounded-lg border text-left transition-all text-xs',
                        imgAI === m.id
                          ? providerColor
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      )}
                    >
                      <span className="font-semibold text-[11px] flex-1">{m.name}</span>
                      {m.isNew && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                          MỚI
                        </span>
                      )}
                      {m.description && (
                        <span className="text-[10px] text-gray-500 shrink-0">{m.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image type selector */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-medium">Loại ảnh</p>
              <div className="grid grid-cols-3 gap-1.5">
                {BATCH_IMG_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setImgType(t.value)}
                    className={cn(
                      'py-1.5 px-2 rounded-lg border text-center transition-all text-xs',
                      imgType === t.value
                        ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 font-medium mt-2">Kích thước</p>
              <div className="grid grid-cols-3 gap-1.5">
                {BATCH_IMG_SIZES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setImgSize(s.value)}
                    className={cn(
                      'py-1.5 px-2 rounded-lg border text-center transition-all text-xs',
                      imgSize === s.value
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    <span className="block font-semibold">{s.label}</span>
                    <span className="text-gray-500">{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => generateImagePrompt(article)}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
              Duyệt nội dung → Tạo ảnh
            </button>
            <a
              href={`/articles/${article.id}`}
              target="_blank"
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
            >
              <ExternalLink size={11} /> Xem chi tiết
            </a>
          </>
        )}

        {article.status === 'image_review' && (
          <>
            {article.image_url ? (
              <button
                onClick={() => call(
                  '/api/articles/confirm-image',
                  { article_id: article.id, image_url: article.image_url },
                  (json) => update(json.article as Article)
                )}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Dùng ảnh → Đăng bài
              </button>
            ) : (
              <a
                href={`/articles/${article.id}`}
                className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                <ImageIcon size={12} /> Tạo ảnh trong chi tiết
              </a>
            )}
            <a
              href={`/articles/${article.id}`}
              target="_blank"
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
            >
              <ExternalLink size={11} /> Mở chi tiết
            </a>
          </>
        )}

        {article.status === 'failed' && (
          <button
            onClick={() => {
              if (article.outline) {
                approveOutline();
              } else {
                regenerateOutline();
              }
            }}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Thử lại
          </button>
        )}

        {(article.status === 'done') && (
          <div className="flex gap-2">
            <a
              href={`/articles/${article.id}`}
              target="_blank"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-300 text-xs rounded-xl border border-emerald-700 transition-colors"
            >
              <ExternalLink size={11} /> Xem bài
            </a>
            <button
              onClick={syncToSheet}
              disabled={syncingSheet}
              title="Đồng bộ lên Google Sheet"
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-green-900/40 hover:bg-green-800/50 disabled:opacity-50 text-green-300 text-xs rounded-xl border border-green-700/60 hover:border-green-600 transition-colors"
            >
              {syncingSheet ? <Loader2 size={11} className="animate-spin" /> : <Sheet size={11} />}
              {syncingSheet ? 'Đang sync...' : 'Sync Sheet'}
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-white font-bold">Xóa bài viết?</h3>
            <p className="text-gray-400 text-sm">
              Bài viết <strong className="text-white">"{article.keyword}"</strong> sẽ bị xóa vĩnh viễn.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-2 text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="flex-1 py-2 text-sm text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl transition-colors"
              >
                {loading ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
