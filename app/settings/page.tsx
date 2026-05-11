'use client';

import { useEffect, useState } from 'react';
import { Settings, AIModel, ImageAI } from '@/types';
import { supabase } from '@/lib/supabase';
import { Settings as SettingsIcon, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, TestTube2, Sheet, ExternalLink } from 'lucide-react';

type FieldDef = {
  key: keyof Settings;
  label: string;
  placeholder: string;
  type: 'password' | 'text' | 'url';
  testable?: boolean;
};

// Danh sách model versions cho từng provider
const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o',          label: 'GPT-4o (mặc định, đa năng)' },
    { value: 'gpt-4o-mini',     label: 'GPT-4o Mini (nhanh, rẻ hơn)' },
    { value: 'o4-mini',         label: 'o4-mini (reasoning)' },
    { value: 'o3',              label: 'o3 (reasoning mạnh nhất)' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash',   label: 'Gemini 2.0 Flash (mặc định, miễn phí)' },
    { value: 'gemini-2.5-pro',     label: 'Gemini 2.5 Pro (mạnh nhất, có phí)' },
    { value: 'gemini-2.5-flash',   label: 'Gemini 2.5 Flash (cân bằng)' },
    { value: 'gemini-1.5-flash',   label: 'Gemini 1.5 Flash (cũ, ổn định)' },
  ],
  anthropic: [
    { value: 'claude-opus-4-5',              label: 'Claude Opus 4.5 (mặc định, mạnh nhất)' },
    { value: 'claude-3-5-sonnet-20241022',   label: 'Claude 3.5 Sonnet (nhanh, cân bằng)' },
    { value: 'claude-3-5-haiku-20241022',    label: 'Claude 3.5 Haiku (nhanh nhất, rẻ nhất)' },
    { value: 'claude-3-opus-20240229',       label: 'Claude 3 Opus (cũ, mạnh)' },
  ],
};

