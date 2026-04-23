'use client';

import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Article } from '@/types';
import { Loader2, CheckCircle2, RotateCcw, Bold, Italic, List, Heading } from 'lucide-react';
import { countKeywordDensity } from '@/lib/utils';

interface Props {
  article: Article;
  onConfirmed: (article: Article) => void;
  onBack: () => void;
}

export default function Step4Review({ article, onConfirmed, onBack }: Props) {
  const [metaTitle, setMetaTitle] = useState(article.meta_title || '');
  const [metaDesc, setMetaDesc] = useState(article.meta_description || '');
  const [slug, setSlug] = useState(article.slug || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [density, setDensity] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: article.content_html || '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-invert max-w-none',
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      setDensity(countKeywordDensity(html, article.keyword));
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (article.content_html) {
      setDensity(countKeywordDensity(article.content_html, article.keyword));
    }
  }, []);

  const handleConfirm = async () => {
    if (!editor) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/articles/save-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          content_html: editor.getHTML(),
          meta_title: metaTitle,
          meta_description: metaDesc,
          slug,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onConfirmed(json.article);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toolbarBtn = (label: string, icon: React.ReactNode, action: () => void, active = false) => (
    <button
      key={label}
      onMouseDown={(e) => { e.preventDefault(); action(); }}
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
      title={label}
    >
      {icon}
    </button>
  );

  const wordCount = editor?.getText().split(/\s+/).filter(Boolean).length || 0;
  const charCount = editor?.getText().length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Review & Chỉnh sửa nội dung</h2>
          <p className="text-gray-400 text-sm">Chỉnh sửa trực tiếp trước khi tiếp tục</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
        >
          <RotateCcw size={14} /> Tạo lại toàn bộ
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Editor */}
        <div className="col-span-2">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-t-xl border-b-gray-800">
            {editor && [
              toolbarBtn('Bold', <Bold size={14} />, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')),
              toolbarBtn('Italic', <Italic size={14} />, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')),
              toolbarBtn('H2', <Heading size={14} />, () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 })),
              toolbarBtn('H3', <span className="text-xs font-bold">H3</span>, () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 })),
              toolbarBtn('List', <List size={14} />, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')),
            ]}
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
              <span>{wordCount} từ</span>
              <span>{charCount.toLocaleString('vi-VN')} ký tự</span>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 border-t-0 rounded-b-xl max-h-[500px] overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Sidebar Meta */}
        <div className="space-y-4">
          {/* Keyword density */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-xs font-medium text-gray-400 mb-2">Mật độ từ khóa</p>
            <p className="text-sm text-gray-300 mb-2">"{article.keyword}"</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${density < 0.5 ? 'bg-amber-500' : density > 3 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(density * 20, 100)}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${density < 0.5 ? 'text-amber-400' : density > 3 ? 'text-red-400' : 'text-emerald-400'}`}>
                {density.toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Khuyến nghị: 1% – 2%</p>
          </div>

          {/* Meta Title */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Meta Title</label>
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="Tiêu đề SEO..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
            <p className={`text-xs mt-1 ${metaTitle.length > 60 ? 'text-red-400' : 'text-gray-600'}`}>
              {metaTitle.length}/60 ký tự
            </p>
          </div>

          {/* Meta Description */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Meta Description</label>
            <textarea
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Mô tả SEO (≤160 ký tự)..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none h-20"
            />
            <p className={`text-xs mt-1 ${metaDesc.length > 160 ? 'text-red-400' : 'text-gray-600'}`}>
              {metaDesc.length}/160 ký tự
            </p>
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">URL Slug</label>
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
              <span className="text-xs text-gray-600 px-3 border-r border-gray-700">/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-slug-bai-viet"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-200 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={saving}
        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {saving ? 'Đang lưu...' : 'Xác nhận nội dung →'}
      </button>
    </div>
  );
}
