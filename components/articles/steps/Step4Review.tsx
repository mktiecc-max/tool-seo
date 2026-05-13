'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Article } from '@/types';
import {
  Loader2, CheckCircle2, RotateCcw, Bold, Italic, List, Heading,
  Link2, Plus, Trash2, Zap, AlertCircle, MousePointer2, Search,
} from 'lucide-react';
import { countKeywordDensity } from '@/lib/utils';

interface LinkPair {
  anchorText: string;
  url: string;
}

type LinkMode = 'selection' | 'auto';

interface Props {
  article: Article;
  onConfirmed: (article: Article) => void;
  onBack: () => void;
}

/** Inject links vào HTML — mỗi anchor text chỉ replace lần đầu tiên, bỏ qua nội dung đã có <a> */
function injectLinks(html: string, links: LinkPair[]): { html: string; count: number } {
  let result = html;
  let count = 0;

  for (const { anchorText, url } of links) {
    if (!anchorText.trim() || !url.trim()) continue;

    const parts = result.split(/(<a[\s\S]*?<\/a>)/gi);
    let replaced = false;
    const newParts = parts.map((part) => {
      if (replaced || /^<a/i.test(part)) return part;
      const escaped = anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const match = part.match(regex);
      if (!match) return part;
      replaced = true;
      count++;
      return part.replace(regex, `<a href="${url}" target="_blank" rel="nofollow noopener">${match[0]}</a>`);
    });
    result = newParts.join('');
  }

  return { html: result, count };
}

