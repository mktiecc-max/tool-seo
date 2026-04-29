'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Palette, Save, ArrowLeft, Loader2, Plus, X,
  FileText, Image as ImageIcon, Type, Upload, Eye, Trash2, Info, Wand2, Globe,
} from 'lucide-react';
import { BrandKit, BrandGuideFile, BrandImage } from '@/types';

type Tab = 'basic' | 'writing' | 'image' | 'files';

interface Props {
  params: { id: string };
}

const isNew = (id: string) => id === 'new';

const defaultKit: Partial<BrandKit> = {
  name: '',
  description: '',
  brand_colors: [],
  logo_url: '',
  writing_rules: '',
  tone_of_voice: '',
  forbidden_words: [],
  target_audience: '',
  image_style: '',
  image_rules: '',
  guide_files: [],
  brand_images: [],
};

export default function BrandKitEditorPage({ params }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('basic');
  const [kit, setKit] = useState<Partial<BrandKit>>(defaultKit);
  const [loading, setLoading] = useState(!isNew(params.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [colorInput, setColorInput] = useState('');
  const [wordInput, setWordInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const logoUploadRef = useRef<HTMLInputElement>(null);
  const brandImgRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [logoMode, setLogoMode] = useState<'url'|'upload'>('url');

  useEffect(() => {
    if (!isNew(params.id)) {
      fetch(`/api/brand-kits/${params.id}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.brand_kit) setKit(json.brand_kit);
          else setError('Không tìm thấy brand kit');
        })
        .catch(() => setError('Lỗi khi tải dữ liệu'))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  const set = (field: keyof BrandKit, value: unknown) => {
    setKit((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  // ---- Color palette ----
  const addColor = () => {
    const hex = colorInput.trim();
    if (!hex) return;
    const normalized = hex.startsWith('#') ? hex : `#${hex}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      setError('Màu không hợp lệ, nhập hex code (ví dụ: #6B21A8)');
      return;
    }
    set('brand_colors', [...(kit.brand_colors || []), normalized]);
    setColorInput('');
    setError('');
  };

  const removeColor = (i: number) => {
    set('brand_colors', (kit.brand_colors || []).filter((_, idx) => idx !== i));
  };

  // ---- Forbidden words ----
  const addWord = () => {
    const w = wordInput.trim();
    if (!w) return;
    set('forbidden_words', [...(kit.forbidden_words || []), w]);
    setWordInput('');
  };

  const removeWord = (i: number) => {
    set('forbidden_words', (kit.forbidden_words || []).filter((_, idx) => idx !== i));
  };

  // ---- Logo upload ----
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Chỉ chấp nhận file ảnh'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { set('logo_url', ev.target?.result as string); };
    reader.readAsDataURL(file);
    if (logoUploadRef.current) logoUploadRef.current.value = '';
  };

  // ---- Extract colors from logo via Canvas ----
  const extractColorsFromLogo = useCallback(() => {
    const src = kit.logo_url;
    if (!src) return;
    setExtracting(true);
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 80;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const colorMap: Record<string, number> = {};
      for (let i = 0; i < data.length; i += 16) {
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i+1] / 32) * 32;
        const b = Math.round(data[i+2] / 32) * 32;
        const a = data[i+3];
        if (a < 128 || (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) continue;
        const key = `${r},${g},${b}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
      }
      const top = Object.entries(colorMap).sort((a,b) => b[1]-a[1]).slice(0, 5);
      const hexColors = top.map(([k]) => {
        const [r,g,b] = k.split(',').map(Number);
        return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
      });
      const existing = kit.brand_colors || [];
      const merged = Array.from(new Set([...existing, ...hexColors]));
      set('brand_colors', merged);
      setExtracting(false);
    };
    img.onerror = () => { setError('Không thể đọc ảnh để trích xuất màu'); setExtracting(false); };
    img.src = src;
  }, [kit.logo_url, kit.brand_colors]);

  // ---- Brand images upload ----
  const handleBrandImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newImgs: BrandImage[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = (ev) => res(ev.target?.result as string);
        r.readAsDataURL(file);
      });
      newImgs.push({ name: file.name, data_url: dataUrl, uploaded_at: new Date().toISOString() });
    }
    set('brand_images', [...(kit.brand_images || []), ...newImgs]);
    if (brandImgRef.current) brandImgRef.current.value = '';
  };

  const removeBrandImage = (i: number) => {
    set('brand_images', (kit.brand_images || []).filter((_, idx) => idx !== i));
  };

  const updateBrandImageDesc = (i: number, desc: string) => {
    const imgs = [...(kit.brand_images || [])];
    imgs[i] = { ...imgs[i], description: desc };
    set('brand_images', imgs);
  };

  // ---- Guide file upload ----
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const newFiles: BrandGuideFile[] = [];

    for (const file of files) {
      // Only allow .md, .txt
      if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
        setError(`File "${file.name}" không hợp lệ. Chỉ chấp nhận .md và .txt`);
        continue;
      }
      try {
        const text = await file.text();
        newFiles.push({
          name: file.name,
          content_text: text,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        });
      } catch {
        setError(`Không thể đọc file "${file.name}"`);
      }
    }

    set('guide_files', [...(kit.guide_files || []), ...newFiles]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (i: number) => {
    set('guide_files', (kit.guide_files || []).filter((_, idx) => idx !== i));
  };

  // ---- Save ----
  const handleSave = async () => {
    if (!kit.name?.trim()) {
      setError('Tên brand kit không được để trống');
      setTab('basic');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = isNew(params.id) ? '/api/brand-kits' : `/api/brand-kits/${params.id}`;
      const method = isNew(params.id) ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kit),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi lưu');
      setSaved(true);
      if (isNew(params.id) && json.brand_kit?.id) {
        router.replace(`/brand-kits/${json.brand_kit.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: <Info size={14} /> },
    { id: 'writing', label: 'Quy tắc viết bài', icon: <Type size={14} /> },
    { id: 'image', label: 'Hình ảnh & Màu sắc', icon: <ImageIcon size={14} /> },
    { id: 'files', label: 'File hướng dẫn', icon: <FileText size={14} /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/brand-kits')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-violet-600 rounded-lg flex items-center justify-center">
              <Palette size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {isNew(params.id) ? 'Tạo Brand Kit mới' : `Chỉnh sửa: ${kit.name || '...'}`}
              </h1>
              <p className="text-xs text-gray-500">Bộ nhận diện thương hiệu cho AI</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu Brand Kit'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5 text-sm text-red-300 flex items-center gap-2">
          <X size={14} className="shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-300"><X size={12} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
              tab === t.id
                ? 'bg-violet-700 text-white shadow'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ TAB: Basic ============ */}
      {tab === 'basic' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Tên Brand Kit <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={kit.name || ''}
              onChange={(e) => set('name', e.target.value)}
              placeholder="VD: UCMAS Việt Nam, Blog Toán Tư Duy..."
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Mô tả ngắn</label>
            <textarea
              value={kit.description || ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Mô tả về thương hiệu này..."
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Đối tượng mục tiêu
            </label>
            <input
              type="text"
              value={kit.target_audience || ''}
              onChange={(e) => set('target_audience', e.target.value)}
              placeholder="VD: Phụ huynh có con 4-14 tuổi, quan tâm đến giáo dục STEM"
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Giọng văn & Phong cách viết
            </label>
            <textarea
              value={kit.tone_of_voice || ''}
              onChange={(e) => set('tone_of_voice', e.target.value)}
              rows={3}
              placeholder="VD: Chuyên nghiệp nhưng gần gũi, truyền cảm hứng cho phụ huynh. Dùng ngôn ngữ tích cực, tránh thuật ngữ quá chuyên sâu..."
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm resize-none"
            />
          </div>
        </div>
      )}

      {/* ============ TAB: Writing ============ */}
      {tab === 'writing' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Quy tắc viết bài
              <span className="text-xs text-gray-500 ml-2">Hỗ trợ Markdown</span>
            </label>
            <textarea
              value={kit.writing_rules || ''}
              onChange={(e) => set('writing_rules', e.target.value)}
              rows={12}
              placeholder={`VD:
## Quy tắc chung
- Luôn đề cập tên thương hiệu UCMAS ít nhất 3 lần trong bài
- Sử dụng các số liệu thực tế từ các nghiên cứu giáo dục
- Mỗi bài phải có 1 câu chuyện thực tế / case study

## Cấu trúc
- Mở bài: nêu vấn đề của phụ huynh, không nêu giải pháp ngay
- Thân bài: giải thích khoa học, dẫn chứng cụ thể
- Kết bài: CTA nhẹ nhàng, không ép buộc

## Từ khóa brand cần dùng
- "phát triển tư duy toán học"
- "UCMAS Việt Nam"
- "phương pháp bàn tính"`}
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm font-mono resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Từ ngữ cần tránh
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }}
                placeholder="Nhập từ rồi Enter để thêm..."
                className="flex-1 bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 outline-none transition-colors text-sm"
              />
              <button
                onClick={addWord}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            {kit.forbidden_words && kit.forbidden_words.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {kit.forbidden_words.map((w, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-950/50 border border-red-900/50 text-red-300 text-xs rounded-full"
                  >
                    🚫 {w}
                    <button onClick={() => removeWord(i)} className="hover:text-red-100 transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">Chưa có từ nào. AI sẽ tránh dùng các từ này.</p>
            )}
          </div>
        </div>
      )}

      {/* ============ TAB: Image ============ */}
      {tab === 'image' && (
        <div className="space-y-5">
          {/* Color palette */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Bảng màu thương hiệu
            </label>
            <div className="flex gap-2 mb-3">
              <div className="flex items-center gap-2 flex-1 bg-gray-900 border border-gray-700 focus-within:border-violet-500 rounded-xl px-4 py-2.5 transition-colors">
                {colorInput && /^#?[0-9A-Fa-f]{6}$/.test(colorInput.replace('#', '')) && (
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: colorInput.startsWith('#') ? colorInput : `#${colorInput}` }}
                  />
                )}
                <input
                  type="text"
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
                  placeholder="#6B21A8 (hex code, Enter để thêm)"
                  className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                />
              </div>
              <input
                type="color"
                onChange={(e) => setColorInput(e.target.value)}
                className="w-11 h-11 rounded-xl border border-gray-700 bg-gray-900 cursor-pointer p-1"
                title="Chọn màu từ picker"
              />
              <button
                onClick={addColor}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-xl border border-gray-700 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            {kit.brand_colors && kit.brand_colors.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {kit.brand_colors.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl"
                  >
                    <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                    <span className="text-xs text-gray-300 font-mono">{c}</span>
                    <button onClick={() => removeColor(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">Thêm màu để AI biết màu sắc thương hiệu của bạn</p>
            )}
          </div>

          {/* Logo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-300">Logo thương hiệu</label>
              <div className="flex gap-1">
                <button onClick={() => setLogoMode('url')} className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${logoMode==='url' ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><Globe size={10}/> URL</button>
                <button onClick={() => setLogoMode('upload')} className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors ${logoMode==='upload' ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}><Upload size={10}/> Tải lên</button>
              </div>
            </div>
            {logoMode === 'url' ? (
              <input type="url" value={kit.logo_url?.startsWith('data:') ? '' : (kit.logo_url || '')} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://example.com/logo.png" className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm" />
            ) : (
              <>
                <input ref={logoUploadRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" />
                <label htmlFor="logo-upload" className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-700 hover:border-violet-600 rounded-xl cursor-pointer text-sm text-gray-400 hover:text-violet-400 transition-colors">
                  <Upload size={15}/> Chọn file ảnh logo
                </label>
              </>
            )}
            {kit.logo_url && (
              <div className="mt-3 p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between gap-4">
                <img src={kit.logo_url} alt="Logo" className="h-14 max-w-[160px] object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display='none';}} />
                <div className="flex gap-2">
                  <button onClick={extractColorsFromLogo} disabled={extracting} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                    {extracting ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                    {extracting ? 'Đang trích xuất...' : 'Trích xuất màu'}
                  </button>
                  <button onClick={() => set('logo_url', '')} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"><X size={13}/></button>
                </div>
              </div>
            )}
          </div>

          {/* Brand Images Gallery */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Ảnh thương hiệu khác</label>
            <input ref={brandImgRef} type="file" accept="image/*" multiple onChange={handleBrandImageUpload} className="hidden" id="brand-img-upload" />
            <label htmlFor="brand-img-upload" className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-700 hover:border-violet-600 rounded-xl cursor-pointer text-sm text-gray-400 hover:text-violet-400 transition-colors mb-3">
              <Upload size={15}/> Upload ảnh brand (logo variant, banner, icon...)
            </label>
            {kit.brand_images && kit.brand_images.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {kit.brand_images.map((img, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="relative">
                      <img src={img.data_url} alt={img.name} className="w-full h-28 object-cover" />
                      <button onClick={() => removeBrandImage(i)} className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-900/80 text-white rounded-lg transition-colors"><Trash2 size={12}/></button>
                    </div>
                    <div className="p-2">
                      <p className="text-xs text-gray-500 truncate mb-1">{img.name}</p>
                      <input type="text" value={img.description || ''} onChange={(e) => updateBrandImageDesc(i, e.target.value)} placeholder="Mô tả ảnh này..." className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300 placeholder-gray-600 outline-none" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Image style */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Phong cách ảnh
            </label>
            <input
              type="text"
              value={kit.image_style || ''}
              onChange={(e) => set('image_style', e.target.value)}
              placeholder="VD: Ảnh thực tế, ánh sáng ấm, trẻ em vui vẻ học toán, tông tím-vàng"
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm"
            />
          </div>

          {/* Image rules */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Quy tắc ảnh chi tiết
            </label>
            <textarea
              value={kit.image_rules || ''}
              onChange={(e) => set('image_rules', e.target.value)}
              rows={5}
              placeholder={`VD:
- Luôn có mặt trẻ em (4-12 tuổi) trong ảnh
- Không có chữ hoặc text trong ảnh
- Background sáng, không tối
- Màu chủ đạo: tím (#6B21A8) và vàng (#F59E0B)
- Không dùng ảnh stock quá cũ hoặc giả tạo`}
              className="w-full bg-gray-900 border border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none transition-colors text-sm resize-none"
            />
          </div>
        </div>
      )}

      {/* ============ TAB: Files ============ */}
      {tab === 'files' && (
        <div className="space-y-5">
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300 flex items-start gap-2">
            <Eye size={14} className="shrink-0 mt-0.5" />
            <span>
              Upload file <strong>.md</strong> hoặc <strong>.txt</strong> chứa hướng dẫn thương hiệu.
              AI sẽ đọc và tuân theo nội dung trong file khi viết bài và tạo ảnh.
            </span>
          </div>

          {/* Upload button */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-700 hover:border-violet-600 rounded-xl cursor-pointer transition-colors text-sm text-gray-400 hover:text-violet-400"
            >
              {uploading ? (
                <><Loader2 size={16} className="animate-spin" /> Đang đọc file...</>
              ) : (
                <><Upload size={16} /> Chọn file .md hoặc .txt để upload</>
              )}
            </label>
          </div>

          {/* File list */}
          {kit.guide_files && kit.guide_files.length > 0 ? (
            <div className="space-y-3">
              {kit.guide_files.map((f, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-violet-400" />
                      <span className="text-sm font-medium text-gray-200">{f.name}</span>
                      {f.size && (
                        <span className="text-xs text-gray-600">
                          ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="px-4 py-3 max-h-32 overflow-y-auto">
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                      {f.content_text.slice(0, 800)}{f.content_text.length > 800 ? '\n...(còn nữa)' : ''}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-600">
              <FileText size={36} className="mx-auto mb-3 text-gray-700" />
              <p className="text-sm">Chưa có file hướng dẫn nào</p>
              <p className="text-xs mt-1">Upload file .md hoặc .txt để AI học theo brand guidelines của bạn</p>
            </div>
          )}
        </div>
      )}

      {/* Save button bottom */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => router.push('/brand-kits')}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          ← Quay lại danh sách
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-violet-500/20"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Đang lưu...' : 'Lưu Brand Kit'}
        </button>
      </div>
    </div>
  );
}
