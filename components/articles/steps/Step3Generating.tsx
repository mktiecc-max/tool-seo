'use client';

import { useEffect, useState, useRef } from 'react';
import { Article } from '@/types';
import { Loader2, Zap, AlertCircle } from 'lucide-react';

interface Props {
  article: Article;
  onDone: (article: Article) => void;
}

export default function Step3Generating({ article, onDone }: Props) {
  const [progress, setProgress] = useState('Đang khởi tạo...');
  const [content, setContent] = useState('');
  const [percent, setPercent] = useState(5);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generateContent();
  }, []);

  const generateContent = async () => {
    setError('');
    setContent('');
    setPercent(10);
    setProgress('Đang gọi AI...');

    try {
      const res = await fetch('/api/articles/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Lỗi tạo nội dung');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let fullText = '';
      let chars = 0;
      const targetLen = article.target_length || 2000;

      setProgress('Đang viết bài...');

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        chars += chunk.length;
        setContent(fullText);

        // Fake progress based on char count vs target
        const pct = Math.min(90, 10 + (chars / targetLen) * 80);
        setPercent(Math.round(pct));

        // Update progress label based on content
        if (chars < 200) setProgress('Đang viết mở bài...');
        else if (pct < 40) setProgress('Đang viết các H2...');
        else if (pct < 70) setProgress('Đang viết phần thân bài...');
        else setProgress('Đang hoàn thiện bài...');
      }

      setPercent(100);
      setProgress('Hoàn thành!');
      setDone(true);

      // Fetch updated article from DB
      const artRes = await fetch(`/api/articles/${article.id}`);
      if (artRes.ok) {
        const updated = await artRes.json();
        setTimeout(() => onDone(updated.article), 1000);
      } else {
        setTimeout(() => onDone({ ...article, content_html: fullText, status: 'content_review' }), 1000);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Đang tạo nội dung</h2>
        <p className="text-gray-400 text-sm">AI đang viết bài theo outline đã xác nhận</p>
      </div>

      {/* Progress */}
      <div className="bg-gray-900 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          {done ? (
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/50 rounded-xl flex items-center justify-center">
              <Loader2 size={18} className="text-blue-400 animate-spin" />
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-sm">{progress}</p>
            <p className="text-xs text-gray-500">Từ khóa: {article.keyword}</p>
          </div>
          <span className="ml-auto text-2xl font-bold text-blue-400">{percent}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-violet-600 rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Live preview */}
        {content && (
          <div className="mt-5 max-h-64 overflow-y-auto bg-gray-950 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">Nội dung đang được tạo...</p>
            <div
              className="text-xs text-gray-400 leading-relaxed font-mono"
              dangerouslySetInnerHTML={{ __html: content.slice(0, 2000) + (content.length > 2000 ? '...' : '') }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-xl p-4">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-300 font-medium mb-1">Lỗi tạo nội dung</p>
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => { started.current = false; generateContent(); }}
              className="mt-3 text-xs text-red-300 hover:text-red-200 underline"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
