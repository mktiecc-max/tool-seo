'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  Loader2,
  Clock,
  CheckCircle2,
  Plus,
  TrendingUp,
  FileText,
  AlertCircle,
  Library,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Article, ArticleJob, DashboardStats, STATUS_BADGE } from '@/types';
import { formatDate } from '@/lib/utils';
import StatusBadge from '@/components/ui/StatusBadge';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total_keywords: 0,
    articles_generating: 0,
    articles_review: 0,
    articles_done: 0,
  });
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [runningJobs, setRunningJobs] = useState<(ArticleJob & { article?: { keyword: string; status: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [
      { count: kwCount },
      { data: arts },
      { data: jobs },
    ] = await Promise.all([
      supabase.from('keywords').select('*', { count: 'exact', head: true }),
      supabase.from('articles').select('*').order('created_at', { ascending: false }).limit(10),
      supabase
        .from('article_jobs')
        .select('*, article:articles(keyword, status)')
        .in('status', ['queued', 'running'])
        .order('queued_at', { ascending: false })
        .limit(5),
    ]);

    const articles = (arts || []) as Article[];
    setRecentArticles(articles);
    setRunningJobs((jobs || []) as (ArticleJob & { article?: { keyword: string; status: string } })[]);

    // Stats using all-time counts from DB
    const [
      { count: generatingCount },
      { count: reviewCount },
      { count: doneCount },
    ] = await Promise.all([
      supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .in('status', ['configuring', 'generating_outline', 'generating_content', 'generating_image']),
      supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ready_to_review', 'in_review', 'needs_revision', 'outline_review', 'content_review', 'image_review']),
      supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'done')
        .not('wp_post_id', 'is', null),
    ]);

    setStats({
      total_keywords: kwCount || 0,
      articles_generating: generatingCount || 0,
      articles_review: reviewCount || 0,
      articles_done: doneCount || 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'article_jobs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const router = useRouter();

  const statCards = [
    {
      label: 'Tổng từ khóa',
      value: stats.total_keywords,
      icon: KeyRound,
      color: 'from-blue-500 to-blue-600',
      glow: 'shadow-blue-500/20',
      href: '/keywords',
    },
    {
      label: 'Đang tạo',
      value: stats.articles_generating,
      icon: Loader2,
      color: 'from-violet-500 to-violet-600',
      glow: 'shadow-violet-500/20',
      spin: true,
      href: '/library?tab=generating',
    },
    {
      label: 'Chờ duyệt',
      value: stats.articles_review,
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      glow: 'shadow-amber-500/20',
      href: '/library?tab=review',
    },
    {
      label: 'Đã đăng',
      value: stats.articles_done,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-emerald-600',
      glow: 'shadow-emerald-500/20',
      href: '/library?tab=published',
    },
  ];

  const STEP_LABEL: Record<string, string> = {
    configuring: 'cấu hình',
    generating_outline: 'tạo outline...',
    generating_content: 'đang viết...',
    generating_image: 'tạo ảnh...',
    ready_to_review: 'hoàn thành ✓',
    failed: 'thất bại ✗',
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Tổng quan hoạt động SEO Automation</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/library"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            <Library size={15} /> Content Library
          </Link>
          <Link
            href="/articles/new"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            <Plus size={16} /> Tạo bài mới
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, glow, spin, href }) => (
          <button
            key={label}
            onClick={() => router.push(href)}
            className={`glass-card rounded-2xl p-5 shadow-xl ${glow} text-left w-full hover:scale-[1.02] transition-transform duration-200 cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg`}>
                <Icon size={18} className={`text-white ${spin && loading ? 'animate-spin' : ''}`} />
              </div>
              <TrendingUp size={14} className="text-gray-600" />
            </div>
            <p className="text-3xl font-bold text-white mb-1">
              {loading ? <span className="text-gray-600">—</span> : value.toLocaleString('vi-VN')}
            </p>
            <p className="text-gray-400 text-sm">{label}</p>
          </button>
        ))}
      </div>

      {/* Batch đang chạy */}
      {runningJobs.length > 0 && (
        <div className="glass-card rounded-2xl p-5 mb-6 border border-blue-800/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <Zap size={15} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-sm">Batch đang chạy</h2>
                <p className="text-xs text-gray-500 mt-0.5">{runningJobs.length} bài trong hàng chờ</p>
              </div>
            </div>
            <Link
              href="/library"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              Xem tất cả trong Library →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
            {runningJobs.map((job) => {
              const step = job.article?.status || '';
              return (
                <div key={job.id} className="bg-gray-900/60 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${job.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`} />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-200 truncate font-medium">{job.article?.keyword || '...'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{STEP_LABEL[step] || step}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <h2 className="font-semibold text-white text-sm">Hoạt động gần đây</h2>
          </div>
          <Link href="/library" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            Xem tất cả →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-600" />
          </div>
        ) : recentArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <AlertCircle size={40} className="mb-3" />
            <p className="text-sm">Chưa có bài viết nào</p>
            <Link href="/articles/new" className="mt-3 text-blue-400 hover:text-blue-300 text-sm transition-colors">
              Tạo bài đầu tiên →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-6 py-3 font-medium">Từ khóa</th>
                <th className="text-left px-6 py-3 font-medium">Loại bài</th>
                <th className="text-left px-6 py-3 font-medium">AI</th>
                <th className="text-left px-6 py-3 font-medium">Số từ</th>
                <th className="text-left px-6 py-3 font-medium">Trạng thái</th>
                <th className="text-left px-6 py-3 font-medium">Thời gian</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {recentArticles.map((article) => {
                const isReviewable = ['ready_to_review', 'in_review', 'needs_revision', 'outline_review', 'content_review', 'image_review'].includes(article.status);
                return (
                  <tr key={article.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-gray-200 max-w-[200px] truncate">{article.keyword}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs text-gray-400 capitalize">{article.article_type}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs text-gray-400 uppercase">{article.ai_model}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs text-gray-400">
                        {article.word_count ? article.word_count.toLocaleString('vi-VN') : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs text-gray-500">{formatDate(article.created_at)}</span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {isReviewable ? (
                        <Link
                          href={`/library/${article.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                        >
                          Tiếp tục →
                        </Link>
                      ) : (
                        <Link
                          href={`/library`}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          Xem →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