export default function Step4Review({ article, onConfirmed, onBack }: Props) {
  const [metaTitle, setMetaTitle] = useState(article.meta_title || '');
  const [metaDesc, setMetaDesc] = useState(article.meta_description || '');
  const [slug, setSlug] = useState(article.slug || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [density, setDensity] = useState(0);

  // Internal links state
  const [linkMode, setLinkMode] = useState<LinkMode>('selection');
  const [linkPairs, setLinkPairs] = useState<LinkPair[]>([{ anchorText: '', url: '' }]);
  const [linkResult, setLinkResult] = useState<{ count: number; error?: string } | null>(null);

  // Selection-mode state
  const [selectionUrl, setSelectionUrl] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const selectionUrlRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'nofollow noopener',
          target: '_blank',
          class: 'text-blue-400 underline',
        },
      }),
    ],
    content: article.content_html || '',
    editorProps: {
      attributes: { class: 'tiptap prose prose-invert max-w-none' },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      setDensity(countKeywordDensity(html, article.keyword));
    },
    onSelectionUpdate({ editor }) {
      const { from, to } = editor.state.selection;
      setHasSelection(from !== to);
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

  // Apply internal links vào editor (auto-find mode)
  const handleApplyLinks = () => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const { html: newHtml, count } = injectLinks(currentHtml, linkPairs);
    if (count === 0) {
      setLinkResult({ count: 0, error: 'Không tìm thấy anchor text nào khớp trong nội dung.' });
      return;
    }
    editor.commands.setContent(newHtml);
    setLinkResult({ count });
    setTimeout(() => setLinkResult(null), 4000);
  };

  // Insert link at current selection (selection mode)
  const handleInsertAtSelection = () => {
    if (!editor || !selectionUrl.trim()) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      setLinkResult({ count: 0, error: 'Chưa bôi đen văn bản nào. Hãy chọn text trong editor trước.' });
      return;
    }
    editor.chain().focus().setLink({ href: selectionUrl.trim() }).run();
    setSelectionUrl('');
    setLinkResult({ count: 1 });
    setTimeout(() => setLinkResult(null), 3000);
  };

  // Remove link at selection
  const handleRemoveLink = () => {
    editor?.chain().focus().unsetLink().run();
  };

  const addLinkPair = () => setLinkPairs((prev) => [...prev, { anchorText: '', url: '' }]);
  const removeLinkPair = (i: number) => setLinkPairs((prev) => prev.filter((_, idx) => idx !== i));
  const updateLinkPair = (i: number, field: keyof LinkPair, value: string) => {
    setLinkPairs((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
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
          <h2 className="text-xl font-bold text-white mb-1">Review &amp; Chỉnh sửa nội dung</h2>
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

        {/* Sidebar */}
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

          {/* Internal Links */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-blue-400" />
                <p className="text-xs font-semibold text-gray-300">Internal Links</p>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-3">
              <button
                onClick={() => setLinkMode('selection')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors ${
                  linkMode === 'selection'
                    ? 'bg-blue-600/30 text-blue-300 font-medium'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <MousePointer2 size={11} /> Bôi đen chọn
              </button>
              <button
                onClick={() => setLinkMode('auto')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs transition-colors ${
                  linkMode === 'auto'
                    ? 'bg-blue-600/30 text-blue-300 font-medium'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Search size={11} /> Tìm tự động
              </button>
            </div>

            {/* SELECTION MODE */}
            {linkMode === 'selection' && (
              <div className="space-y-2">
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border ${
                  hasSelection
                    ? 'bg-blue-900/20 border-blue-700/50 text-blue-300'
                    : 'bg-gray-800/50 border-gray-700 text-gray-500'
                }`}>
                  <MousePointer2 size={10} />
                  {hasSelection ? 'Đã chọn văn bản — nhập URL và bấm Apply' : 'Bôi đen văn bản trong editor...'}
                </div>
                <input
                  ref={selectionUrlRef}
                  value={selectionUrl}
                  onChange={(e) => setSelectionUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleInsertAtSelection(); }}
                  placeholder="https://example.com/..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                  type="url"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleInsertAtSelection}
                    disabled={!hasSelection || !selectionUrl.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-500/30 text-blue-300 text-xs rounded-lg transition-colors font-medium"
                  >
                    <Zap size={11} /> Apply vào vị trí chọn
                  </button>
                  {editor?.isActive('link') && (
                    <button
                      onClick={handleRemoveLink}
                      title="Xóa link tại vị trí con trỏ"
                      className="px-2.5 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-700/30 text-red-400 text-xs rounded-lg transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-gray-600">
                  1. Bôi đen đoạn text trong editor → 2. Nhập URL → 3. Apply
                </p>
              </div>
            )}

            {/* AUTO-FIND MODE */}
            {linkMode === 'auto' && (
              <div className="space-y-3">
                <button
                  onClick={addLinkPair}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus size={12} /> Thêm cặp link
                </button>
                {linkPairs.map((pair, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={pair.anchorText}
                        onChange={(e) => updateLinkPair(i, 'anchorText', e.target.value)}
                        placeholder="Anchor text..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                      {linkPairs.length > 1 && (
                        <button
                          onClick={() => removeLinkPair(i)}
                          className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    <input
                      value={pair.url}
                      onChange={(e) => updateLinkPair(i, 'url', e.target.value)}
                      placeholder="https://example.com/..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                      type="url"
                    />
                  </div>
                ))}
                <button
                  onClick={handleApplyLinks}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs rounded-lg transition-colors font-medium"
                >
                  <Zap size={12} /> Apply vào nội dung
                </button>
                <p className="text-[10px] text-gray-600">Tìm anchor text và tự động chèn link lần đầu xuất hiện.</p>
              </div>
            )}

            {/* Result feedback */}
            {linkResult && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${
                linkResult.error
                  ? 'bg-red-900/30 text-red-400 border border-red-800/50'
                  : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
              }`}>
                {linkResult.error
                  ? <><AlertCircle size={11} /> {linkResult.error}</>
                  : <><CheckCircle2 size={11} /> Đã thêm {linkResult.count} link thành công!</>
                }
              </div>
            )}

            <p className="text-xs text-gray-600 mt-2">
              Mỗi anchor text chỉ được link 1 lần (SEO best practice).
            </p>
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

