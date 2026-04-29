'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Article, ArticleType, ArticleTone, AIModel } from '@/types';
import { Loader2, ChevronRight, Zap, BookOpen, List, Star, GitCompare, HelpCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandKitSelector from '@/components/articles/BrandKitSelector';

interface Props {
  article: Article | null;
  initialKeyword?: string;
  initialKeywordId?: string;
  onCreated: (article: Article) => void;
}

const articleTypes: { value: ArticleType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'pillar', label: 'Pillar Page', icon: <BookOpen size={20} />, desc: 'Bài tổng quan, toàn diện' },
  { value: 'howto', label: 'How-to', icon: <Zap size={20} />, desc: 'Hướng dẫn từng bước' },
  { value: 'listicle', label: 'Listicle', icon: <List size={20} />, desc: 'Danh sách X điều/cách' },
  { value: 'review', label: 'Review', icon: <Star size={20} />, desc: 'Đánh giá sản phẩm/dịch vụ' },
  { value: 'comparison', label: 'So sánh', icon: <GitCompare size={20} />, desc: 'So sánh 2+ lựa chọn' },
];

const tones: { value: ArticleTone; label: string; desc: string }[] = [
  { value: 'expert', label: 'Chuyên gia / Học thuật', desc: 'Chuyên sâu, trích dẫn số liệu' },
  { value: 'friendly', label: 'Thân thiện / Gần gũi', desc: 'Đơn giản, dễ đọc' },
  { value: 'persuasive', label: 'Bán hàng / Thuyết phục', desc: 'Tập trung lợi ích, CTA mạnh' },
  { value: 'neutral', label: 'Trung lập / Thông tin', desc: 'Cung cấp thông tin khách quan' },
];

const aiModels: { value: AIModel; label: string; desc: string; color: string }[] = [
  { value: 'claude', label: 'Claude', desc: 'Phân tích sâu, lập luận tốt', color: 'from-amber-500 to-orange-500' },
  { value: 'gpt4o', label: 'GPT-4o', desc: 'Đa năng, tự nhiên', color: 'from-emerald-500 to-teal-500' },
  { value: 'gemini', label: 'Gemini', desc: 'Tốt cho Google ecosystem', color: 'from-blue-500 to-indigo-500' },
];

const lengthPresets = [1500, 2000, 3000, 5000];

