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

  // Sheet URL from env (set NEXT_PUBLIC_GOOGLE_SHEET_URL in Vercel)
  const sheetUrl = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || undefined;

  return (
    <div className="p-8 flex flex-col">
      <BatchBoard initialArticles={data as Article[]} sheetUrl={sheetUrl} />
    </div>
  );
}
