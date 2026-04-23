'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Filter, Plus, Trash2, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Keyword } from '@/types';
import { formatDate } from '@/lib/utils';

interface Props {
  onBatchCreate?: (ids: string[]) => void;
}

export default function KeywordsTable({ onBatchCreate }: Props) {
  const router = useRouter();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadKeywords();
  }, []);

  async function loadKeywords() {
    setLoading(true);
    const { data } = await supabase
      .from('keywords')
      .select('*')
      .order('created_at', { ascending: false });
    setKeywords((data as Keyword[]) || []);
    setLoading(false);
  }

  const filtered = keywords.filter((k) => {
    if (sourceFilter && k.source !== sourceFilter) return false;
    if (statusFilter && k.status !== statusFilter) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((k) => k.id)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa từ khóa này?')) return;
    await supabase.from('keywords').delete().eq('id', id);
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  };

  const handleCreateArticle = (kw: Keyword) => {
    router.push(`/articles/new?keyword=${encodeURIComponent(kw.keyword)}&keyword_id=${kw.id}`);
  };

  const handleBulkCreate = () => {
    if (onBatchCreate) {
      onBatchCreate(Array.from(selected));
    } else {
      // Fallback: old single-article flow
      const selectedKws = keywords.filter((k) => selected.has(k.id));
      if (selectedKws.length === 1) {
        router.push(`/articles/new?keyword=${encodeURIComponent(selectedKws[0].keyword)}&keyword_id=${selectedKws[0].id}`);
      }
    }
  };

  const sourceBadge = (s: string) => {
    const map: Record<string, string> = {
      manual: 'bg-gray-800 text-gray-400',
      competitor: 'bg-violet-950 text-violet-300',
      serp: 'bg-blue-950 text-blue-300',
    };
    const labels: Record<string, string> = {
      manual: 'Thủ công',
      competitor: 'Đối thủ',
      serp: 'SERP',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${map[s] || 'bg-gray-800 text-gray-400'}`}>
        {labels[s] || s}
      </span>
    );
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: 'bg-gray-800 text-gray-400',
      queued: 'bg-amber-950 text-amber-300',
      done: 'bg-emerald-950 text-emerald-300',
    };
    const labels: Record<string, string> = { pending: 'Chờ xử lý', queued: 'Đang xử lý', done: 'Hoàn thành' };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${map[s] || 'bg-gray-800 text-gray-400'}`}>
        {labels[s] || s}
      </span>
    );
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 flex-wrap">
        <h2 className="font-semibold text-white text-sm flex-1">
          Danh sách từ khóa {filtered.length > 0 && <span className="text-gray-500">({filtered.length})</span>}
        </h2>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none"
          >
            <option value="">Tất cả nguồn</option>
            <option value="manual">Thủ công</option>
            <option value="competitor">Đối thủ</option>
            <option value="serp">SERP</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="queued">Đang xử lý</option>
            <option value="done">Hoàn thành</option>
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus size={13} /> Tạo bài hàng loạt ({selected.size})
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5"
            >
              Bỏ chọn
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <AlertCircle size={36} className="mb-2" />
          <p className="text-sm">Chưa có từ khóa nào</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                  className="accent-blue-600"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium">Từ khóa</th>
              <th className="text-left px-4 py-3 font-medium">Nguồn</th>
              <th className="text-left px-4 py-3 font-medium">Volume</th>
              <th className="text-left px-4 py-3 font-medium">Difficulty</th>
              <th className="text-left px-4 py-3 font-medium">Trạng thái</th>
              <th className="text-left px-4 py-3 font-medium">Ngày tạo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((kw) => (
              <tr
                key={kw.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(kw.id)}
                    onChange={() => toggleSelect(kw.id)}
                    className="accent-blue-600"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-200">{kw.keyword}</span>
                </td>
                <td className="px-4 py-3">{sourceBadge(kw.source)}</td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400">{kw.volume?.toLocaleString('vi-VN') ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  {kw.difficulty != null ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            kw.difficulty >= 70 ? 'bg-red-500' :
                            kw.difficulty >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${kw.difficulty}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{kw.difficulty}</span>
                    </div>
                  ) : <span className="text-sm text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3">{statusBadge(kw.status)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">{formatDate(kw.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => handleCreateArticle(kw)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs rounded-lg border border-blue-500/30 transition-colors"
                    >
                      <ExternalLink size={11} /> Tạo bài
                    </button>
                    <button
                      onClick={() => handleDelete(kw.id)}
                      className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg hover:bg-red-950 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