export default function Step1Config({ article, initialKeyword, initialKeywordId, onCreated }: Props) {
  const router = useRouter();
  const [batchMode, setBatchMode] = useState(false);
  const [keyword, setKeyword] = useState(article?.keyword || initialKeyword || '');
  const [batchKeywords, setBatchKeywords] = useState('');
  const [articleType, setArticleType] = useState<ArticleType>(article?.article_type || 'listicle');
  const [tone, setTone] = useState<ArticleTone>(article?.tone || 'friendly');
  const [h2Count, setH2Count] = useState(article?.h2_count || 5);
  const [targetLength, setTargetLength] = useState(article?.target_length || 2000);
  const [hasFaq, setHasFaq] = useState(article?.has_faq ?? false);
  const [hasCta, setHasCta] = useState(article?.has_cta ?? true);
  const [aiModel, setAiModel] = useState<AIModel>(article?.ai_model || 'claude');
  const [brandKitId, setBrandKitId] = useState<string | undefined>(article?.brand_kit_id);
  const [loading, setLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const parsedBatchKeywords = batchKeywords
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 5);

  const buildPayload = (kw: string, kwId?: string) => ({
    keyword: kw,
    keyword_id: kwId,
    article_type: articleType,
    h2_count: h2Count,
    target_length: targetLength,
    tone,
    has_faq: hasFaq,
    has_cta: hasCta,
    ai_model: aiModel,
    brand_kit_id: brandKitId,
  });

  const handleSubmit = async () => {
    if (!keyword.trim()) { setError('Vui lòng nhập từ khóa'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/articles/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(keyword.trim(), initialKeywordId)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Tạo outline thất bại');
      onCreated(json.article);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async () => {
    if (parsedBatchKeywords.length === 0) { setError('Vui lòng nhập ít nhất 1 từ khóa'); return; }
    setLoading(true);
    setError('');
    setBatchProgress({ done: 0, total: parsedBatchKeywords.length });
    let done = 0;
    const errors: string[] = [];
    const articleIds: string[] = [];

    for (const kw of parsedBatchKeywords) {
      try {
        const res = await fetch('/api/articles/generate-outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(kw)),
        });
        const json = await res.json();
        if (!res.ok) {
          errors.push(`"${kw}": ${json.error || 'thất bại'}`);
        } else if (json.article_id) {
          articleIds.push(json.article_id);
        }
      } catch (e: unknown) {
        errors.push(`"${kw}": ${(e as Error).message}`);
      }
      done++;
      setBatchProgress({ done, total: parsedBatchKeywords.length });
    }
    setLoading(false);

    if (errors.length > 0 && articleIds.length === 0) {
      setError(`Tạo outline thất bại:\n${errors.join('\n')}`);
      return;
    }

    // Redirect to batch board with collected IDs
    if (articleIds.length > 0) {
      router.push(`/articles/batch?ids=${articleIds.join(',')}`);
    } else {
      setError('Không tạo được bài nào');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Cấu hình bài viết</h2>
          <p className="text-gray-400 text-sm">Thiết lập thông số để AI tạo outline phù hợp</p>
        </div>
        <div className="flex items-center bg-gray-800 rounded-xl p-1 border border-gray-700">
          <button
            onClick={() => setBatchMode(false)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              !batchMode ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300')}
          >
            <Zap size={12} /> 1 bài
          </button>
          <button
            onClick={() => setBatchMode(true)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              batchMode ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-300')}
          >
            <Layers size={12} /> Nhiều bài
          </button>
        </div>
      </div>

      {!batchMode ? (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Từ khóa chính *</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="ví dụ: SEO onpage là gì"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Danh sách từ khóa * <span className="text-gray-500">(mỗi dòng 1 từ, tối đa 5)</span>
            </label>
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
              parsedBatchKeywords.length >= 5 ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400')}>
              {parsedBatchKeywords.length}/5
            </span>
          </div>
          <textarea
            value={batchKeywords}
            onChange={(e) => setBatchKeywords(e.target.value)}
            placeholder={"SEO onpage là gì\nContent marketing là gì\nBacklink là gì\n..."}
            rows={6}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 text-sm font-mono resize-none"
          />
          {parsedBatchKeywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsedBatchKeywords.map((kw, i) => (
                <span key={i} className="text-xs bg-violet-900/50 border border-violet-700 text-violet-300 px-2 py-0.5 rounded-full">
                  {i + 1}. {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Article Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Loại bài viết</label>
        <div className="grid grid-cols-5 gap-3">
          {articleTypes.map((t) => (
            <button key={t.value} onClick={() => setArticleType(t.value)}
              className={cn('p-4 rounded-xl border-2 text-left transition-all',
                articleType === t.value ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-800/50')}>
              <div className={cn('mb-2', articleType === t.value ? 'text-blue-400' : 'text-gray-500')}>{t.icon}</div>
              <p className={cn('text-sm font-semibold mb-1', articleType === t.value ? 'text-white' : 'text-gray-300')}>{t.label}</p>
              <p className="text-xs text-gray-500">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Outline Structure */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Số H2: <span className="text-blue-400 text-lg font-bold ml-2">{h2Count}</span>
          </label>
          <input type="range" min={3} max={10} value={h2Count}
            onChange={(e) => setH2Count(parseInt(e.target.value))} className="w-full accent-blue-500" />
          <div className="flex justify-between text-xs text-gray-600 mt-1"><span>3</span><span>10</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Số ký tự mục tiêu</label>
          <input type="number" value={targetLength} onChange={(e) => setTargetLength(parseInt(e.target.value) || 2000)}
            min={500} step={100}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500 text-sm mb-2" />
          <div className="flex gap-2">
            {lengthPresets.map((len) => (
              <button key={len} onClick={() => setTargetLength(len)}
                className={cn('text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  targetLength === len ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500 hover:border-gray-600')}>
                {len >= 1000 ? `${len / 1000}k` : len}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-8">
        {[
          { label: 'Có section FAQ', value: hasFaq, set: setHasFaq, icon: <HelpCircle size={15} /> },
          { label: 'Có CTA cuối bài', value: hasCta, set: setHasCta, icon: <ChevronRight size={15} /> },
        ].map(({ label, value, set, icon }) => (
          <button key={label} onClick={() => set(!value)}
            className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 transition-all text-sm',
              value ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-gray-700 text-gray-500 hover:border-gray-600')}>
            {icon} {label}
            <div className={cn('w-8 h-4 rounded-full border-2 flex items-center transition-all ml-1',
              value ? 'border-blue-500 bg-blue-600 justify-end' : 'border-gray-600 bg-gray-800 justify-start')}>
              <div className="w-2.5 h-2.5 rounded-full bg-white m-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Tone */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Phong cách viết</label>
        <div className="grid grid-cols-4 gap-3">
          {tones.map((t) => (
            <button key={t.value} onClick={() => setTone(t.value)}
              className={cn('p-3.5 rounded-xl border-2 text-left transition-all',
                tone === t.value ? 'border-violet-500 bg-violet-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-800/50')}>
              <p className={cn('text-sm font-semibold mb-1', tone === t.value ? 'text-violet-300' : 'text-gray-300')}>{t.label}</p>
              <p className="text-xs text-gray-500">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AI Model */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Chọn AI viết bài</label>
        <div className="grid grid-cols-3 gap-3">
          {aiModels.map((m) => (
            <button key={m.value} onClick={() => setAiModel(m.value)}
              className={cn('p-4 rounded-xl border-2 text-left transition-all',
                aiModel === m.value ? 'border-blue-500 bg-gradient-to-br from-blue-500/10 to-transparent' : 'border-gray-700 hover:border-gray-600 bg-gray-800/50')}>
              <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3', m.color)}>
                <span className="text-white text-xs font-bold">{m.label[0]}</span>
              </div>
              <p className={cn('text-sm font-bold mb-1', aiModel === m.value ? 'text-white' : 'text-gray-300')}>{m.label}</p>
              <p className="text-xs text-gray-500">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Kit */}
      <BrandKitSelector value={brandKitId} onChange={setBrandKitId} />

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 whitespace-pre-line">
          {error}
        </div>
      )}

      {batchProgress && loading && (
        <div className="bg-violet-950/50 border border-violet-800 rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-violet-300">Đang tạo outline...</span>
            <span className="text-sm font-bold text-violet-300">{batchProgress.done}/{batchProgress.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div className="bg-violet-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {!batchMode ? (
        <button onClick={handleSubmit} disabled={loading || !keyword.trim()}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
          {loading ? 'Đang tạo outline...' : 'Tạo Outline →'}
        </button>
      ) : (
        <button onClick={handleBatchSubmit} disabled={loading || parsedBatchKeywords.length === 0}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/25">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
          {loading
            ? `Đang tạo ${batchProgress?.done ?? 0}/${parsedBatchKeywords.length} bài...`
            : `Tạo ${parsedBatchKeywords.length || ''} bài cùng lúc →`}
        </button>
      )}
    </div>
  );
}