const fieldGroups: { title: string; fields: FieldDef[] }[] = [
  {
    title: '🤖 AI API Keys',
    fields: [
      { key: 'openai_api_key', label: 'OpenAI API Key', placeholder: 'sk-...', type: 'password', testable: true },
      { key: 'gemini_api_key', label: 'Google Gemini API Key', placeholder: 'AIza...', type: 'password', testable: true },
      { key: 'anthropic_api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...', type: 'password', testable: true },
      { key: 'serpapi_key', label: 'SerpAPI Key', placeholder: 'abc123...', type: 'password', testable: false },
    ],
  },
  {
    title: '🌐 WordPress',
    fields: [
      { key: 'wp_url', label: 'WordPress URL', placeholder: 'https://yoursite.com', type: 'url' },
      { key: 'wp_username', label: 'WordPress Username', placeholder: 'admin', type: 'text' },
      { key: 'wp_app_password', label: 'Application Password', placeholder: 'xxxx xxxx xxxx xxxx', type: 'password', testable: true },
    ],
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [showPassword, setShowPassword] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestResult, setSheetTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Google Sheets env fields (stored only in .env.local — not in DB)
  const [sheetId, setSheetId] = useState('');
  const [saEmail, setSaEmail] = useState('');
  const [saKey, setSaKey] = useState('');;

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (bình thường khi chưa có settings)
      setError(`Lỗi kết nối Supabase: ${error.message}`);
    }
    if (data) setSettings(data);
  }

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      // Check existing row
      const { data: existing, error: selectErr } = await supabase
        .from('settings')
        .select('id')
        .limit(1)
        .single();

      if (selectErr && selectErr.code !== 'PGRST116') {
        throw new Error(`Không thể kết nối Supabase: ${selectErr.message}`);
      }

      if (existing?.id) {
        // Update
        const { error: updateErr } = await supabase
          .from('settings')
          .update(settings)
          .eq('id', existing.id);
        if (updateErr) throw new Error(`Lỗi cập nhật: ${updateErr.message}`);
      } else {
        // Insert
        const { error: insertErr } = await supabase
          .from('settings')
          .insert(settings);
        if (insertErr) throw new Error(`Lỗi lưu mới: ${insertErr.message}`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service: string) => {
    setTesting(service);
    setTestResults((prev) => ({ ...prev, [service]: null }));
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, settings }),
      });
      const json = await res.json();
      setTestResults((prev) => ({ ...prev, [service]: json.success }));
    } catch {
      setTestResults((prev) => ({ ...prev, [service]: false }));
    } finally {
      setTesting(null);
    }
  };

  const testSheetConnection = async () => {
    if (!sheetId || !saEmail || !saKey) return;
    setTestingSheet(true);
    setSheetTestResult(null);
    try {
      const res = await fetch('/api/articles/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: [] }),
      });
      const json = await res.json();
      if (res.status === 503) {
        setSheetTestResult({ ok: false, message: 'Chưa cấu hình env vars. Hãy thêm vào .env.local và restart server.' });
      } else {
        setSheetTestResult({ ok: true, message: 'Kết nối Google Sheets thành công!' });
      }
    } catch (e: unknown) {
      setSheetTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTestingSheet(false);
    }
  };

  const toggleShow = (key: string) => {
    setShowPassword((prev) => {
      const s = new Set(prev);
      if (s.has(key)) { s.delete(key); } else { s.add(key); }
      return s;
    });
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl flex items-center justify-center">
          <SettingsIcon size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Cài đặt</h1>
          <p className="text-gray-400 text-sm mt-0.5">Cấu hình API keys và kết nối WordPress</p>
        </div>
      </div>

      <div className="space-y-8">
        {fieldGroups.map((group) => (
          <div key={group.title} className="glass-card rounded-2xl p-6">
            <h2 className="font-semibold text-white mb-5">{group.title}</h2>
            <div className="space-y-4">
              {group.fields.map((field) => (
                <div key={field.key as string}>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{field.label}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={field.type === 'password' && !showPassword.has(field.key as string) ? 'password' : 'text'}
                        value={(settings[field.key] as string) || ''}
                        onChange={(e) => setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono pr-10"
                      />
                      {field.type === 'password' && (
                        <button
                          onClick={() => toggleShow(field.key as string)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showPassword.has(field.key as string) ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                    {field.testable && (
                      <button
                        onClick={() => testConnection(field.key as string)}
                        disabled={testing === field.key || !settings[field.key]}
                        className="flex items-center gap-1.5 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors shrink-0"
                      >
                        {testing === field.key ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : testResults[field.key as string] === true ? (
                          <CheckCircle2 size={13} className="text-emerald-400" />
                        ) : testResults[field.key as string] === false ? (
                          <AlertCircle size={13} className="text-red-400" />
                        ) : (
                          <TestTube2 size={13} />
                        )}
                        Test
                      </button>
                    )}
                  </div>

                  {/* wp_app_password help text */}
                  {field.key === 'wp_app_password' && (
                    <p className="text-xs text-gray-600 mt-1.5">
                      Lấy tại: WordPress Admin → Users → Profile → Application Passwords
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Google Sheets Integration */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Sheet size={16} className="text-green-400" />
            <h2 className="font-semibold text-white">📊 Google Sheets</h2>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Đồng bộ bài viết hoàn chỉnh lên Google Sheets với 5 cột:{' '}
            <span className="text-gray-400 font-medium">Từ khóa · Outline · Nội dung · Prompt ảnh · Link WordPress</span>
          </p>

          {/* Setup instructions */}
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-xl p-4 mb-5 space-y-2">
            <p className="text-xs font-semibold text-blue-300">⚙️ Hướng dẫn cài đặt (thêm vào .env.local)</p>
            <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
              <li>Vào <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-400 underline">Google Cloud Console</a> → tạo Project</li>
              <li>Bật <strong className="text-gray-300">Google Sheets API</strong></li>
              <li>Tạo <strong className="text-gray-300">Service Account</strong> → tải file JSON private key</li>
              <li>Chia sẻ Google Sheet với email service account (quyền Editor)</li>
              <li>Thêm 3 biến sau vào <code className="text-amber-300">.env.local</code> và restart server</li>
            </ol>
            <div className="bg-gray-900/80 rounded-lg p-3 font-mono text-xs text-emerald-300 space-y-0.5 mt-2">
              <p>GOOGLE_SHEET_ID=<span className="text-gray-400">1BxiM...id_từ_url_sheet</span></p>
              <p>GOOGLE_SA_EMAIL=<span className="text-gray-400">name@project.iam.gserviceaccount.com</span></p>
              <p>{`GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`}</p>
            </div>
          </div>

          {/* Readonly display of current values */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Sheet ID</label>
              <input
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 font-mono focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Service Account Email</label>
              <input
                value={saEmail}
                onChange={(e) => setSaEmail(e.target.value)}
                placeholder="name@project.iam.gserviceaccount.com"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 placeholder-gray-600 font-mono focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Private Key (từ file JSON)</label>
              <textarea
                value={saKey}
                onChange={(e) => setSaKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEv...&#10;-----END PRIVATE KEY-----"
                rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-gray-300 placeholder-gray-600 font-mono focus:outline-none focus:border-green-500 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">
                ⚠️ Các giá trị này chỉ dùng để tham khảo copy vào .env.local — không lưu vào database vì lý do bảo mật.
              </p>
            </div>

            {/* Test + link */}
            <div className="flex items-center gap-3">
              <button
                onClick={testSheetConnection}
                disabled={testingSheet}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-900/40 hover:bg-green-800/50 disabled:opacity-50 text-green-300 text-xs rounded-xl border border-green-700/60 transition-colors"
              >
                {testingSheet ? <Loader2 size={13} className="animate-spin" /> : <TestTube2 size={13} />}
                Test kết nối Sheet
              </button>
              {sheetId && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl border border-gray-700 transition-colors"
                >
                  <ExternalLink size={12} /> Mở Google Sheet
                </a>
              )}
              {sheetTestResult && (
                <span className={`flex items-center gap-1.5 text-xs ${sheetTestResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sheetTestResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {sheetTestResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* AI Model Versions */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-1">🎛️ Phiên bản Model</h2>
          <p className="text-xs text-gray-500 mb-5">Chọn phiên bản cụ thể cho từng AI. Để trống = dùng mặc định.</p>
          <div className="space-y-4">
            {/* OpenAI model */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">OpenAI Model</label>
              <select
                value={settings.openai_model || ''}
                onChange={(e) => setSettings((p) => ({ ...p, openai_model: e.target.value || undefined }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Dùng mặc định (gpt-4o) --</option>
                {MODEL_OPTIONS.openai.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            {/* Gemini model */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Gemini Model</label>
              <select
                value={settings.gemini_model || ''}
                onChange={(e) => setSettings((p) => ({ ...p, gemini_model: e.target.value || undefined }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Dùng mặc định (gemini-2.0-flash) --</option>
                {MODEL_OPTIONS.gemini.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            {/* Anthropic model */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Claude Model</label>
              <select
                value={settings.anthropic_model || ''}
                onChange={(e) => setSettings((p) => ({ ...p, anthropic_model: e.target.value || undefined }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Dùng mặc định (claude-opus-4-5) --</option>
                {MODEL_OPTIONS.anthropic.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Default AI */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-5">⚡ Mặc định</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">AI viết bài mặc định</label>
              <select
                value={settings.default_ai_model || 'claude'}
                onChange={(e) => setSettings((p) => ({ ...p, default_ai_model: e.target.value as AIModel }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="gpt4o">GPT-4o (OpenAI)</option>
                <option value="gemini">Gemini (Google)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">AI tạo ảnh mặc định</label>
              <select
                value={settings.default_image_ai || 'dalle3'}
                onChange={(e) => setSettings((p) => ({ ...p, default_image_ai: e.target.value as ImageAI }))}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="dalle3">DALL-E 3 (OpenAI)</option>
                <option value="gemini-imagen">Gemini Imagen (Google)</option>
              </select>
            </div>
          </div>

          {/* Batch concurrency */}
          <div className="border-t border-gray-800 pt-4">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              🔄 Số bài tạo song song tối đa (Batch)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={1}
                max={5}
                value={settings.max_concurrent_jobs ?? 3}
                onChange={(e) => setSettings((p) => ({ ...p, max_concurrent_jobs: parseInt(e.target.value) || 3 }))}
                className="w-24 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 text-center font-bold"
              />
              <div className="flex gap-1.5">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSettings((p) => ({ ...p, max_concurrent_jobs: n }))}
                    className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition-colors ${
                      (settings.max_concurrent_jobs ?? 3) === n
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-gray-700 text-gray-500 hover:border-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">Khuyến nghị: 3 (tránh quá tải API)</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Đã lưu thành công
            </span>
          )}
          {error && (
            <span className="text-sm text-red-400 flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
