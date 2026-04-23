'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Article, ImageAI } from '@/types';
import { Loader2, RefreshCw, Upload, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  article: Article;
  onConfirmed: (article: Article) => void;
}

export default function Step5Image({ article, onConfirmed }: Props) {
  const [imagePrompt, setImagePrompt] = useState(article.image_prompt || '');
  const [imageAI, setImageAI] = useState<ImageAI>('dalle3');
  const [imageUrl, setImageUrl] = useState(article.image_url || '');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const promptGenerated = useRef(false);

  // Auto-generate prompt on mount
  useEffect(() => {
    if (!article.image_prompt && !promptGenerated.current) {
      promptGenerated.current = true;
      generatePrompt();
    }
  }, []);

  const generatePrompt = async () => {
    setGeneratingPrompt(true);
    setError('');
    try {
      const res = await fetch('/api/articles/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setImagePrompt(json.image_prompt);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) { setError('Vui lòng nhập image prompt'); return; }
    setGeneratingImage(true);
    setError('');
    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id, image_prompt: imagePrompt, image_ai: imageAI }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setImageUrl(json.image_url);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setGeneratingImage(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setGeneratingImage(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('article_id', article.id);
      fd.append('file', file);
      const res = await fetch('/api/articles/upload-image', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setImageUrl(json.image_url);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setGeneratingImage(false);
    }
  }, [article.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const handleConfirm = async () => {
    if (!imageUrl) { setError('Vui lòng tạo hoặc upload ảnh trước'); return; }
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/articles/confirm-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id, image_url: imageUrl }),
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Tạo ảnh featured</h2>
        <p className="text-gray-400 text-sm">AI tự động sinh image prompt từ nội dung bài</p>
      </div>

      {/* 5A + 5B: Image Prompt */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Image Prompt (tiếng Anh)</label>
          <button
            onClick={generatePrompt}
            disabled={generatingPrompt}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {generatingPrompt ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Sinh lại prompt
          </button>
        </div>
        {generatingPrompt ? (
          <div className="bg-gray-900 rounded-xl p-6 flex items-center gap-3 border border-gray-700">
            <Loader2 size={18} className="animate-spin text-blue-400" />
            <span className="text-sm text-gray-400">AI đang tạo image prompt...</span>
          </div>
        ) : (
          <textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder="AI sẽ tự động sinh prompt tại đây..."
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none h-28 font-mono"
          />
        )}
      </div>

      {/* 5C: Choose AI */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-3">Chọn AI tạo ảnh</label>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { value: 'dalle3' as ImageAI, label: 'DALL-E 3', sub: 'OpenAI · 1792×1024', color: 'from-emerald-500 to-teal-500' },
            { value: 'gemini-imagen' as ImageAI, label: 'Gemini Imagen', sub: 'Google · High quality', color: 'from-blue-500 to-indigo-500' },
          ].map((ai) => (
            <button
              key={ai.value}
              onClick={() => setImageAI(ai.value)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                imageAI === ai.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              )}
            >
              <div className={`w-8 h-8 bg-gradient-to-br ${ai.color} rounded-lg mb-2 flex items-center justify-center`}>
                <ImageIcon size={14} className="text-white" />
              </div>
              <p className="font-semibold text-sm text-gray-200">{ai.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{ai.sub}</p>
            </button>
          ))}
        </div>

        <button
          onClick={generateImage}
          disabled={generatingImage || !imagePrompt.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {generatingImage ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />}
          {generatingImage ? 'Đang tạo ảnh...' : 'Tạo ảnh'}
        </button>
      </div>

      {/* Upload alternative */}
      <div>
        <p className="text-sm text-gray-500 mb-2">— hoặc upload ảnh có sẵn —</p>
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'
          )}
        >
          <input {...getInputProps()} />
          <Upload size={20} className="mx-auto mb-2 text-gray-500" />
          <p className="text-sm text-gray-400">
            {isDragActive ? 'Thả ảnh vào đây...' : 'Kéo thả hoặc click chọn ảnh'}
          </p>
          <p className="text-xs text-gray-600 mt-1">PNG, JPG, WEBP · tối đa 5MB</p>
        </div>
      </div>

      {/* 5D: Preview */}
      {(generatingImage && !imageUrl) && (
        <div className="bg-gray-900 rounded-xl p-8 flex flex-col items-center justify-center border border-gray-700">
          <Loader2 size={32} className="animate-spin text-violet-400 mb-3" />
          <p className="text-sm text-gray-400">AI đang tạo ảnh...</p>
        </div>
      )}

      {imageUrl && (
        <div>
          <p className="text-sm font-medium text-gray-300 mb-3">Xem trước ảnh</p>
          <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
            <img
              src={imageUrl}
              alt="Generated featured image"
              className="w-full max-h-64 object-cover"
            />
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-full font-medium">
                ✓ Ảnh đã sẵn sàng
              </span>
            </div>
          </div>
          <button
            onClick={() => setImageUrl('')}
            className="mt-2 text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Tạo lại ảnh khác
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-xl p-4">
          <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={confirming || !imageUrl}
        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
      >
        {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {confirming ? 'Đang xác nhận...' : 'Dùng ảnh này →'}
      </button>
    </div>
  );
}
