'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Article, ImageAI } from '@/types';
import {
  Loader2, RefreshCw, Upload, CheckCircle2, AlertCircle,
  Image as ImageIcon, Wand2, X, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  article: Article;
  onConfirmed: (article: Article) => void;
}

const IMAGE_SIZES = [
  { value: '1024x1024', label: 'Vuông', sub: '1:1 · Blog / Social', icon: '■', aspect: 'aspect-square' },
  { value: '1792x1024', label: 'Ngang', sub: '16:9 · Banner / Thumbnail', icon: '▬', aspect: 'aspect-video' },
  { value: '1024x1792', label: 'Dọc', sub: '9:16 · Story / Poster', icon: '▮', aspect: 'aspect-[9/16]' },
];

const IMAGE_TYPES = [
  { value: 'illustration', label: 'Ảnh minh họa', hint: 'flat illustration style, vector art' },
  { value: 'poster', label: 'Poster', hint: 'creative poster design, bold typography' },
  { value: 'banner', label: 'Banner', hint: 'wide banner design, professional marketing' },
  { value: 'photo', label: 'Ảnh thực', hint: 'realistic photo, high quality photography, DSLR quality, photorealistic' },
  { value: 'infographic', label: 'Infographic', hint: 'infographic design, data visualization, clean layout' },
  { value: 'logo', label: 'Logo / Icon', hint: 'minimal logo design, icon, transparent background' },
];

