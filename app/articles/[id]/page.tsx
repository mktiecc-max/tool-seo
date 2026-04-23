'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Article } from '@/types';
import ArticleStepper from '@/components/articles/ArticleStepper';
import { Loader2 } from 'lucide-react';

interface Props {
  params: { id: string };
}

export default function ArticleDetailPage({ params }: Props) {
  const { id } = params;
  const searchParams = useSearchParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  // For "new" article: get keyword from query params
  const isNew = id === 'new';
  const keyword = searchParams.get('keyword') || '';
  const keywordId = searchParams.get('keyword_id') || undefined;

  useEffect(() => {
    if (!isNew) {
      fetchArticle();
    } else {
      setLoading(false);
    }
  }, [id]);

  async function fetchArticle() {
    const { data } = await supabase.from('articles').select('*').eq('id', id).single();
    setArticle(data as Article);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <ArticleStepper
        existingArticle={article}
        initialKeyword={isNew ? keyword : undefined}
        initialKeywordId={isNew ? keywordId : undefined}
        onArticleUpdate={setArticle}
      />
    </div>
  );
}
