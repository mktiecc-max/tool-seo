import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { Article } from '@/types';
import BatchBoard from '@/components/articles/BatchBoard';

interface Props {
  searchParams: { ids?: string };
}

export default async function BatchPage({ searchParams }: Props) {
  const ids = searchParams.ids?.split(',').filter(Boolean) || [];

  if (ids.length === 0) notFound();

  const db = createServerClient();
  const { data, error } = await db
    .from('articles')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) notFound();

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden">
      <BatchBoard initialArticles={data as Article[]} />
    </div>
  );
}
