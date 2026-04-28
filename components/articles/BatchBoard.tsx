'use client';

import { useState, useCallback, useRef } from 'react';
import { Article } from '@/types';
import BatchCard from './BatchCard';
import { Download, CheckCircle, Clock, Loader2, Layers, Play, ExternalLink, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface Props {
  initialArticles: Article[];
  sheetUrl?: string; // optional: link to existing Google Sheet
}

export default function BatchBoard({ initialArticles, sheetUrl }: Props) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ inserted: number; updated: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const cardRefs = useRef<Record<string, { approveOutline: () => void; generateContent: (a: Article) => void }>>({});

  const handleUpdate = useCallback((updated: Article) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const selectAll = () => {
    const selectable = articles.filter((a) => !['generating_content', 'generating_image', 'publishing'].includes(a.status));
    if (selectedIds.size === selectable.length && selectable.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((a) => a.id)));
    }
  };

  // Bulk approve outlines for selected cards that are in outline_review
  const handleBulkRun = async () => {
    const targets = articles.filter(
      (a) => selectedIds.has(a.id) && a.status === 'outline_review'
    );
    if (targets.length === 0) return;
    setBulkRunning(true);
    // Fire all in parallel — each card's internal polling will track progress
    await Promise.all(
      targets.map(async (a) => {
        try {
          // 1. Confirm outline
          const res = await fetch('/api/articles/confirm-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id, outline: a.outline }),
          });
          if (!res.ok) return;
          // 2. Fire content generation (streaming — fire and forget)
          fetch('/api/articles/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: a.id }),
          }).then((r) => r.body?.cancel()).catch(() => {});
          // Update local state to generating_content
          handleUpdate({ ...a, status: 'generating_content' });
        } catch { /* ignore per-article errors */ }
      })
    );
    setSelectedIds(new Set());
    setBulkRunning(false);
  };

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

  // Stats
  const stats = {
    done: articles.filter((a) => a.status === 'done').length,
    inProgress: articles.filter((a) =>
      ['generating_content', 'generating_image', 'publishing'].includes(a.status)
    ).length,
    review: articles.filter((a) =>
      ['outline_review', 'content_review', 'image_review'].includes(a.status)
    ).length,
    failed: articles.filter((a) => a.status === 'failed').length,
  };

  const selectableCount = articles.filter(
    (a) => !['generating_content', 'generating_image', 'publishing'].includes(a.status)
  ).length;

  const bulkRunnable = articles.filter(
    (a) => selectedIds.has(a.id) && a.status === 'outline_review'
  ).length;

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

  return (
    <div className="flex flex-col h-full">
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
              <Loader2 size={11} className="text-blue-400 animate-spin" />
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
        {/* Select all toggle */}
        <button
          onClick={selectAll}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700"
        >
          {selectedIds.size === selectableCount && selectableCount > 0
            ? <CheckSquare size={13} className="text-blue-400" />
            : <Square size={13} />}
          {selectedIds.size > 0 ? `Đã chọn ${selectedIds.size}/${articles.length}` : 'Chọn tất cả'}
        </button>

        {selectedIds.size > 0 && (
          <>
            <div className="h-4 w-px bg-gray-700" />
            {bulkRunnable > 0 && (
              <button
                onClick={handleBulkRun}
                disabled={bulkRunning}
                className="flex items-center gap-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {bulkRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {bulkRunning ? 'Đang chạy...' : `Duyệt & Viết ${bulkRunnable} bài`}
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

      {/* Cards — horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
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

      {/* Footer hint */}
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
