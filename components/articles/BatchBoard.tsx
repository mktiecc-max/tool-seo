'use client';

import { useState, useCallback } from 'react';
import { Article } from '@/types';
import BatchCard from './BatchCard';
import { Download, CheckCircle, Clock, Loader2, Layers } from 'lucide-react';

interface Props {
  initialArticles: Article[];
}

export default function BatchBoard({ initialArticles }: Props) {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [exporting, setExporting] = useState(false);

  const handleUpdate = useCallback((updated: Article) => {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/articles/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: articles.map((a) => a.id) }),
      });
      if (!res.ok) throw new Error('Export thất bại');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seo-articles-${Date.now()}.csv`;
      a.click();
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
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-violet-400" />
            Batch Pipeline
          </h1>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
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
            {stats.failed > 0 && (
              <span className="text-red-400">{stats.failed} lỗi</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? 'Đang xuất...' : 'Xuất CSV / Google Sheets'}
          </button>
          <a
            href="/articles/new"
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors"
          >
            + Batch mới
          </a>
        </div>
      </div>

      {/* Cards — horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {articles.map((article) => (
          <BatchCard
            key={article.id}
            article={article}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* CSV instructions */}
      <div className="mt-4 shrink-0 bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3 text-xs text-gray-500">
        💡 <strong className="text-gray-400">Google Sheets:</strong> Click "Xuất CSV" → vào Google Sheets → Tệp → Nhập → Upload file CSV → Thay thế dữ liệu hiện tại
      </div>
    </div>
  );
}
