'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Article, ArticleStatus, STATUS_BADGE } from '@/types';
import { Library, Search, Filter, Loader2, Trash2, Send, ExternalLink, RefreshCw, AlertCircle, CheckSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'generating' | 'review' | 'revision' | 'scheduled' | 'published';

const TAB_CONFIG: { id: Tab; label: string; statuses: ArticleStatus[] }[] = [
  { id: 'all', label: 'Tất cả', statuses: [] },
  {
    id: 'generating',
    label: 'Đang tạo',
    statuses: ['configuring', 'generating_outline', 'generating_content', 'generating_image'],
  },
  { id: 'review', label: 'Chờ duyệt', statuses: ['ready_to_review', 'in_review', 'outline_review', 'content_review', 'image_review'] },
  { id: 'revision', label: 'Cần sửa', statuses: ['needs_revision'] },
  { id: 'scheduled', label: 'Đã lên lịch', statuses: ['done'] },
  { id: 'published', label: 'Đã đăng', statuses: ['done'] },
];

const AI_FILTERS = ['Tất cả', 'claude', 'gpt4o', 'gemini'];

const STATUS_LABEL: Record<ArticleStatus, string> = {
  configuring: 'Cấu hình',
  generating_outline: 'Tạo outline...',
  outline_review: 'Chờ duyệt outline',
  generating_content: 'Viết bài...',
  content_review: 'Chờ duyệt nội dung',
  generating_image: 'Tạo ảnh...',
  image_review: 'Chờ duyệt ảnh',
  publishing: 'Đang đăng...',
  done: 'Hoàn thành',
  failed: 'Thất bại',
  ready_to_review: 'Chờ duyệt',
  in_review: 'Đang review',
  needs_revision: 'Cần sửa',
};

export default function LibraryPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [aiFilter, setAiFilter] = useState('Tất cả');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number } | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ count: number } | null>(null);

  const loadArticles = useCallback(async () => {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    setArticles((data as Article[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadArticles();

    // Realtime — update rows without full reload
    const channel = supabase
      .channel('library-articles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'articles' }, (payload) => {
        setArticles((prev) =>
          prev.map((a) => (a.id === payload.new.id ? { ...a, ...(payload.new as Article) } : a))
        );
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'articles' }, () => {
        loadArticles();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadArticles]);

  // Filter logic
  const filtered = articles.filter((a) => {
    const tabConf = TAB_CONFIG.find((t) => t.id === activeTab);
    if (tabConf && tabConf.statuses.length > 0) {
      if (!tabConf.statuses.includes(a.status)) return false;
      // Distinguish scheduled vs published for 'done' articles
      if (activeTab === 'scheduled' && (!a.scheduled_date || a.wp_post_id)) return false;
      if (activeTab === 'published' && (!a.wp_post_id || a.scheduled_date)) return false;
    }
    if (aiFilter !== 'Tất cả' && a.ai_model !== aiFilter) return false;
    if (search && !a.keyword.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const handleBulkPublish = async () => {
    if (selected.size === 0) return;
    setBulkPublishing(true);
    setBulkResult(null);
    try {
      const res = await fetch('/api/articles/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: Array.from(selected), wp_status: 'draft' }),
      });
      const json = await res.json();
      setBulkResult({ success: json.success?.length || 0, failed: json.failed?.length || 0 });
      setSelected(new Set());
      await loadArticles();
    } finally {
      setBulkPublishing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!deleteConfirm) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of deleteConfirm.ids) {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (res.ok) deleted++;
    }
    setBulkDeleting(false);
    setDeleteConfirm(null);
    setSelected(new Set());
    setDeleteResult({ count: deleted });
    await loadArticles();
  };

  const handleDeleteOne = (article: Article) => {
    setDeleteConfirm({
      ids: [article.id],
      label: `"${article.keyword}"`,
    });
  };

  const handleRetry = async (article_id: string) => {
    const db = supabase;
    await db.from('article_jobs').insert({ article_id, status: 'queued' });
    await db.from('articles').update({ status: 'configuring', error_message: null }).eq('id', article_id);
    await fetch('/api/jobs/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-call': '1' },
    });
    await loadArticles();
  };

  const pendingCount = articles.filter((a) => ['ready_to_review', 'in_review', 'outline_review', 'content_review', 'image_review'].includes(a.status)).length;
  const generatingCount = articles.filter((a) =>
    ['configuring', 'generating_outline', 'generating_content', 'generating_image'].includes(a.status)
  ).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
            <Library size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Content Library</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {generatingCount > 0 && <span className="text-amber-400">{generatingCount} đang tạo • </span>}
              {pendingCount > 0 && <span className="text-blue-400">{pendingCount} chờ duyệt • </span>}
              {articles.length} bài tổng
            </p>
          </div>
        </div>
        <button
          onClick={loadArticles}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm rounded-xl border border-gray-700 transition-colors"
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Delete result toast */}
      {deleteResult && (
        <div className="mb-4 bg-gray-900 border border-red-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
          <Trash2 size={16} className="text-red-400" />
          <p className="text-sm text-gray-300">
            Đã xóa <span className="text-red-400 font-medium">{deleteResult.count} bài</span>
          </p>
          <button onClick={() => setDeleteResult(null)} className="ml-auto text-gray-500 hover:text-gray-300">✕</button>
        </div>
      )}

      {/* Bulk result toast */}
      {bulkResult && (
        <div className="mb-4 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckSquare size={16} className="text-emerald-400" />
          <p className="text-sm text-gray-300">
            Đã đăng: <span className="text-emerald-400 font-medium">{bulkResult.success} bài</span>
            {bulkResult.failed > 0 && (
              <> • <span className="text-red-400">{bulkResult.failed} thất bại</span></>
            )}
          </p>
          <button onClick={() => setBulkResult(null)} className="ml-auto text-gray-500 hover:text-gray-300">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900/60 p-1 rounded-xl w-fit">
        {TAB_CONFIG.map((tab) => {
          const count = tab.id === 'all'
            ? articles.length
            : tab.id === 'review'
            ? articles.filter((a) => ['ready_to_review', 'in_review', 'outline_review', 'content_review', 'image_review'].includes(a.status)).length
            : tab.id === 'revision'
            ? articles.filter((a) => a.status === 'needs_revision').length
            : tab.id === 'generating'
            ? articles.filter((a) => ['configuring', 'generating_outline', 'generating_content', 'generating_image'].includes(a.status)).length
            : tab.id === 'scheduled'
            ? articles.filter((a) => a.status === 'done' && a.scheduled_date && !a.wp_post_id).length
            : articles.filter((a) => a.status === 'done' && a.wp_post_id && !a.scheduled_date).length;

          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelected(new Set()); }}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                activeTab === tab.id
                  ? 'bg-gray-800 text-white shadow'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full font-bold',
                  tab.id === 'review' ? 'bg-blue-600/30 text-blue-400' :
                  tab.id === 'revision' ? 'bg-red-600/30 text-red-400' :
                  tab.id === 'generating' ? 'bg-amber-600/30 text-amber-400' :
                  'bg-gray-700 text-gray-400'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + AI Filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo từ khóa..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-gray-500" />
          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {AI_FILTERS.map((f) => (
              <option key={f} value={f}>{f === 'Tất cả' ? 'Tất cả AI' : f.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-blue-950 border border-blue-800 rounded-xl px-4 py-3">
          <span className="text-sm text-blue-300 font-medium">Đã chọn {selected.size} bài</span>
          <button
            onClick={handleBulkPublish}
            disabled={bulkPublishing || bulkDeleting}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
          >
            {bulkPublishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Đăng Draft lên WP
          </button>
          <button
            onClick={() => setDeleteConfirm({
              ids: Array.from(selected),
              label: `${selected.size} bài đã chọn`,
            })}
            disabled={bulkPublishing || bulkDeleting}
            className="flex items-center gap-2 px-4 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
          >
            <Trash2 size={13} /> Xóa {selected.size} bài
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors ml-auto"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Library size={40} className="mb-3" />
            <p className="text-sm">Không có bài viết nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded accent-blue-500"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Từ khóa</th>
                <th className="text-left px-4 py-3 font-medium">Loại bài</th>
                <th className="text-left px-4 py-3 font-medium">AI</th>
                <th className="text-left px-4 py-3 font-medium">Số từ</th>
                <th className="text-left px-4 py-3 font-medium w-24">Ảnh</th>
                <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3 font-medium text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => {
                const isGenerating = ['configuring', 'generating_outline', 'generating_content', 'generating_image'].includes(article.status);
                const isReviewable = [
                  'ready_to_review', 'in_review', 'needs_revision',
                  'outline_review', 'content_review', 'image_review',
                ].includes(article.status);
                const reviewLabel =
                  article.status === 'needs_revision' ? 'Sửa lại' :
                  article.status === 'outline_review' ? 'Duyệt outline' :
                  article.status === 'content_review' ? 'Duyệt nội dung' :
                  article.status === 'image_review' ? 'Duyệt ảnh' :
                  'Review';

                return (
                  <tr
                    key={article.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(article.id)}
                        onChange={() => toggleSelect(article.id)}
                        className="rounded accent-blue-500"
                        disabled={isGenerating}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-200 max-w-[200px] truncate">{article.keyword}</p>
                      {article.wp_post_id && (
                        <p className="text-xs text-gray-500 mt-0.5">WP #{article.wp_post_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{article.article_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-300 uppercase">{article.ai_model}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">
                        {article.word_count ? `${article.word_count.toLocaleString('vi-VN')}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {article.image_url ? (
                        <img
                          src={article.image_url}
                          alt=""
                          className="w-16 h-9 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-9 bg-gray-800 rounded-lg flex items-center justify-center">
                          <span className="text-gray-700 text-xs">—</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
                        STATUS_BADGE[article.status]
                      )}>
                        {isGenerating && <Loader2 size={10} className="animate-spin" />}
                        {STATUS_LABEL[article.status]}
                      </span>
                      {article.error_message && (
                        <p className="text-xs text-red-400 mt-1 max-w-[150px] truncate">{article.error_message}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{formatDate(article.created_at)}</span>
                      {article.scheduled_date && (
                        <p className="text-xs text-violet-400 mt-0.5">
                          📅 {new Date(article.scheduled_date).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isReviewable && (
                          <Link
                            href={`/library/${article.id}`}
                            className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-3 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            {reviewLabel}
                          </Link>
                        )}
                        {isGenerating && (
                          <span className="text-xs text-gray-600 italic">Đang tạo...</span>
                        )}
                        {article.status === 'done' && article.wp_post_id && (
                          <button
                            onClick={() => window.open(`${article.slug}`, '_blank')}
                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink size={11} /> Xem bài
                          </button>
                        )}
                        {article.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(article.id)}
                            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            <RefreshCw size={11} /> Thử lại
                          </button>
                        )}
                        {/* Delete button for every row */}
                        {!isGenerating && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteOne(article); }}
                            className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Xóa bài"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-900/50 border border-red-700 rounded-xl flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Xóa bài viết?</h3>
                <p className="text-gray-500 text-xs mt-0.5">Hành động này không thể hoàn tác</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Bạn sẽ xóa vĩnh viễn <strong className="text-white">{deleteConfirm.label}</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={bulkDeleting}
                className="flex-1 py-2.5 text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-xl border border-gray-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 py-2.5 text-sm text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
              >
                {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {bulkDeleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
