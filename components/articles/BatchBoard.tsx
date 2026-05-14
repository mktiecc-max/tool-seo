'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Article } from '@/types';
import BatchCard from './BatchCard';
import {
  Download, CheckCircle, Clock, Loader2, Layers, Play,
  ExternalLink, CheckSquare, Square, RefreshCw, SkipForward,
} from 'lucide-react';
import { PROCESSING_STATUSES, REVIEW_STATUSES, DEFAULT_IMAGE_MODEL } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

// Trạng thái bài có thể được chọn để bulk action
const NON_SELECTABLE = PROCESSING_STATUSES as readonly string[];

interface Props {
  initialArticles: Article[];
  sheetUrl?: string;
}

export default function BatchBoard({ initialArticles, sheetUrl }: Props) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ inserted: number; updated: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkSkipping, setBulkSkipping] = useState(false);
  // Model ảnh mặc định đọc từ settings (để bulk action dùng đúng model)
  const [defaultImageModel, setDefaultImageModel] = useState(DEFAULT_IMAGE_MODEL);

  // Đọc default_image_ai từ Supabase khi mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('default_image_ai')
          .limit(1)
          .single();
        if (data?.default_image_ai) setDefaultImageModel(data.default_image_ai);
      } catch { /* giữ giá trị mặc định */ }
    })();
  }, []);

  // ── Article update/delete handlers ──────────────────────────────────────────
  const handleUpdate = useCallback((updated: Article) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  // ── Derived stats (memo để tránh tính lại mỗi render) ───────────────────────
  const { stats, selectableCount, bulkRunnable, skipImageCount, outlineCount, contentCount } = useMemo(() => {
    let done = 0, inProgress = 0, review = 0, failed = 0;
    let selectable = 0, runnable = 0, skipable = 0, outline = 0, content = 0;

    for (const a of articles) {
      if (a.status === 'done') done++;
      else if ((PROCESSING_STATUSES as readonly string[]).includes(a.status)) inProgress++;
      else if ((REVIEW_STATUSES as readonly string[]).includes(a.status)) review++;
      else if (a.status === 'failed') failed++;

      if (!NON_SELECTABLE.includes(a.status)) selectable++;

      if (selectedIds.has(a.id)) {
        if (a.status === 'outline_review') { runnable++; outline++; }
        if (a.status === 'content_review') { runnable++; content++; }
        if (a.status === 'image_review' || a.status === 'content_review') skipable++;
      }
    }

    return {
      stats: { done, inProgress, review, failed },
      selectableCount: selectable,
      bulkRunnable: runnable,
      skipImageCount: skipable,
      outlineCount: outline,
      contentCount: content,
    };
  }, [articles, selectedIds]);

  const selectAll = useCallback(() => {
    const selectable = articles
      .filter((a) => !NON_SELECTABLE.includes(a.status))
      .map((a) => a.id);
    if (selectedIds.size === selectable.length && selectable.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable));
    }
  }, [articles, selectedIds.size]);

  // Label động cho nút bulk run
  const bulkRunLabel = useMemo(() => {
    if (outlineCount > 0 && contentCount > 0) return `Duyệt & Tiếp tục ${bulkRunnable} bài`;
    if (outlineCount > 0) return `Duyệt & Viết ${outlineCount} bài`;
    if (contentCount > 0) return `Tạo ảnh ${contentCount} bài`;
    return `Duyệt & Viết ${selectedIds.size} bài`;
  }, [outlineCount, contentCount, bulkRunnable, selectedIds.size]);

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const handleBulkRun = async () => {
    const outlineTargets = articles.filter((a) => selectedIds.has(a.id) && a.status === 'outline_review');
    const contentTargets = articles.filter((a) => selectedIds.has(a.id) && a.status === 'content_review');
    if (outlineTargets.length === 0 && contentTargets.length === 0) return;
    setBulkRunning(true);

    // 1. Duyệt outline → sinh nội dung
    await Promise.allSettled(
      outlineTargets.map(async (a) => {
        try {
          const res = await fetch('/api/articles/confirm-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id, outline: a.outline }),
          });
          if (!res.ok) return;
          // Fire-and-forget content generation
          fetch('/api/articles/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id }),
          }).then((r) => r.body?.cancel()).catch(() => {});
          handleUpdate({ ...a, status: 'generating_content' });
        } catch { /* ignore per-article error */ }
      })
    );

    // 2. Sinh ảnh cho bài content_review (dùng model từ settings)
    await Promise.allSettled(
      contentTargets.map(async (a) => {
        try {
          const promptRes = await fetch('/api/articles/generate-image-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id }),
          });
          if (!promptRes.ok) return;
          const { image_prompt } = await promptRes.json();
          if (!image_prompt) return;
          // Fire-and-forget image generation
          fetch('/api/articles/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id, image_prompt, image_ai: defaultImageModel }),
          }).catch(() => {});
          handleUpdate({ ...a, status: 'generating_image' });
        } catch { /* ignore per-article error */ }
      })
    );

    setSelectedIds(new Set());
    setBulkRunning(false);
  };

  // Bỏ qua ảnh → đăng WP trực tiếp
  const handleBulkSkipImage = async () => {
    const targets = articles.filter(
      (a) => selectedIds.has(a.id) && (a.status === 'image_review' || a.status === 'content_review')
    );
    if (targets.length === 0) return;
    setBulkSkipping(true);

    await Promise.allSettled(
      targets.map(async (a) => {
        try {
          const res = await fetch('/api/articles/confirm-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id, image_url: null, skip_image: true }),
          });
          if (!res.ok) return;
          const json = await res.json();
          handleUpdate(json.article);
        } catch { /* ignore per-article error */ }
      })
    );

    setSelectedIds(new Set());
    setBulkSkipping(false);
  };

  // ── Sheet & CSV export ───────────────────────────────────────────────────────
  const handleSyncSheets = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : articles.map((a) => a.id);
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/articles/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sync thất bại');
      setSyncResult({ inserted: json.inserted, updated: json.updated });
      if (json.sheetUrl && sheetUrl) window.open(json.sheetUrl, '_blank');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const ids = selectedIds.size > 0 ? Array.from(selectedIds) : articles.map((a) => a.id);
      const res = await fetch('/api/articles/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: ids }),
      });
      if (!res.ok) throw new Error('Export thất bại');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `seo-articles-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-600">
        <Layers size={48} className="mb-4" />
        <p className="text-lg font-medium text-gray-500">Tất cả bài đã bị xóa</p>
        <a href="/articles/new" className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition-colors">
          ← Tạo batch mới
        </a>
      </div>
    );
  }

  const showBulkActions = selectedIds.size > 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-violet-400" />
            Batch Pipeline
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle size={11} className="text-emerald-500" />
              {stats.done} xong
            </span>
            <span className="flex items-center gap-1">
              {stats.inProgress > 0
                ? <Loader2 size={11} className="text-blue-400 animate-spin" />
                : <Loader2 size={11} className="text-gray-700" />}
              {stats.inProgress} đang chạy
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-amber-400" />
              {stats.review} chờ duyệt
            </span>
            {stats.failed > 0 && <span className="text-red-400">{stats.failed} lỗi</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-800/60 hover:bg-green-700/60 text-green-300 text-sm font-medium rounded-xl border border-green-700/50 transition-colors"
            >
              <ExternalLink size={14} /> Mở Sheet ↗
            </a>
          )}
          <button
            onClick={handleSyncSheets}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? 'Sync...' : selectedIds.size > 0 ? `Sync ${selectedIds.size} bài → Sheet` : 'Sync tất cả → Sheet'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Xuất...' : 'CSV'}
          </button>
          <a
            href="/articles/new"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors"
          >
            + Batch mới
          </a>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={selectAll}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700"
        >
          {selectedIds.size === selectableCount && selectableCount > 0
            ? <CheckSquare size={13} className="text-blue-400" />
            : <Square size={13} />}
          {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size}/${articles.length}` : 'Chọn tất cả'}
        </button>

        {showBulkActions && (
          <>
            <div className="h-4 w-px bg-gray-700" />

            {/* Duyệt & Tiếp tục */}
            <button
              onClick={handleBulkRun}
              disabled={bulkRunning || bulkRunnable === 0}
              className="flex items-center gap-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {bulkRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {bulkRunning ? 'Đang chạy...' : bulkRunnable > 0 ? bulkRunLabel : `Duyệt & Viết ${selectedIds.size} bài`}
            </button>

            {/* Bỏ qua ảnh → Đăng WP */}
            {skipImageCount > 0 && (
              <button
                onClick={handleBulkSkipImage}
                disabled={bulkSkipping}
                className="flex items-center gap-2 px-4 py-1.5 bg-gray-700 hover:bg-amber-900/50 disabled:opacity-40 text-gray-300 hover:text-amber-300 text-xs font-semibold rounded-lg border border-gray-600 hover:border-amber-700 transition-colors"
              >
                {bulkSkipping ? <Loader2 size={12} className="animate-spin" /> : <SkipForward size={12} />}
                {bulkSkipping ? 'Đang đăng...' : `Bỏ qua ảnh → Đăng ${skipImageCount} bài`}
              </button>
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Bỏ chọn
            </button>
          </>
        )}
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div className="mb-3 shrink-0 bg-blue-950/50 border border-blue-800 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm">
          <RefreshCw size={14} className="text-blue-400" />
          <span className="text-blue-300">
            Sync xong: <strong>{syncResult.inserted}</strong> bài mới, <strong>{syncResult.updated}</strong> bài cập nhật
          </span>
          {sheetUrl && (
            <a href={sheetUrl} target="_blank" className="ml-auto text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs transition-colors">
              <ExternalLink size={10} /> Mở Sheet
            </a>
          )}
          <button onClick={() => setSyncResult(null)} className="text-gray-600 hover:text-gray-400 ml-2">✕</button>
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-3 gap-4 pb-4">
        {articles.map((article) => (
          <BatchCard
            key={article.id}
            article={article}
            selected={selectedIds.has(article.id)}
            onToggleSelect={() => toggleSelect(article.id)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 shrink-0 bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-gray-500 flex items-center gap-2">
        💡 <span>Xuất CSV → Google Sheets → Tệp → Nhập → Upload để đồng bộ dữ liệu</span>
        {sheetUrl && (
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 ml-auto flex items-center gap-1 transition-colors">
            <ExternalLink size={10} /> Mở Sheet
          </a>
        )}
      </div>
    </div>
  );
}
