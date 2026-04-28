import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const TIMEOUT = 12000;

/* ─── helpers ─── */

function normalizeOrigin(input: string): string {
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`);
    return u.origin; // e.g. https://ucmasvietnam.com
  } catch {
    return '';
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await axios.get(url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA },
      validateStatus: (s) => s < 400,
    });
    return typeof r.data === 'string' ? r.data : null;
  } catch {
    return null;
  }
}

/* ─── sitemap parser ─── */

async function getUrlsFromSitemap(origin: string, maxUrls: number): Promise<string[]> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/post-sitemap.xml`,
    `${origin}/page-sitemap.xml`,
  ];

  const collected = new Set<string>();

  for (const sitemapUrl of candidates) {
    if (collected.size >= maxUrls) break;
    const html = await fetchHtml(sitemapUrl);
    if (!html) continue;

    const $ = cheerio.load(html, { xmlMode: true });

    // sitemap index → recurse into child sitemaps
    const childSitemaps: string[] = [];
    $('sitemap > loc').each((_, el) => { childSitemaps.push($(el).text().trim()); });
    for (const cs of childSitemaps) {
      if (collected.size >= maxUrls) break;
      const csHtml = await fetchHtml(cs);
      if (!csHtml) continue;
      const $cs = cheerio.load(csHtml, { xmlMode: true });
      $cs('url > loc').each((_, el) => {
        const u = $cs(el).text().trim();
        if (u.startsWith(origin)) collected.add(u);
      });
    }

    // direct url entries
    $('url > loc').each((_, el) => {
      const u = $(el).text().trim();
      if (u.startsWith(origin)) collected.add(u);
    });

    if (collected.size > 0) break; // found valid sitemap, stop trying
  }

  return [...collected].slice(0, maxUrls);
}

/* ─── internal link spider ─── */

async function spiderSite(origin: string, maxUrls: number): Promise<string[]> {
  const visited = new Set<string>();
  const queue: string[] = [origin + '/'];
  visited.add(origin + '/');

  while (queue.length > 0 && visited.size < maxUrls) {
    const url = queue.shift()!;
    const html = await fetchHtml(url);
    if (!html) continue;

    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href') || '';
        const abs = new URL(href, url).href.split('#')[0].split('?')[0];
        if (abs.startsWith(origin) && !visited.has(abs)) {
          visited.add(abs);
          if (visited.size < maxUrls) queue.push(abs);
        }
      } catch { /* ignore bad hrefs */ }
    });
  }

  return [...visited];
}

/* ─── per-page keyword extractor ─── */

function extractKeywords(html: string): { title: string; headings: string[]; keywords: string[] } {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().trim();
    if (t) headings.push(t);
  });

  // Keywords = unique heading texts (lowercased) that are reasonable length
  const keywords = Array.from(
    new Set(headings.map((h) => h.toLowerCase()).filter((h) => h.length > 3 && h.length < 80))
  );

  return { title, headings, keywords };
}

/* ─── main handler ─── */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, maxPages = 50 } = body as { domain: string; maxPages?: number };

    if (!domain) {
      return NextResponse.json({ error: 'Thiếu domain' }, { status: 400 });
    }

    const origin = normalizeOrigin(domain);
    if (!origin) {
      return NextResponse.json({ error: 'Domain không hợp lệ' }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(maxPages) || 50, 5), 200);

    // 1. Try sitemap first
    let urls = await getUrlsFromSitemap(origin, limit);
    const usedSitemap = urls.length > 0;

    // 2. Fallback to spider
    if (urls.length === 0) {
      urls = await spiderSite(origin, limit);
    }

    if (urls.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy trang nào trên website này' },
        { status: 422 }
      );
    }

    // 3. Crawl each page
    const allKeywords = new Map<string, number>(); // keyword → frequency
    let crawledCount = 0;
    let errorCount = 0;
    const pageResults: { url: string; title: string; kwCount: number }[] = [];

    for (const url of urls) {
      const html = await fetchHtml(url);
      if (!html) { errorCount++; continue; }

      const { title, keywords } = extractKeywords(html);
      crawledCount++;
      pageResults.push({ url, title, kwCount: keywords.length });

      for (const kw of keywords) {
        allKeywords.set(kw, (allKeywords.get(kw) || 0) + 1);
      }
    }

    // 4. Sort by frequency desc
    const keywordList = [...allKeywords.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ keyword, count }));

    return NextResponse.json({
      origin,
      usedSitemap,
      totalFound: urls.length,
      crawledCount,
      errorCount,
      keywordList,   // [{keyword, count}]
      pageResults,   // [{url, title, kwCount}]
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Lỗi server' },
      { status: 500 }
    );
  }
}
