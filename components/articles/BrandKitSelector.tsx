'use client';

import { useEffect, useState } from 'react';
import { Palette, ChevronDown, X } from 'lucide-react';
import { BrandKit } from '@/types';

interface Props {
  value?: string;         // brand_kit_id hiện tại
  onChange: (id: string | undefined) => void;
}

export default function BrandKitSelector({ value, onChange }: Props) {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/brand-kits')
      .then((r) => r.json())
      .then((j) => setKits(j.brand_kits || []))
      .finally(() => setLoading(false));
  }, []);

  const selected = kits.find((k) => k.id === value);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
        <Palette size={13} className="text-violet-400" />
        Brand Kit
        <span className="text-xs text-gray-500">(tuỳ chọn)</span>
      </label>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 bg-gray-900 border border-gray-700 hover:border-violet-600 focus:border-violet-500 rounded-xl px-4 py-3 text-sm transition-colors text-left"
      >
        {selected ? (
          <>
            {/* Color dots */}
            {selected.brand_colors && selected.brand_colors.length > 0 && (
              <div className="flex gap-1 shrink-0">
                {selected.brand_colors.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
            <span className="text-white font-medium flex-1 truncate">{selected.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(undefined); setOpen(false); }}
              className="p-0.5 text-gray-500 hover:text-gray-200 rounded transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <Palette size={15} className="text-gray-600 shrink-0" />
            <span className="text-gray-500 flex-1">
              {loading ? 'Đang tải...' : kits.length === 0 ? 'Chưa có Brand Kit nào' : '-- Không dùng Brand Kit --'}
            </span>
            <ChevronDown size={14} className="text-gray-600 shrink-0" />
          </>
        )}
        {selected && <ChevronDown size={14} className="text-gray-600 shrink-0" />}
      </button>

      {/* Dropdown */}
      {open && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* None option */}
          <button
            type="button"
            onClick={() => { onChange(undefined); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left hover:bg-gray-800 ${!value ? 'bg-gray-800/50 text-gray-300' : 'text-gray-500'}`}
          >
            <X size={14} className="text-gray-600" />
            Không dùng Brand Kit
          </button>

          {kits.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-500 text-center">
              Chưa có Brand Kit nào.{' '}
              <a href="/brand-kits/new" target="_blank" className="text-violet-400 hover:underline">Tạo ngay →</a>
            </div>
          ) : (
            kits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => { onChange(kit.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left hover:bg-gray-800 ${value === kit.id ? 'bg-violet-900/30 border-l-2 border-violet-500' : ''}`}
              >
                {/* Color swatches */}
                <div className="flex gap-1 shrink-0">
                  {(kit.brand_colors || []).slice(0, 3).map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                  ))}
                  {(!kit.brand_colors || kit.brand_colors.length === 0) && (
                    <div className="w-3 h-3 rounded-full bg-gray-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{kit.name}</p>
                  {kit.tone_of_voice && (
                    <p className="text-xs text-gray-500 truncate">{kit.tone_of_voice}</p>
                  )}
                </div>
                {value === kit.id && <span className="text-violet-400 text-xs shrink-0">✓ Đang dùng</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