// Convert File to base64 string (without data: prefix)
function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mime: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Step5Image({ article, onConfirmed }: Props) {
  const [imagePrompt, setImagePrompt] = useState(article.image_prompt || '');
  const [imageAI, setImageAI] = useState<ImageAI>('dalle3');
  const [imageSize, setImageSize] = useState('1792x1024');
  const [imageType, setImageType] = useState('illustration');
  const [imageUrl, setImageUrl] = useState(article.image_url || '');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const promptGenerated = useRef(false);

  // Reference image upload state
  const [referenceMode, setReferenceMode] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState('');

  const selectedType = IMAGE_TYPES.find((t) => t.value === imageType)!;
  const selectedSize = IMAGE_SIZES.find((s) => s.value === imageSize)!;

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
    const finalPrompt = imagePrompt.trim() + (selectedType.hint ? `. Style: ${selectedType.hint}` : '');
    try {
      const res = await fetch('/api/articles/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          image_prompt: finalPrompt,
          image_ai: imageAI,
          image_size: imageSize,
        }),
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

  const generateFromReference = async () => {
    if (!imagePrompt.trim()) { setError('Vui lòng nhập image prompt'); return; }
    if (!referenceFile) { setError('Vui lòng chọn ảnh tham chiếu'); return; }
    setGeneratingImage(true);
    setError('');
    const finalPrompt = imagePrompt.trim() + (selectedType.hint ? `. Style: ${selectedType.hint}` : '');
    try {
      const { base64, mime } = await fileToBase64(referenceFile);
      const res = await fetch('/api/articles/generate-image-from-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          image_prompt: finalPrompt,
          reference_image_base64: base64,
          reference_image_mime: mime,
          image_size: imageSize,
        }),
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

  // Drop for reference image (image-to-image)
  const onDropReference = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setReferenceFile(file);
    const url = URL.createObjectURL(file);
    setReferencePreview(url);
  }, []);

  const { getRootProps: getRefRootProps, getInputProps: getRefInputProps, isDragActive: isRefDragActive } = useDropzone({
    onDrop: onDropReference,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  // Drop for direct upload (use as-is)
  const onDropDirect = useCallback(async (acceptedFiles: File[]) => {
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
    onDrop: onDropDirect,
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

      {/* Image Prompt */}
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

      {/* Image Type */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-3">Loại ảnh</label>
        <div className="grid grid-cols-3 gap-2 mb-1">
          {IMAGE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setImageType(t.value)}
              className={cn(
                'px-3 py-2.5 rounded-xl border-2 text-left transition-all',
                imageType === t.value
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              )}
            >
              <p className={cn('text-xs font-semibold', imageType === t.value ? 'text-violet-300' : 'text-gray-300')}>{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Image Size */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-3">Kích thước ảnh</label>
        <div className="grid grid-cols-3 gap-3">
          {IMAGE_SIZES.map((s) => (
            <button
              key={s.value}
              onClick={() => setImageSize(s.value)}
              className={cn(
                'p-3 rounded-xl border-2 text-center transition-all',
                imageSize === s.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              )}
            >
              <p className="text-lg leading-none mb-1">{s.icon}</p>
              <p className={cn('text-sm font-semibold', imageSize === s.value ? 'text-blue-300' : 'text-gray-300')}>{s.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Choose AI */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-3">Chọn AI tạo ảnh</label>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { value: 'dalle3' as ImageAI, label: 'DALL-E 3', sub: 'OpenAI · Chất lượng cao', color: 'from-emerald-500 to-teal-500' },
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

        {/* Preview info */}
        <div className="mb-4 p-3 bg-gray-900/60 border border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 mb-1">Sẽ tạo ảnh với style:</p>
          <p className="text-xs text-gray-300 font-mono">{selectedType.label} · {selectedSize.label} ({imageSize})</p>
        </div>

        {/* Mode toggle: Generate from scratch vs Generate from reference */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setReferenceMode(false)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
              !referenceMode
                ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
            )}
          >
            <Wand2 size={14} />
            Tạo từ prompt
          </button>
          <button
            onClick={() => setReferenceMode(true)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
              referenceMode
                ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
            )}
          >
            <Upload size={14} />
            Gen theo ảnh tôi upload
          </button>
        </div>

        {/* Reference image upload zone */}
        {referenceMode && (
          <div className="mb-4 space-y-3">
            <p className="text-xs text-gray-400">
              Upload ảnh tham chiếu — AI sẽ tạo ảnh mới theo phong cách / nội dung ảnh bạn cung cấp
            </p>
            {referencePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-amber-500/40 bg-gray-900">
                <img
                  src={referencePreview}
                  alt="Reference"
                  className="w-full max-h-48 object-contain"
                />
                <button
                  onClick={() => { setReferenceFile(null); setReferencePreview(''); }}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 transition-colors"
                >
                  <X size={12} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-xs text-amber-300 font-medium">✓ Ảnh tham chiếu đã sẵn sàng</p>
                </div>
              </div>
            ) : (
              <div
                {...getRefRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                  isRefDragActive ? 'border-amber-500 bg-amber-500/10' : 'border-amber-700/50 hover:border-amber-600/60 bg-amber-900/10'
                )}
              >
                <input {...getRefInputProps()} />
                <Upload size={20} className="mx-auto mb-2 text-amber-600" />
                <p className="text-sm text-gray-400">
                  {isRefDragActive ? 'Thả ảnh vào đây...' : 'Kéo thả hoặc click để chọn ảnh tham chiếu'}
                </p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG, WEBP · tối đa 5MB</p>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={referenceMode ? generateFromReference : generateImage}
          disabled={generatingImage || !imagePrompt.trim() || (referenceMode && !referenceFile)}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors',
            referenceMode
              ? 'bg-amber-600 hover:bg-amber-500'
              : 'bg-violet-600 hover:bg-violet-500'
          )}
        >
          {generatingImage ? (
            <Loader2 size={15} className="animate-spin" />
          ) : referenceMode ? (
            <><Upload size={14} /><ArrowRight size={12} /><Wand2 size={14} /></>
          ) : (
            <ImageIcon size={15} />
          )}
          {generatingImage
            ? 'Đang tạo ảnh...'
            : referenceMode
            ? 'Gen ảnh từ ảnh tham chiếu'
            : `Tạo ảnh ${selectedType.label}`}
        </button>
      </div>

      {/* Direct upload alternative */}
      <div>
        <p className="text-sm text-gray-500 mb-2">— hoặc upload ảnh có sẵn (dùng luôn không qua AI) —</p>
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

      {/* Loading state */}
      {generatingImage && !imageUrl && (
        <div className="bg-gray-900 rounded-xl p-8 flex flex-col items-center justify-center border border-gray-700">
          <Loader2 size={32} className="animate-spin text-violet-400 mb-3" />
          <p className="text-sm text-gray-400">AI đang tạo ảnh...</p>
          <p className="text-xs text-gray-600 mt-1">Có thể mất 15-30 giây</p>
        </div>
      )}

      {/* Preview — hiển thị đúng tỷ lệ theo kích thước đã chọn */}
      {imageUrl && (
        <div>
          <p className="text-sm font-medium text-gray-300 mb-3">Xem trước ảnh</p>
          <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
            {/* Container có tỷ lệ khung đúng theo kích thước */}
            <div className={cn('relative w-full', selectedSize.aspect)}>
              <img
                src={imageUrl}
                alt="Generated featured image"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
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
