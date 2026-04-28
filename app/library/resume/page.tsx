'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Article } from '@/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import BatchBoard from '@/components/articles/BatchBoard';

export default function LibraryResumePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idsParam = params.get('ids');

    if (!idsParam) {
      setError('Không có bài nào được chọn');
      setLoading(false);
      return;
    }

    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length === 0) {
      setError('Danh sách ID trống');
      setLoading(false);
      return;
    }

    supabase
      .from('articles')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); }
        else { setArticles((data as Article[]) || []); }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || articles.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error || 'Không tìm thấy bài viết'}</p>
        <button
          onClick={() => router.push('/library')}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          ← Quay lại Library
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-screen">
      <button
        onClick={() => router.push('/library')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-4 shrink-0 w-fit"
      >
        <ArrowLeft size={16} /> Quay lại Content Library
      </button>

      <div className="flex-1 min-h-0">
        <BatchBoard initialArticles={articles} />
      </div>
    </div>
  );
}
