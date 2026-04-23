import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/supabase';
import { SerpResult } from '@/types';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchSerpAPI(
  keyword: string,
  lang: string,
  country: string,
  apiKey: string
): Promise<SerpResult> {
  const params = new URLSearchParams({
    q: keyword,
    hl: lang,
    gl: country,
    api_key: apiKey,
    num: '10',
    output: 'json',
  });

  const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
  if (res.status === 429) throw new Error('SerpAPI rate limit — hết quota');
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SerpAPI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  return {
    keyword,
    organic_results: (data.organic_results || []).slice(0, 10).map(
      (r: { position: number; title: string; link: string; snippet?: string }) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      })
    ),
    people_also_ask: (data.related_questions || [])
      .map((q: { question?: string }) => q.question)
      .filter(Boolean)
      .slice(0, 10),
    related_searches: (data.related_searches || [])
      .map((r: { query?: string }) => r.query)
      .filter(Boolean)
      .slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { keywords, lang, country }: {
      keywords: string[];
      lang: string;
      country: string;
    } = await req.json();

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({ error: 'Danh sách từ khóa trống' }, { status: 400 });
    }

    const settings = await getSettings();
    if (!settings?.serpapi_key) {
      return NextResponse.json(
        { error: 'SerpAPI key chưa được cấu hình. Vào Cài đặt để thêm.' },
        { status: 400 }
      );
    }

    const limited = keywords.slice(0, 5);
    const results: SerpResult[] = [];

    for (let i = 0; i < limited.length; i++) {
      if (i > 0) await sleep(1000); // Rate limit protection
      const result = await searchSerpAPI(
        limited[i],
        lang || 'vi',
        country || 'vn',
        settings.serpapi_key
      );
      results.push(result);
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Lỗi server' },
      { status: 500 }
    );
  }
}
