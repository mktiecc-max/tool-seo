'use client';

import { useState, useCallback } from 'react';
import { Article } from '@/types';
import {
  Loader2, RefreshCw, AlertCircle, Image as ImageIcon,
  FileJson, ChevronDown, ChevronUp, Wand2, Copy, Check,
  Download, LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateBannerJSON, type BannerDesignJSON } from '@/lib/banner-design';
import {
  DEFAULT_IMAGE_MODELS, DEFAULT_IMAGE_MODEL, fetchImageModels, type ImageModelInfo,
} from '@/lib/constants';
import { useEffect } from 'react';

// JSON mẫu chuẩn UCMAS
const DEFAULT_BANNER_JSON: BannerDesignJSON = {
  ten_mau_thiet_ke: "Banner bài viết giáo dục UCMAS",
  kich_thuoc: { ty_le: "40:21", kich_thuoc_de_xuat: "1800 x 945 px", huong_anh: "Ngang" },
  phong_cach_thiet_ke: {
    tong_the: "Sạch sẽ, hiện đại, chuyên nghiệp, phù hợp với bài viết giáo dục/phụ huynh",
    cam_giac: "Tin cậy, nhẹ nhàng, khoa học, gần gũi",
    bo_cuc: "Ảnh nền toàn khung, phần chữ đặt bên trái, nhân vật chính đặt lệch phải",
    nhan_dien_thuong_hieu: "UCMAS với màu xanh dương, đỏ và trắng làm chủ đạo",
  },
  bo_cuc_chinh: {
    nen_anh: {
      mo_ta: "Ảnh nền là bối cảnh học tập trong nhà, có trẻ đang ngồi học",
      xu_ly_nen: "Giữ ảnh nền sáng, sạch. Làm mờ nhẹ vùng đặt chữ để chữ dễ đọc",
      vung_dat_chu: "Bên trái ảnh, chiếm khoảng 45% chiều ngang",
      vung_nhan_vat: "Bên phải hoặc trung tâm phải",
    },
    logo: {
      vi_tri: "Chính giữa phía trên ảnh",
      can_le: "Căn giữa theo chiều ngang toàn ảnh",
      kich_thuoc: "Khoảng 13% - 16% chiều ngang ảnh",
      mau_sac: "Logo UCMAS chuẩn: đỏ, xanh dương, trắng",
    },
    title: {
      noi_dung_mau: { dong_1: "", dong_2: "", dong_3: "" },
    },
  },
  typography: {
    dong_1: { noi_dung: "", mau_chu: "#1F3F99", co_chu: "85 - 105 px", do_day: "ExtraBold" },
    dong_2: { noi_dung: "", mau_chu: "#E11B2E", co_chu: "85 - 105 px", do_day: "ExtraBold" },
    dong_3_trong_thanh_xanh: { noi_dung: "", mau_chu: "#FFFFFF", mau_so_5: "#E11B2E", co_chu: "42 - 52 px", do_day: "Bold" },
  },
  mau_sac: {
    xanh_chu_dao: "#1F3F99", do_nhan_dien: "#E11B2E", trang: "#FFFFFF",
    nen_sang: "#F8F6F0",
  },
  thanh_subtitle: {
    hinh_dang: "Hình chữ nhật bo góc", mau_nen: "#1F3F99", bo_goc: "12 - 18 px",
    vi_tri: "Ngay dưới dòng title chính",
  },
  hoa_tiet_trang_tri: {
    duong_cong_do: { mo_ta: "Nét cong màu đỏ mảnh phía dưới thanh xanh", mau: "#E11B2E", do_day: "3 - 5 px" },
  },
  anh_nen: {
    yeu_cau_anh: {
      chu_de: "Trẻ học tập, phụ huynh đồng hành, lớp học, bàn học, giáo dục trẻ nhỏ",
      chat_luong: "Ảnh rõ nét, ánh sáng tự nhiên",
      nhan_vat: "Đặt ở bên phải hoặc chính giữa lệch phải",
    },
  },
  gradient_phu: {
    co_su_dung: true,
    mau: "rgba(255,255,255,0.85) ở bên trái, giảm dần về trong suốt ở giữa",
    pham_vi: "Từ mép trái đến khoảng 55% chiều ngang ảnh",
  },
};

