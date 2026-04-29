'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Palette, Plus, Trash2, Edit3, Loader2, AlertCircle, Tag } from 'lucide-react';
import { BrandKit } from '@/types';

export default function BrandKitsPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/brand-kits');
    const json = await res.json();
    setKits(json.brand_kits || []);
    setLoading(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Xóa brand kit "${name}"? Các bài viết đang dùng kit này sẽ không bị ảnh hưởng.`)) return;
    setDeleting(id);
    await fetch(`/api/brand-kits/${id}`, { method: 'DELETE' });
    setKits((prev) => prev.filter((k) => k.id !== id));
    setDeleting(null);
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/25">
            <Palette size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Brand Kit</h1>
            <p className="text-gray-400 text-sm mt-0.5">Quản lý bộ nhận diện thương hiệu cho AI</p>
          </div>
        </div>
        <Link
          href="/brand-kits/new"
          className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg shadow-pink-500/20 hover:-translate-y-0.5"
        >
          <Plus size={16} />
          Tạo Brand Kit mới
        </Link>
      </div>

      {/* Info banner */}
      <div className="mb-6 bg-violet-950/40 border border-violet-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
        <Palette size={16} className="text-violet-400 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-300">
          Brand Kit giúp AI viết bài và tạo ảnh theo đúng nhận diện thương hiệu của bạn.
          Khi tạo bài viết, chọn Brand Kit phù hợp để AI tự động áp dụng.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-600" />
        </div>
      ) : kits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600 border-2 border-dashed border-gray-800 rounded-2xl">
          <Palette size={48} className="mb-4 text-gray-700" />
          <p className="text-lg font-medium text-gray-500 mb-1">Chưa có Brand Kit nào</p>
          <p className="text-sm text-gray-600 mb-5">Tạo bộ nhận diện đầu tiên để AI viết đúng thương hiệu của bạn</p>
          <Link
            href="/brand-kits/new"
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
          >
            <Plus size={16} />
            Tạo Brand Kit đầu tiên
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {kits.map((kit) => (
            <div
              key={kit.id}
              className="group bg-gray-900 border border-gray-800 hover:border-violet-700/60 rounded-2xl p-5 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Color swatches */}
                    {kit.brand_colors && kit.brand_colors.length > 0 && (
                      <div className="flex gap-1">
                        {kit.brand_colors.slice(0, 4).map((c, i) => (
                          <div
                            key={i}
                            className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                    <h3 className="font-bold text-white text-base truncate">{kit.name}</h3>
                  </div>
                  {kit.description && (
                    <p className="text-sm text-gray-400 line-clamp-2">{kit.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Link
                    href={`/brand-kits/${kit.id}`}
                    className="p-2 text-gray-500 hover:text-violet-400 hover:bg-violet-900/30 rounded-lg transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit3 size={15} />
                  </Link>
                  <button
                    onClick={() => handleDelete(kit.id, kit.name)}
                    disabled={deleting === kit.id}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-40"
                    title="Xóa"
                  >
                    {deleting === kit.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {kit.tone_of_voice && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-950/50 border border-amber-800/50 text-amber-300 rounded-full">
                    <Tag size={9} /> {kit.tone_of_voice.slice(0, 30)}{kit.tone_of_voice.length > 30 ? '...' : ''}
                  </span>
                )}
                {kit.target_audience && (
                  <span className="text-xs px-2 py-0.5 bg-blue-950/50 border border-blue-800/50 text-blue-300 rounded-full">
                    👥 {kit.target_audience.slice(0, 30)}{kit.target_audience.length > 30 ? '...' : ''}
                  </span>
                )}
                {kit.guide_files && kit.guide_files.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-400 rounded-full">
                    📄 {kit.guide_files.length} file hướng dẫn
                  </span>
                )}
                {kit.forbidden_words && kit.forbidden_words.length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-red-950/50 border border-red-900/50 text-red-400 rounded-full">
                    🚫 {kit.forbidden_words.length} từ cần tránh
                  </span>
                )}
                {kit.image_style && (
                  <span className="text-xs px-2 py-0.5 bg-emerald-950/50 border border-emerald-800/50 text-emerald-400 rounded-full">
                    🖼️ Có quy tắc ảnh
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  {new Date(kit.created_at).toLocaleDateString('vi-VN')}
                </span>
                <Link
                  href={`/brand-kits/${kit.id}`}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium"
                >
                  Chỉnh sửa →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
