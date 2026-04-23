'use client';

import { useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronRight, AlertCircle, Plus } from 'lucide-react';
import { CompetitorCrawlResult } from '@/types';

interface Props { onImported: () => void; }

export default function CompetitorCrawl({ onImported }: Props) {
  const [urlText, setUrlText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompetitorCrawlResult[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingMsg, setAddingMsg] = useState('');
  const [error, setError] = useState('');

  const handleCrawl = async () => {
    const urls = urlText.split('\n').map((u) => u.trim()).filter(Boolean).slice(0, 10);
    if (urls.length === 0) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch('/api/keywords/crawl-competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResults(json.results);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (url: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(url)) { s.delete(url); } else { s.add(url); }
      return s;
    });
  };

  const toggleSelect = (kw: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(kw)) { s.delete(kw); } else { s.add(kw); }
      return s;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAddingMsg('');
    try {
      const res = await fetch('/api/keywords/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: Array.from(selected).map((k) => ({ keyword: k })),
          source: 'competitor',
        }),
      });
      const json = await res.json();
      setAddingMsg(`Đã thêm ${json.inserted} · Bỏ qua ${json.skipped} trùng`);
      setSelected(new Set());
      onImported();
    } catch {
      setAddingMsg('Lỗi khi thêm từ khóa');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Crawl URL đối thủ</h3>
        <p className="text-xs text-gray-500 mb-4">Nhập tối đa 10 URL (mỗi dòng 1 URL). Trích xuất heading + từ khóa.</p>
        <textarea
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          placeholder={'https://example.com/bai-viet-1\nhttps://example.com/bai-viet-2'}
          className="w-full h-28 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
        />
        <button
          onClick={handleCrawl}
          disabled={loading || !urlText.trim()}
          className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {loading ? 'Đang crawl...' : 'Crawl'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950 rounded-xl px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Results accordion */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.url} className="bg-gray-900 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleExpand(r.url)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800 transition-colors"
              >
                {expanded.has(r.url) ? (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400 shrink-0" />
                )}
                <span className="text-sm text-gray-300 truncate flex-1">{r.url}</span>
                {r.error ? (
                  <span className="text-xs text-red-400 shrink-0">Lỗi</span>
                ) : (
                  <span className="text-xs text-gray-500 shrink-0">
                    {r.keywords_extracted.length} từ khóa
                  </span>
                )}
              </button>

              {expanded.has(r.url) && !r.error && (
                <div className="px-4 pb-4 border-t border-gray-800">
                  {r.title && (
                    <p className="text-xs text-gray-500 mt-2 mb-3">
                      <strong className="text-gray-400">Title:</strong> {r.title}
                    </p>
                  )}
                  <p className="text-xs font-medium text-gray-400 mb-2">
                    Headings ({r.headings.length}):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
                    {r.headings.map((h, i) => (
                      <p
                        key={i}
                        className="text-xs text-gray-400"
                        style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                      >
                        <span className="text-gray-600 mr-1">H{h.level}</span> {h.text}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-gray-400 mb-2">
                    Từ khóa trích xuất:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.keywords_extracted.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => toggleSelect(kw)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          selected.has(kw)
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {expanded.has(r.url) && r.error && (
                <div className="px-4 pb-3 border-t border-gray-800">
                  <p className="text-xs text-red-400 mt-2">{r.error}</p>
                </div>
              )}
            </div>
          ))}

          {selected.size > 0 && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Plus size={15} />
              Thêm {selected.size} từ khóa đã chọn
            </button>
          )}
          {addingMsg && (
            <p className="text-xs text-emerald-400">{addingMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}
