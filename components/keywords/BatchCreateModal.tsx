'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap, BookOpen, List, Star, GitCompare, Loader2 } from 'lucide-react';
import { ArticleType, ArticleTone, AIModel, ImageAI } from '@/types';
import { cn } from '@/lib/utils';
import BrandKitSelector from '@/components/articles/BrandKitSelector';

interface Props {
  selectedIds: string[];
  onClose: () => void;
}

const articleTypes: { value: ArticleType; label: string; icon: React.ReactNode }[] = [
  { value: 'pillar', label: 'Pillar Page', icon: <BookOpen size={16} /> },
  { value: 'howto', label: 'How-to', icon: <Zap size={16} /> },
  { value: 'listicle', label: 'Listicle', icon: <List size={16} /> },
  { value: 'review', label: 'Review', icon: <Star size={16} /> },
  { value: 'comparison', label: 'So sánh', icon: <GitCompare size={16} /> },
];

const tones: { value: ArticleTone; label: string }[] = [
  { value: 'expert', label: 'Chuyên gia' },
  { value: 'friendly', label: 'Thân thiện' },
  { value: 'persuasive', label: 'Thuyết phục' },
  { value: 'neutral', label: 'Trung lập' },
];

const aiModels: { value: AIModel; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'gpt4o', label: 'GPT-4o' },
  { value: 'gemini', label: 'Gemini' },
];

const imageAIs: { value: ImageAI; label: string }[] = [
  { value: 'dalle3', label: 'DALL-E 3' },
  { value: 'gemini-imagen', label: 'Gemini Imagen' },
];

const lengthPresets = [1500, 2000, 3000, 5000];

export default function BatchCreateModal({ selectedIds, onClose }: Props) {
  const router = useRouter();
  const [articleType, setArticleType] = useState<ArticleType>('listicle');
  const [tone, setTone] = useState<ArticleTone>('friendly');
  const [h2Count, setH2Count] = useState(5);
  const [targetLength, setTargetLength] = useState(2000);
  const [hasFaq, setHasFaq] = useState(false);
  const [hasCta, setHasCta] = useState(true);
  const [aiModel, setAiModel] = useState<AIModel>('claude');
  const [imageAI, setImageAI] = useState<ImageAI>('dalle3');
  const [brandKitId, setBrandKitId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/articles/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword_ids: selectedIds,
          config: {
            article_type: articleType,
            tone,
            h2_count: h2Count,
            target_length: targetLength,
            has_faq: hasFaq,
            has_cta: hasCta,
            ai_model: aiModel,
            image_ai: imageAI,
            brand_kit_id: brandKitId,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onClose();
      router.push('/library');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const ToggleBtn = ({ label, value, set }: { label: string; value: boolean; set: (v: boolean) => void }) => (
    <button
      onClick={() => set(!value)}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm transition-all',
        value ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-gray-700 text-gray-500 hover:border-gray-600'
      )}
    >
      {label}
      <div className={cn(
        'w-8 h-4 rounded-full border-2 flex items-center transition-all',
        value ? 'border-blue-500 bg-blue-600 justify-end' : 'border-gray-600 bg-gray-800 justify-start'
      )}>
        <div className="w-2.5 h-2.5 rounded-full bg-white m-0.5" />
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-950">
          <div>
            <h2 className="text-lg font-bold text-white">Tạo bài hàng loạt</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {selectedIds.length} từ khóa đã chọn — AI sẽ tự động tạo toàn bộ
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-300 rounded-lg hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Article Type */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-3">Loại bài viết</label>
            <div className="grid grid-cols-5 gap-2">
              {articleTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setArticleType(t.value)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-center transition-all',
                    articleType === t.value ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600 bg-gray-900'
                  )}
                >
                  <div className={cn('flex justify-center mb-2', articleType === t.value ? 'text-blue-400' : 'text-gray-500')}>
                    {t.icon}
                  </div>
                  <p className={cn('text-xs font-medium', articleType === t.value ? 'text-blue-300' : 'text-gray-400')}>
                    {t.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-3">Phong cách viết</label>
            <div className="flex gap-2 flex-wrap">
              {tones.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={cn(
                    'px-4 py-2 rounded-xl border-2 text-sm transition-all',
                    tone === t.value ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* H2 + Length */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">
                Số H2: <span className="text-blue-400 font-bold ml-1">{h2Count}</span>
              </label>
              <input
                type="range" min={3} max={10} value={h2Count}
                onChange={(e) => setH2Count(parseInt(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Số ký tự</label>
              <div className="flex gap-1.5 mb-2">
                {lengthPresets.map((len) => (
                  <button
                    key={len}
                    onClick={() => setTargetLength(len)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-lg border transition-colors',
                      targetLength === len ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-gray-700 text-gray-500'
                    )}
                  >
                    {len >= 1000 ? `${len / 1000}k` : len}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-3">
            <ToggleBtn label="Có FAQ" value={hasFaq} set={setHasFaq} />
            <ToggleBtn label="Có CTA" value={hasCta} set={setHasCta} />
          </div>

          {/* AI Models */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">AI viết bài</label>
              <div className="flex gap-2">
                {aiModels.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setAiModel(m.value)}
                    className={cn(
                      'flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                      aiModel === m.value ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">AI tạo ảnh</label>
              <div className="flex gap-2">
                {imageAIs.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setImageAI(m.value)}
                    className={cn(
                      'flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all',
                      imageAI === m.value ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Brand Kit */}
          <BrandKitSelector value={brandKitId} onChange={setBrandKitId} />

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'Đang khởi tạo...' : `Bắt đầu tạo ${selectedIds.length} bài →`}
          </button>
        </div>
      </div>
    </div>
  );
}