const EXAMPLES = [
  { dong_1: "Vì sao trẻ", dong_2: "mất tập trung khi học:", dong_3: "Nguyên nhân và 5 giải pháp khoa học" },
  { dong_1: "Vì sao trẻ", dong_2: "ngại học toán?", dong_3: "Nguyên nhân và 5 cách đồng hành cùng con" },
  { dong_1: "Làm sao để trẻ", dong_2: "tập trung lâu hơn?", dong_3: "5 thói quen nhỏ bố mẹ có thể rèn mỗi ngày" },
  { dong_1: "Khi trẻ", dong_2: "học trước quên sau:", dong_3: "Hiểu đúng nguyên nhân để giúp con tiến bộ" },
];

interface Props {
  article: Article;
  onImageGenerated?: (imageUrl: string) => void;
}

export default function BannerGenerator({ article, onImageGenerated }: Props) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(DEFAULT_BANNER_JSON, null, 2));
  const [jsonError, setJsonError] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [dong1, setDong1] = useState('');
  const [dong2, setDong2] = useState('');
  const [dong3, setDong3] = useState('');
  const [imageAI, setImageAI] = useState(DEFAULT_IMAGE_MODEL);
  const [imageModels, setImageModels] = useState<ImageModelInfo[]>(DEFAULT_IMAGE_MODELS);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchImageModels().then((models) => {
      setImageModels(models);
      if (!models.find((m) => m.id === imageAI)) setImageAI(models[0].id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill content từ article keyword nếu trống
  useEffect(() => {
    if (!dong1 && !dong2 && !dong3 && article.keyword) {
      setDong1('Vì sao trẻ');
      setDong2(`${article.keyword}?`);
      setDong3('Nguyên nhân và 5 giải pháp khoa học');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseJSON = useCallback((): BannerDesignJSON | null => {
    try {
      const parsed = JSON.parse(jsonText);
      const { valid, errors } = validateBannerJSON(parsed);
      if (!valid) {
        setJsonError(errors.join(', '));
        return null;
      }
      setJsonError('');
      return parsed as BannerDesignJSON;
    } catch {
      setJsonError('JSON không hợp lệ — kiểm tra cú pháp');
      return null;
    }
  }, [jsonText]);

  const applyExample = (ex: typeof EXAMPLES[0]) => {
    setDong1(ex.dong_1);
    setDong2(ex.dong_2);
    setDong3(ex.dong_3);
  };

  const handleGenerate = async () => {
    const bannerJSON = parseJSON();
    if (!bannerJSON) return;

    setGenerating(true);
    setError('');
    setImageUrl('');

    try {
      const res = await fetch('/api/articles/generate-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: article.id,
          banner_json: bannerJSON,
          image_ai: imageAI,
          image_size: '1792x1024',
          custom_content: {
            dong_1: dong1.trim() || undefined,
            dong_2: dong2.trim() || undefined,
            dong_3: dong3.trim() || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setImageUrl(json.image_url);
      setPromptUsed(json.prompt_used || '');
      onImageGenerated?.(json.image_url);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptUsed) return;
    await navigator.clipboard.writeText(promptUsed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `banner-${article.keyword?.replace(/\s+/g, '-') || 'seo'}-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <LayoutTemplate size={14} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Tạo ảnh Banner SEO từ JSON chuẩn</h3>
          <p className="text-xs text-gray-500">Phân tích JSON template → Build prompt → AI tạo banner</p>
        </div>
      </div>

      {/* Nội dung tiêu đề 3 dòng */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nội dung tiêu đề banner</p>
          <div className="flex gap-1.5">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => applyExample(ex)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 hover:bg-blue-900/50 hover:text-blue-400 transition-colors border border-gray-700"
              >
                Mẫu {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              Dòng 1 <span className="text-blue-500">● Màu xanh</span>
            </label>
            <input
              value={dong1}
              onChange={(e) => setDong1(e.target.value)}
              placeholder="VD: Vì sao trẻ"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              Dòng 2 <span className="text-red-500">● Màu đỏ — điểm nhấn chính</span>
            </label>
            <input
              value={dong2}
              onChange={(e) => setDong2(e.target.value)}
              placeholder="VD: mất tập trung khi học:"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">
              Dòng 3 <span className="text-indigo-400">● Trong thanh xanh (subtitle)</span>
            </label>
            <input
              value={dong3}
              onChange={(e) => setDong3(e.target.value)}
              placeholder="VD: Nguyên nhân và 5 giải pháp khoa học"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Preview text layout */}
        {(dong1 || dong2 || dong3) && (
          <div className="mt-3 p-3 rounded-lg bg-gray-950 border border-gray-800">
            <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wide">Preview bố cục chữ</p>
            <div className="space-y-1">
              {dong1 && <p className="text-sm font-extrabold text-blue-400">{dong1}</p>}
              {dong2 && <p className="text-sm font-extrabold text-red-400">{dong2}</p>}
              {dong3 && (
                <div className="inline-block mt-1 bg-blue-900/60 border border-blue-700/50 rounded-lg px-3 py-1">
                  <p className="text-xs font-bold text-white">{dong3}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* JSON Editor */}
      <div>
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors w-full"
        >
          <FileJson size={13} />
          <span>JSON Template cấu trúc ảnh</span>
          {showJson ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
        </button>

        {showJson && (
          <div className="mt-2">
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
              rows={12}
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-xs text-gray-400 font-mono focus:outline-none focus:border-blue-600 resize-y"
              spellCheck={false}
            />
            {jsonError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {jsonError}
              </p>
            )}
            <p className="text-[10px] text-gray-600 mt-1">
              Chỉnh sửa JSON để thay đổi cấu trúc ảnh (màu sắc, bố cục, logo, gradient...)
            </p>
          </div>
        )}
      </div>

      {/* Chọn AI model */}
      <div>
        <label className="text-xs font-medium text-gray-400 block mb-2">Chọn AI tạo ảnh</label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {imageModels.map((m) => (
            <button
              key={m.id}
              onClick={() => setImageAI(m.id)}
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all',
                imageAI === m.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
              )}
            >
              <div className={cn('w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center',
                m.provider === 'openai' ? 'bg-violet-600/30' : 'bg-blue-600/30'
              )}>
                <ImageIcon size={11} className={m.provider === 'openai' ? 'text-violet-400' : 'text-blue-400'} />
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold truncate', imageAI === m.id ? 'text-blue-300' : 'text-gray-300')}>{m.name}</p>
                {m.description && <p className="text-[10px] text-gray-600 truncate">{m.description}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
      >
        {generating ? (
          <><Loader2 size={15} className="animate-spin" />Đang tạo banner... (30-60s)</>
        ) : (
          <><Wand2 size={15} />Tạo Banner SEO</>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-950/60 border border-red-800 rounded-xl p-3">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Result */}
      {imageUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">Banner đã tạo</p>
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download size={12} /> Tải về
              </button>
              <button
                onClick={() => { setImageUrl(''); setPromptUsed(''); }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw size={12} /> Tạo lại
              </button>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-blue-700/40 bg-gray-950">
            <div className="relative w-full aspect-video">
              <img src={imageUrl} alt="SEO Banner" className="absolute inset-0 w-full h-full object-contain" />
            </div>
            <div className="absolute top-2 right-2">
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">✓ Banner sẵn sàng</span>
            </div>
          </div>

          {/* Prompt used */}
          {promptUsed && (
            <div>
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
              >
                {showPrompt ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                Xem prompt đã gửi cho AI
              </button>
              {showPrompt && (
                <div className="mt-2 relative">
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-[10px] text-gray-500 font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                    {promptUsed}
                  </pre>
                  <button
                    onClick={handleCopyPrompt}
                    className="absolute top-2 right-2 text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
