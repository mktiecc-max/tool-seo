'use client';

import { useState, useEffect, useRef } from 'react';
import { Article, OutlineJSON } from '@/types';
import {
  Loader2, RefreshCw, Trash2, CheckCircle2, ChevronRight,
  FileText, ImageIcon, Globe, AlertCircle, ExternalLink, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  article: Article;
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

export default function BatchCard({ article: initialArticle, onUpdate, onDelete }: Props) {
  const [article, setArticle] = useState<Article>(initialArticle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOutline, setShowOutline] = useState(true);
  const [showContent, setShowContent] = useState(true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  const update = (updated: Article) => { setArticle(updated); onUpdate(updated); };

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

  const generateImagePrompt = (a: Article = article) => {
    setError('');
    fetch('/api/articles/generate-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: a.id }),
    }).then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || 'Lỗi tạo image prompt'); return; }
      // Fetch latest article state
      const r2 = await fetch(`/api/articles/${a.id}`);
      const j2 = await r2.json();
      if (r2.ok) update(j2.article as Article);
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

  const outline: OutlineJSON | null = article.outline || null;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-5 flex flex-col gap-4 min-w-[420px] w-[440px] shrink-0 transition-all',
      STEP_COLOR[article.status] || 'border-gray-700 bg-gray-800/30'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
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
          <button
            onClick={() => setShowOutline((v) => !v)}
            className="flex items-center gap-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {showOutline ? <EyeOff size={12} /> : <Eye size={12} />}
            {showOutline ? 'Ẩn outline' : 'Xem outline'}
          </button>
          {showOutline && (
            <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 text-xs space-y-1.5 max-h-[420px] overflow-y-auto">
              <p className="font-bold text-white text-sm leading-tight mb-2">{outline.h1}</p>
              {outline.sections?.map((s, i) => (
                <div key={i} className="pb-1.5 border-b border-gray-800/60 last:border-0">
                  <p className="text-amber-400 font-semibold">H2: {s.h2}</p>
                  {s.h3s?.map((h3, j) => (
                    <p key={j} className="text-gray-500 pl-3 leading-relaxed">↳ {h3}</p>
                  ))}
                </div>
              ))}
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
                className="text-xs text-gray-300 max-h-[480px] overflow-y-auto prose prose-sm prose-invert leading-relaxed"
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
        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3 space-y-1">
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
          <a
            href={`/articles/${article.id}`}
            target="_blank"
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-900/50 hover:bg-emerald-800/50 text-emerald-300 text-xs rounded-xl border border-emerald-700 transition-colors"
          >
            <ExternalLink size={11} /> Xem bài hoàn chỉnh
          </a>
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
