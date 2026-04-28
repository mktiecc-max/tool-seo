'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Article } from '@/types';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ArticleStepper from '@/components/articles/ArticleStepper';

interface Props { params: { id: string } }

export default function LibraryArticlePage({ params }: Props) {
  const { id } = params;
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  const loadArticle = useCallback(async () => {
    const { data } = await supabase.from('articles').select('*').eq('id', id).single();
    if (data) {
      setArticle(data as Article);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  const handleArticleUpdate = (updated: Article) => {
    setArticle(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-8 text-center text-gray-500">Không tìm thấy bài viết</div>
    );
  }

  return (
    <div className="p-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/library')}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Quay lại Content Library
      </button>

      {/* Full ArticleStepper — auto-jumps to correct step based on article status */}
      <ArticleStepper
        existingArticle={article}
        initialKeyword={article.keyword}
        initialKeywordId={article.keyword_id || undefined}
        onArticleUpdate={handleArticleUpdate}
      />
    </div>
  );
}
