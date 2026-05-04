'use client';

import { useEffect, useState } from 'react';
import { Article, WPCategory, WPTag } from '@/types';
import { Loader2, ExternalLink, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  article: Article;
  onPublished: (article: Article) => void;
}

export default function Step6Publish({ article, onPublished }: Props) {
  const [publishStatus, setPublishStatus] = useState<'draft' | 'publish'>('draft');
  const [categories, setCategories] = useState<WPCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [tags, setTags] = useState<WPTag[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<WPTag[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState('');
  const [wpLink, setWpLink] = useState('');
  const [error, setError] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  // Already published — article.slug holds the full WP URL after publishing
  useEffect(() => {
    if (article.status === 'done' && article.wp_post_id && article.slug) {
      // slug được overwrite thành URL đầy đủ từ WP sau khi đăng
      setWpLink(article.slug);
    }
  }, [article]);

  async function loadCategories() {
    try {
      const res = await fetch('/api/wordpress/categories');
      if (res.ok) {
        const json = await res.json();
        setCategories(json.categories || []);
      }
    } catch {}
    setLoadingCategories(false);
  }

  async function searchTags(q: string) {
    setTagSearch(q);
    if (q.length < 2) { setTags([]); return; }
    try {
      const res = await fetch(`/api/wordpress/tags?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setTags(json.tags || []);
      }
    } catch {}
  }

  const addTag = (tag: WPTag) => {
    if (!selectedTags.find((t) => t.id === tag.id)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setTags([]);
    setTagSearch('');
  };

  const removeTag = (id: number) => {
    setSelectedTags((prev) => prev.filter((t) => t.id !== id));
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    setProgress('Đang kiểm tra kết nối WordPress...');

    try {
      setProgress('Đang upload ảnh lên WordPress...');
      const res = await fetch('/api/articles/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          status: publishStatus,
          category_id: selectedCategoryId,
          tags: selectedTags.map((t) => t.id),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.error === 'WP_AUTH_FAIL') {
          throw new Error('Xác thực WordPress thất bại. Kiểm tra lại Application Password trong Cài đặt.');
        }
        throw new Error(json.error || 'Đăng bài thất bại');
      }

      setProgress('');
      setWpLink(json.wp_post_url);
      onPublished(json.article);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const wordCount = article.content_html
    ? article.content_html.replace(/<[^>]*>/g, '').split(/\s+/).length
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Đăng lên WordPress</h2>
        <p className="text-gray-400 text-sm">Kiểm tra thông tin và chọn trạng thái đăng</p>
      </div>

      {/* Preview Summary */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Tóm tắt bài viết</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Tiêu đề</p>
            <p className="text-sm text-gray-200 font-medium">{article.meta_title || article.keyword}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">URL Slug</p>
            <p className="text-sm text-gray-300 font-mono">/{article.slug}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">AI Model</p>
            <p className="text-sm text-gray-300 uppercase">{article.ai_model}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Số từ</p>
            <p className="text-sm text-gray-300">{wordCount.toLocaleString('vi-VN')} từ</p>
          </div>
        </div>
        {article.image_url && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Featured Image</p>
            <img src={article.image_url} className="w-full h-32 object-cover rounded-xl" alt="Featured" />
          </div>
        )}
      </div>

      {/* Publish Status */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-3">Trạng thái đăng</label>
        <div className="flex gap-3">
          {[
            { value: 'draft' as const, label: '📝 Draft', desc: 'Lưu nháp, chưa hiển thị' },
            { value: 'publish' as const, label: '🌐 Published', desc: 'Công khai ngay' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPublishStatus(opt.value)}
              className={cn(
                'flex-1 p-4 rounded-xl border-2 text-left transition-all',
                publishStatus === opt.value
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              )}
            >
              <p className="font-semibold text-sm text-gray-200 mb-1">{opt.label}</p>
              <p className="text-xs text-gray-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* WordPress Category */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-2">Category WordPress</label>
        {loadingCategories ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 size={12} className="animate-spin" /> Đang tải categories...
          </div>
        ) : categories.length === 0 ? (
          <p className="text-xs text-gray-500">Không tìm thấy categories. Kiểm tra kết nối WordPress.</p>
        ) : (
          <select
            value={selectedCategoryId || ''}
            onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">— Không chọn category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="text-sm font-medium text-gray-300 block mb-2">Tags WordPress</label>
        <input
          value={tagSearch}
          onChange={(e) => searchTags(e.target.value)}
          placeholder="Tìm tag..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        />
        {tags.length > 0 && (
          <div className="mt-2 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => addTag(tag)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 border-b border-gray-800 last:border-0 transition-colors"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1.5 text-xs bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full"
              >
                {tag.name}
                <button onClick={() => removeTag(tag.id)} className="hover:text-white">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-xl p-4">
          <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {wpLink ? (
        <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <p className="font-semibold text-emerald-300">Đăng bài thành công!</p>
          </div>
          <a
            href={wpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ExternalLink size={14} />
            Xem bài trên WordPress →
          </a>
        </div>
      ) : (
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
        >
          {publishing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {progress || 'Đang đăng...'}
            </>
          ) : (
            <>
              <Send size={16} />
              Đăng lên WordPress
            </>
          )}
        </button>
      )}
    </div>
  );
}
