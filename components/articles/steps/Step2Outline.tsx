'use client';

import { useState } from 'react';
import { Article, OutlineJSON, OutlineSection } from '@/types';
import { Loader2, Plus, Trash2, RefreshCw, CheckCircle2, GripVertical } from 'lucide-react';

interface Props {
  article: Article;
  onConfirmed: (article: Article) => void;
}

export default function Step2Outline({ article, onConfirmed }: Props) {
  const [outline, setOutline] = useState<OutlineJSON>(
    article.outline || { h1: '', sections: [], faq: [] }
  );
  const [regenerating, setRegenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const regenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      const res = await fetch('/api/articles/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          keyword: article.keyword,
          article_type: article.article_type,
          h2_count: article.h2_count,
          target_length: article.target_length,
          tone: article.tone,
          has_faq: article.has_faq,
          has_cta: article.has_cta,
          ai_model: article.ai_model,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setOutline(json.article.outline);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  };

  const confirm = async () => {
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/articles/confirm-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id, outline }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onConfirmed(json.article);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  const updateH2 = (i: number, val: string) => {
    setOutline((o) => {
      const sections = [...o.sections];
      sections[i] = { ...sections[i], h2: val };
      return { ...o, sections };
    });
  };

  const addSection = () => {
    setOutline((o) => ({
      ...o,
      sections: [...o.sections, { h2: 'Tiêu đề mới', h3s: [], notes: '' }],
    }));
  };

  const removeSection = (i: number) => {
    setOutline((o) => ({
      ...o,
      sections: o.sections.filter((_, idx) => idx !== i),
    }));
  };

  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= outline.sections.length) return;
    setOutline((o) => {
      const sections = [...o.sections];
      [sections[i], sections[j]] = [sections[j], sections[i]];
      return { ...o, sections };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Review Outline</h2>
          <p className="text-gray-400 text-sm">Chỉnh sửa, thêm/xóa, sắp xếp H2 theo ý muốn</p>
        </div>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors"
        >
          {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Tạo lại outline
        </button>
      </div>

      {/* H1 */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">H1 (Tiêu đề bài)</label>
        <input
          value={outline.h1}
          onChange={(e) => setOutline((o) => ({ ...o, h1: e.target.value }))}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-100 font-semibold focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Sections */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 block">
          H2 Sections ({outline.sections.length})
        </label>
        <div className="space-y-2">
          {outline.sections.map((section, i) => (
            <div
              key={i}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveSection(i, -1)}
                    disabled={i === 0}
                    className="text-gray-600 hover:text-gray-400 disabled:opacity-20 leading-none"
                  >
                    ▴
                  </button>
                  <button
                    onClick={() => moveSection(i, 1)}
                    disabled={i === outline.sections.length - 1}
                    className="text-gray-600 hover:text-gray-400 disabled:opacity-20 leading-none"
                  >
                    ▾
                  </button>
                </div>
                <GripVertical size={14} className="text-gray-700 shrink-0" />
                <span className="text-xs font-bold text-blue-500 shrink-0 w-8">H2</span>
                <input
                  value={section.h2}
                  onChange={(e) => updateH2(i, e.target.value)}
                  className="flex-1 bg-transparent text-gray-200 text-sm focus:outline-none placeholder-gray-600"
                />
                <button
                  onClick={() => removeSection(i)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* H3s */}
              {section.h3s.length > 0 && (
                <div className="border-t border-gray-800 px-10 py-2 space-y-1">
                  {section.h3s.map((h3, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-violet-500 w-6">H3</span>
                      <p className="text-xs text-gray-400">{h3}</p>
                    </div>
                  ))}
                </div>
              )}

              {section.notes && (
                <div className="border-t border-gray-800 px-10 py-2">
                  <p className="text-xs text-gray-600 italic">{section.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addSection}
          className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 border border-dashed border-blue-500/40 hover:border-blue-500/60 rounded-xl transition-colors w-full justify-center"
        >
          <Plus size={14} /> Thêm H2
        </button>
      </div>

      {/* FAQ */}
      {outline.faq && outline.faq.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
            FAQ ({outline.faq.length} câu hỏi)
          </label>
          <div className="space-y-1">
            {outline.faq.map((q, i) => (
              <p key={i} className="text-sm text-gray-400 bg-gray-900 rounded-lg px-3 py-2">
                {i + 1}. {q}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      {(outline.meta_title || outline.meta_description) && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs font-medium text-gray-500 mb-2">Meta SEO (tự động)</p>
          {outline.meta_title && (
            <p className="text-sm text-gray-300 mb-1"><strong>Title:</strong> {outline.meta_title}</p>
          )}
          {outline.meta_description && (
            <p className="text-sm text-gray-400"><strong>Desc:</strong> {outline.meta_description}</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={confirm}
          disabled={confirming}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
        >
          {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {confirming ? 'Đang xác nhận...' : 'Xác nhận outline →'}
        </button>
      </div>
    </div>
  );
}
