'use client';

import { useEffect, useState } from 'react';
import { Settings, AIModel, ImageAI } from '@/types';
import { supabase } from '@/lib/supabase';
import { Settings as SettingsIcon, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, TestTube2 } from 'lucide-react';

type FieldDef = {
  key: keyof Settings;
  label: string;
  placeholder: string;
  type: 'password' | 'text' | 'url';
  testable?: boolean;
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
