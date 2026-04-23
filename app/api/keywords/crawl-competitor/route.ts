import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CompetitorCrawlResult, HeadingItem } from '@/types';

async function crawlUrl(url: string): Promise<CompetitorCrawlResult> {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
      },
      validateStatus: (s) => s < 400,
    });

    const $ = cheerio.load(res.data);

    // Extract headings
    const headings: HeadingItem[] = [];
    $('h1, h2, h3, h4').each((_, el) => {
      const tagName = (el as { tagName?: string }).tagName || '';
      const level = parseInt(tagName.replace('h', ''));
      const text = $(el).text().trim();
      if (text) headings.push({ level, text });
    });

    // Extract body text for keyword extraction
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(/\s+/).length;

    // Simple keyword extraction from headings
    const keywordsExtracted = Array.from(
      new Set(
        headings
          .map((h) => h.text.toLowerCase())
          .filter((t) => t.length > 3 && t.length < 60)
      )
    ).slice(0, 30);

    return {
      url,
      title: $('title').text().trim() || $('h1').first().text().trim(),
      headings,
      meta_description: $('meta[name="description"]').attr('content') || '',
      word_count: wordCount,
      keywords_extracted: keywordsExtracted,
    };
  } catch (err: unknown) {
    const msg = (err as { response?: { status?: number }; code?: string }).response?.status === 403
      ? 'Site không cho phép crawl (403)'
      : (err as { code?: string }).code === 'ECONNREFUSED'
      ? 'Không thể kết nối tới site'
      : `Lỗi crawl: ${(err as Error).message}`;
    return { url, headings: [], word_count: 0, keywords_extracted: [], error: msg };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { urls }: { urls: string[] } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Danh sách URL trống' }, { status: 400 });
    }

    const limited = urls.slice(0, 10);
    // Crawl with retry (1 retry per URL)
    const results: CompetitorCrawlResult[] = [];
    for (const url of limited) {
      let result = await crawlUrl(url);
      if (result.error) {
        // Retry once
        result = await crawlUrl(url);
      }
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
