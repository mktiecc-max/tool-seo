'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArticleJob } from '@/types';
import { X, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  configuring: 'cấu hình...',
  generating_outline: 'tạo outline...',
  generating_content: 'đang viết...',
  generating_image: 'tạo ảnh...',
  ready_to_review: '✓ Hoàn thành',
  failed: '✗ Thất bại',
};

export default function BatchProgressWidget() {
  const router = useRouter();
  const [jobs, setJobs] = useState<(ArticleJob & { article?: { keyword: string; status: string } })[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadRunningJobs();

    const channel = supabase
      .channel('batch-widget')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'article_jobs' }, () => {
        loadRunningJobs();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'articles' }, (payload) => {
        setJobs((prev) =>
          prev.map((j) =>
            j.article_id === payload.new.id
              ? { ...j, article: { keyword: payload.new.keyword as string, status: payload.new.status as string } }
              : j
          ) as typeof prev
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadRunningJobs() {
    const { data } = await supabase
      .from('article_jobs')
      .select('*, article:articles(keyword, status)')
      .in('status', ['queued', 'running'])
      .order('queued_at', { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      setJobs(data as (ArticleJob & { article?: { keyword: string; status: string } })[]);
      setDismissed(false);
    } else {
      // Check if there are recently done/failed jobs (last 30s)
      const { data: recent } = await supabase
        .from('article_jobs')
        .select('*, article:articles(keyword, status)')
        .in('status', ['done', 'failed'])
        .gte('finished_at', new Date(Date.now() - 30000).toISOString())
        .limit(5);

      if (recent && recent.length > 0) {
        setJobs(recent as (ArticleJob & { article?: { keyword: string; status: string } })[]);
      } else {
        setJobs([]);
      }
    }
  }

  if (!mounted || dismissed || jobs.length === 0) return null;

  const runningCount = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const doneCount = jobs.filter((j) => j.status === 'done').length;
  const totalBatch = runningCount + doneCount;
  const percent = totalBatch > 0 ? Math.round((doneCount / totalBatch) * 100) : 0;
  const allDone = runningCount === 0;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 w-80 glass-card rounded-2xl shadow-2xl border overflow-hidden cursor-pointer',
        'border-gray-700 hover:border-gray-600 transition-colors',
        allDone ? 'border-emerald-700/50' : 'border-blue-700/50'
      )}
      onClick={() => router.push('/library')}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3',
        allDone ? 'bg-emerald-950/50' : 'bg-blue-950/50'
      )}>
        {!allDone && <Loader2 size={15} className="animate-spin text-blue-400 shrink-0" />}
        {allDone && <span className="text-emerald-400 text-sm">✓</span>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">
            {allDone ? 'Batch hoàn thành!' : `Đang tạo bài — ${doneCount}/${totalBatch}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Click để xem trong Library</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-800"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {!allDone && (
        <div className="px-4 pt-1 pb-2 bg-gray-950/30">
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full transition-all duration-1000"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Active jobs list */}
      <div className="divide-y divide-gray-800/50 max-h-40 overflow-y-auto">
        {jobs.slice(0, 5).map((job) => {
          const artStatus = job.article?.status || '';
          const label = STATUS_LABEL[artStatus] || artStatus;
          const isDone = job.status === 'done';
          const isFailed = job.status === 'failed';

          return (
            <div key={job.id} className="flex items-center gap-2.5 px-4 py-2.5">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                isDone ? 'bg-emerald-400' : isFailed ? 'bg-red-400' : 'bg-blue-400 animate-pulse'
              )} />
              <p className="text-xs text-gray-300 flex-1 truncate">
                {job.article?.keyword || 'Bài viết'}
              </p>
              <span className={cn(
                'text-xs shrink-0',
                isDone ? 'text-emerald-400' : isFailed ? 'text-red-400' : 'text-gray-500'
              )}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {jobs.length > 5 && (
        <div className="flex items-center justify-center px-4 py-2 text-xs text-gray-500 bg-gray-900/50">
          <ChevronRight size={12} className="mr-1" />
          {jobs.length - 5} bài khác đang chờ
        </div>
      )}
    </div>
  );
}
