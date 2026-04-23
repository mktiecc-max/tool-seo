'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Filter, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Article } from '@/types';
import { formatDate } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';

const ALL_STATUSES = [
  'configuring', 'generating_outline', 'outline_review',
  'generating_content', 'content_review', 'generating_image',
  'image_review', 'publishing', 'done', 'failed',
];

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadArticles();
    // Subscribe to realtime changes
    const channel = supabase
      .channel('articles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => {
        loadArticles();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadArticles() {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    setArticles((data as Article[]) || []);
    setLoading(false);
  }

  const filtered = articles.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  const aiModelLabel = (model: string) => {
    const map: Record<string, string> = {
      claude: 'Claude',
      gpt4o: 'GPT-4o',
      gemini: 'Gemini',
    };
    return map[model] || model;
  };

  const articleTypeLabel = (t: string) => {
    const map: Record<string, string> = {
      pillar: 'Pillar Page',
      howto: 'How-to',
      listicle: 'Listicle',
      review: 'Review',
      comparison: 'So sánh',
    };
    return map[t] || t;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bài viết</h1>
            <p className="text-gray-400 text-sm mt-0.5">Quản lý toàn bộ bài viết SEO</p>
          </div>
        </div>
        <Link
          href="/articles/new"
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-blue-500/25 hover:-translate-y-0.5"
        >
          <Plus size={16} />
          Tạo bài mới
        </Link>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-6">
        <Filter size={14} className="text-gray-500" />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === ''
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            Tất cả ({articles.length})
          </button>
          {['outline_review', 'content_review', 'image_review'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {s === 'outline_review' ? 'Duyệt outline' :
               s === 'content_review' ? 'Duyệt nội dung' : 'Duyệt ảnh'}
              {' '}({articles.filter((a) => a.status === s).length})
            </button>
          ))}
          <button
            onClick={() => setStatusFilter(statusFilter === 'done' ? '' : 'done')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === 'done'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            Đã đăng ({articles.filter((a) => a.status === 'done').length})
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'failed' ? '' : 'failed')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === 'failed'
                ? 'bg-red-600/20 border-red-500 text-red-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            Thất bại ({articles.filter((a) => a.status === 'failed').length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <AlertCircle size={40} className="mb-3" />
            <p className="text-sm">Chưa có bài viết nào</p>
            <Link
              href="/articles/new"
              className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Tạo bài đầu tiên →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-6 py-3 font-medium">Từ khóa</th>
                <th className="text-left px-6 py-3 font-medium">Loại bài</th>
                <th className="text-left px-6 py-3 font-medium">AI Model</th>
                <th className="text-left px-6 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-6 py-3 font-medium">Ngày tạo</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((article) => (
                <tr
                  key={article.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/articles/${article.id}`}
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-200 max-w-[220px] truncate">
                      {article.keyword}
                    </p>
                    {article.wp_post_id && (
                      <p className="text-xs text-gray-500 mt-0.5">WP #{article.wp_post_id}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-400">{articleTypeLabel(article.article_type)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-gray-300">{aiModelLabel(article.ai_model)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={article.status} />
                    {article.error_message && (
                      <p className="text-xs text-red-400 mt-1 max-w-[150px] truncate">{article.error_message}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500">{formatDate(article.created_at)}</span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/articles/${article.id}`}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Xem →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
