'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { supabase } from '@/lib/supabase';
import { Article, ArticleStatus } from '@/types';
import {
  ArrowLeft, CheckCircle2, XCircle, Calendar, Loader2,
  Bold, Italic, List, Heading, Save, AlertCircle
} from 'lucide-react';
import { countKeywordDensity } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props { params: { id: string } }

interface SeoCheck {
  label: string;
  pass: boolean;
}

export default function LibraryReviewPage({ params }: Props) {
  const { id } = params;
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [slug, setSlug] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [density, setDensity] = useState(0);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadArticle();
  }, [id]);

  async function loadArticle() {
    const { data } = await supabase.from('articles').select('*').eq('id', id).single();
    if (data) {
      const art = data as Article;
      setArticle(art);
      setMetaTitle(art.meta_title || '');
      setMetaDesc(art.meta_description || '');
      setSlug(art.slug || '');
      if (art.content_html) setDensity(countKeywordDensity(art.content_html, art.keyword));
      // Mark as in_review
      if (art.status === 'ready_to_review') {
        await supabase.from('articles').update({ status: 'in_review' }).eq('id', id);
        setArticle((prev) => prev ? { ...prev, status: 'in_review' as ArticleStatus } : prev);
      }
    }
    setLoading(false);
  }

  const debouncedSave = useCallback((contentHtml: string, mt: string, md: string, sl: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_html: contentHtml, meta_title: mt, meta_description: md, slug: sl }),
      });
      setAutoSaving(false);
      setLastSaved(new Date());
      if (article) setDensity(countKeywordDensity(contentHtml, article.keyword));
    }, 2000);
  }, [id, article]);

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: article?.content_html || '',
    editorProps: { attributes: { class: 'tiptap prose prose-invert max-w-none' } },
    onUpdate({ editor }) {
      debouncedSave(editor.getHTML(), metaTitle, metaDesc, slug);
    },
    immediatelyRender: false,
  });

  // Sync content when article loads
  useEffect(() => {
    if (editor && article?.content_html && !editor.getText()) {
      editor.commands.setContent(article.content_html);
    }
  }, [editor, article]);

  // Auto-save when meta fields change
  const handleMetaChange = (field: 'metaTitle' | 'metaDesc' | 'slug', val: string) => {
    const mt = field === 'metaTitle' ? val : metaTitle;
    const md = field === 'metaDesc' ? val : metaDesc;
    const sl = field === 'slug' ? val : slug;
    if (field === 'metaTitle') setMetaTitle(val);
    if (field === 'metaDesc') setMetaDesc(val);
    if (field === 'slug') setSlug(val);
    if (editor) debouncedSave(editor.getHTML(), mt, md, sl);
  };

  const handleApprove = async () => {
    if (!article) return;
    setApproving(true);
    setError('');
    try {
      // Save latest content first
      if (editor) {
        await fetch(`/api/articles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_html: editor.getHTML(), meta_title: metaTitle, meta_description: metaDesc, slug }),
        });
      }
      // Publish as draft
      const res = await fetch('/api/articles/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: id, status: 'draft', category_id: null, tags: [] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push('/library');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'needs_revision' }),
      });
      router.push('/library');
    } finally {
      setRejecting(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) return;
    setScheduling(true);
    try {
      if (editor) {
        await fetch(`/api/articles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_html: editor.getHTML(), meta_title: metaTitle, meta_description: metaDesc, slug }),
        });
      }
      const res = await fetch(`/api/articles/${id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: new Date(scheduleDate).toISOString() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push('/library');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setScheduling(false);
      setShowSchedulePicker(false);
    }
  };

  // SEO Checklist
  const seoChecks: SeoCheck[] = article && editor ? [
    {
      label: 'Từ khóa trong H1',
      pass: editor.getHTML().match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]
        ?.toLowerCase().includes(article.keyword.toLowerCase()) ?? false,
    },
    { label: 'Mật độ từ khóa 0.5%–2%', pass: density >= 0.5 && density <= 2 },
    {
      label: `Số từ ≥ ${article.target_length / 5}`,
      pass: (article.word_count || 0) >= article.target_length / 5,
    },
    { label: 'Meta description ≤ 160 ký tự', pass: metaDesc.length <= 160 && metaDesc.length > 0 },
    { label: 'Có ảnh featured', pass: !!article.image_url },
    { label: 'Slug không có ký tự đặc biệt', pass: /^[a-z0-9-]+$/.test(slug) },
  ] : [];

  const passCount = seoChecks.filter((c) => c.pass).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-8 text-center text-gray-500">Không tìm thấy bài viết</div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button
          onClick={() => router.push('/library')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại Library
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{article.keyword}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {autoSaving ? (
                <span className="flex items-center gap-1 text-amber-500"><Loader2 size={10} className="animate-spin" /> Đang lưu...</span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-emerald-500"><Save size={10} /> Đã lưu {lastSaved.toLocaleTimeString('vi-VN')}</span>
              ) : (
                'Auto-save: 2s'
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            disabled={rejecting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm rounded-xl transition-colors"
          >
            {rejecting ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Reject
          </button>

          <div className="relative">
            <button
              onClick={() => setShowSchedulePicker(!showSchedulePicker)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-900/50 hover:bg-violet-900/70 border border-violet-700 text-violet-300 text-sm rounded-xl transition-colors"
            >
              <Calendar size={14} /> Lên lịch
            </button>
            {showSchedulePicker && (
              <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-xl p-4 z-50 shadow-xl w-72">
                <p className="text-sm text-gray-300 font-medium mb-3">Chọn ngày đăng</p>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-500 mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSchedule}
                    disabled={!scheduleDate || scheduling}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {scheduling ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                    Lên lịch
                  </button>
                  <button
                    onClick={() => setShowSchedulePicker(false)}
                    className="px-3 py-2 text-gray-400 hover:text-gray-200 text-sm"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-sm rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/25"
          >
            {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Approve & Đăng Draft
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-xl p-3 mb-4">
          <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Editor — 65% */}
        <div className="col-span-2">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-t-xl">
            {editor && [
              { label: 'Bold', icon: <Bold size={14} />, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
              { label: 'Italic', icon: <Italic size={14} />, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
              { label: 'H2', icon: <span className="text-xs font-bold">H2</span>, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
              { label: 'H3', icon: <span className="text-xs font-bold">H3</span>, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
              { label: 'List', icon: <List size={14} />, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
            ].map((btn) => (
              <button
                key={btn.label}
                onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  btn.active ? 'bg-blue-600/30 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                )}
              >
                {btn.icon}
              </button>
            ))}
            <div className="ml-auto text-xs text-gray-500">
              {article.word_count?.toLocaleString('vi-VN')} từ
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-700 border-t-0 rounded-b-xl min-h-[calc(100vh-280px)] max-h-[calc(100vh-280px)] overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Sidebar — 35% */}
        <div className="space-y-4">
          {/* SEO Meta */}
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">SEO Metadata</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Meta Title</label>
                <input
                  value={metaTitle}
                  onChange={(e) => handleMetaChange('metaTitle', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                />
                <p className={cn('text-xs mt-1', metaTitle.length > 60 ? 'text-red-400' : 'text-gray-600')}>
                  {metaTitle.length}/60
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Meta Description</label>
                <textarea
                  value={metaDesc}
                  onChange={(e) => handleMetaChange('metaDesc', e.target.value)}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
                />
                <p className={cn('text-xs mt-1', metaDesc.length > 160 ? 'text-red-400' : 'text-gray-600')}>
                  {metaDesc.length}/160
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => handleMetaChange('slug', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Featured Image</p>
            {article.image_url ? (
              <img src={article.image_url} alt="" className="w-full rounded-lg object-cover h-28" />
            ) : (
              <div className="w-full h-28 bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-xs text-gray-600">Chưa có ảnh</p>
              </div>
            )}
          </div>

          {/* SEO Checklist */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">SEO Checklist</p>
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                passCount === seoChecks.length ? 'bg-emerald-600/20 text-emerald-400' :
                passCount >= 4 ? 'bg-amber-600/20 text-amber-400' :
                'bg-red-600/20 text-red-400'
              )}>
                {passCount}/{seoChecks.length}
              </span>
            </div>
            <div className="space-y-2">
              {seoChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2">
                  <span className={check.pass ? 'text-emerald-400' : 'text-red-400'}>
                    {check.pass ? '✓' : '✗'}
                  </span>
                  <p className={cn('text-xs', check.pass ? 'text-gray-300' : 'text-gray-500')}>
                    {check.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Keyword density */}
            <div className="mt-4 pt-3 border-t border-gray-800">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Mật độ từ khóa</p>
                <span className={cn(
                  'text-xs font-bold',
                  density < 0.5 ? 'text-amber-400' : density > 2 ? 'text-red-400' : 'text-emerald-400'
                )}>
                  {density.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    density < 0.5 ? 'bg-amber-500' : density > 2 ? 'bg-red-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(density * 25, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
