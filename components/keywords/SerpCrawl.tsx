'use client';

import { useState } from 'react';
import { Globe, Loader2, AlertCircle, Plus } from 'lucide-react';
import { SerpResult } from '@/types';

interface Props { onImported: () => void; }

const LANGS = ['vi', 'en', 'th', 'id', 'ms'];
const COUNTRIES = ['vn', 'us', 'th', 'id', 'my', 'sg'];

export default function SerpCrawl({ onImported }: Props) {
  const [kwText, setKwText] = useState('');
  const [lang, setLang] = useState('vi');
  const [country, setCountry] = useState('vn');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SerpResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [addMsg, setAddMsg] = useState('');

  const handleSearch = async () => {
    const keywords = kwText.split('\n').map((k) => k.trim()).filter(Boolean).slice(0, 5);
    if (keywords.length === 0) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch('/api/keywords/crawl-serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, lang, country }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'SERP crawl thất bại');
      setResults(json.results);
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

  const handleAdd = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch('/api/keywords/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: Array.from(selected).map((k) => ({ keyword: k })),
          source: 'serp',
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

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Crawl Google SERP</h3>
        <p className="text-xs text-gray-500 mb-4">Nhập tối đa 5 từ khóa seed. Lấy top 10 URL, PAA, related searches.</p>

        <textarea
          value={kwText}
          onChange={(e) => setKwText(e.target.value)}
          placeholder={'SEO là gì\ncách tối ưu onpage SEO'}
          className="w-full h-24 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
        />

        <div className="flex items-center gap-3 mt-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ngôn ngữ</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quốc gia</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !kwText.trim()}
            className="self-end flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
            {loading ? 'Đang tìm...' : 'Tìm kiếm'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950 rounded-xl px-4 py-3">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {results.map((r) => (
        <div key={r.keyword} className="bg-gray-900 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-blue-400 text-sm">"{r.keyword}"</h4>

          {/* PAA */}
          {r.people_also_ask.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">People Also Ask ({r.people_also_ask.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {r.people_also_ask.map((q) => (
                  <button
                    key={q}
                    onClick={() => toggleSelect(q)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors text-left ${
                      selected.has(q)
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Related */}
          {r.related_searches.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">Related Searches ({r.related_searches.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {r.related_searches.map((q) => (
                  <button
                    key={q}
                    onClick={() => toggleSelect(q)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      selected.has(q)
                        ? 'bg-violet-600/30 border-violet-500 text-violet-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top URLs */}
          {r.organic_results.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">Top {r.organic_results.length} URLs</p>
              <div className="space-y-1">
                {r.organic_results.map((org) => (
                  <p key={org.position} className="text-xs text-gray-500">
                    <span className="text-gray-600 mr-1">#{org.position}</span>
                    <a href={org.link} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:underline truncate">{org.title}</a>
                  </p>
                ))}
              </div>
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
          Thêm {selected.size} từ khóa
        </button>
      )}
      {addMsg && <p className="text-xs text-emerald-400">{addMsg}</p>}
    </div>
  );
}
