'use client';

import { useState } from 'react';
import {
  Globe2, Loader2, AlertCircle, Plus, CheckCircle2,
  FileText, Link2, Zap,
} from 'lucide-react';

interface KeywordEntry { keyword: string; count: number; }
interface PageEntry { url: string; title: string; kwCount: number; }

interface CrawlResult {
  origin: string;
  usedSitemap: boolean;
  totalFound: number;
  crawledCount: number;
  errorCount: number;
  keywordList: KeywordEntry[];
  pageResults: PageEntry[];
}

interface Props { onImported: () => void; }

const PAGE_LIMITS = [20, 50, 100, 200];

export default function WebsiteCrawl({ onImported }: Props) {
  const [domain, setDomain] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [showPages, setShowPages] = useState(false);
  const [filterText, setFilterText] = useState('');

  const handleCrawl = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSelected(new Set());
    setAddMsg('');
    try {
      const res = await fetch('/api/keywords/crawl-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim(), maxPages }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Crawl thất bại');
      setResult(json);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (kw: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(kw)) { s.delete(kw); } else { s.add(kw); }
      return s;
    });
  };

  const selectAll = () => {
    if (!result) return;
    setSelected(new Set(filtered.map((k) => k.keyword)));
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch('/api/keywords/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: Array.from(selected).map((k) => ({ keyword: k })),
          source: 'website_crawl',
        }),
      });
      const json = await res.json();
      setAddMsg(`Đã thêm ${json.inserted} · Bỏ qua ${json.skipped} trùng`);
      setSelected(new Set());
      onImported();
    } catch {
      setAddMsg('Lỗi khi thêm từ khóa');
    }
  };

  const filtered = result
    ? result.keywordList.filter((k) =>
        !filterText || k.keyword.includes(filterText.toLowerCase())
      )
    : [];

  const maxCount = filtered[0]?.count || 1;

  return (
    <div className="space-y-5">
      {/* Input */}
      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Crawl toàn bộ website</h3>
        <p className="text-xs text-gray-500 mb-4">
          Nhập domain đối thủ. Tool sẽ đọc sitemap.xml (hoặc spider link nội bộ) rồi crawl tất cả trang và tổng hợp từ khóa.
        </p>

        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCrawl()}
              placeholder="https://example.com hoặc example.com"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Tối đa trang</label>
            <select
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {PAGE_LIMITS.map((n) => (
                <option key={n} value={n}>{n} trang</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCrawl}
            disabled={loading || !domain.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Globe2 size={15} />}
            {loading ? 'Đang crawl...' : 'Crawl website'}
          </button>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-violet-400 animate-pulse">
            <Zap size={13} />
            Đang đọc sitemap và crawl các trang... quá trình này có thể mất 1–3 phút tuỳ website.
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950 rounded-xl px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Link2 size={14} />, label: 'Trang tìm thấy', value: result.totalFound, color: 'text-blue-400' },
              { icon: <CheckCircle2 size={14} />, label: 'Đã crawl', value: result.crawledCount, color: 'text-emerald-400' },
              { icon: <FileText size={14} />, label: 'Từ khóa', value: result.keywordList.length, color: 'text-violet-400' },
              { icon: <Zap size={14} />, label: 'Nguồn', value: result.usedSitemap ? 'Sitemap' : 'Spider', color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-900 rounded-xl p-3">
                <div className={`flex items-center gap-1.5 mb-1 ${s.color}`}>
                  {s.icon}
                  <span className="text-xs text-gray-500">{s.label}</span>
                </div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Keyword list */}
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs font-semibold text-gray-300">
                Từ khóa theo tần suất ({filtered.length})
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Lọc từ khóa..."
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-40"
                />
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Chọn tất cả
                </button>
              </div>
            </div>

            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {filtered.map(({ keyword, count }) => {
                const isSel = selected.has(keyword);
                const barWidth = Math.round((count / maxCount) * 100);
                return (
                  <button
                    key={keyword}
                    onClick={() => toggleSelect(keyword)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
                      isSel
                        ? 'bg-violet-600/20 border-violet-500'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                    }`}
                  >
                    {/* frequency bar */}
                    <div className="relative w-16 h-1.5 bg-gray-700 rounded-full shrink-0">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all ${isSel ? 'bg-violet-400' : 'bg-blue-500'}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className={`text-xs flex-1 ${isSel ? 'text-violet-200' : 'text-gray-300'}`}>
                      {keyword}
                    </span>
                    <span className="text-xs text-gray-600 shrink-0">{count}x</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-6">Không tìm thấy từ khóa nào</p>
              )}
            </div>
          </div>

          {/* Pages list toggle */}
          <button
            onClick={() => setShowPages((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showPages ? '▲ Ẩn' : '▼ Xem'} danh sách {result.pageResults.length} trang đã crawl
          </button>

          {showPages && (
            <div className="bg-gray-900 rounded-xl p-4 max-h-60 overflow-y-auto space-y-1">
              {result.pageResults.map((p) => (
                <div key={p.url} className="flex items-start gap-2 py-1">
                  <span className="text-xs text-gray-600 shrink-0">{p.kwCount}kw</span>
                  <div>
                    <p className="text-xs text-gray-400 truncate">{p.title || '(no title)'}</p>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-600 hover:text-blue-400 truncate block"
                    >
                      {p.url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {selected.size > 0 && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} />
              Thêm {selected.size} từ khóa đã chọn
            </button>
          )}
          {addMsg && <p className="text-xs text-emerald-400">{addMsg}</p>}
        </div>
      )}
    </div>
  );
}
