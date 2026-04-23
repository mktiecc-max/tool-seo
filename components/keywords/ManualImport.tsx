'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CSVKeywordRow } from '@/types';

interface ManualImportProps {
  onImported: () => void;
}

function parseCSVText(text: string): CSVKeywordRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('keyword') || firstLine.includes('từ khóa');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      keyword: cols[0] || '',
      volume: cols[1] ? parseInt(cols[1]) || undefined : undefined,
      difficulty: cols[2] ? parseInt(cols[2]) || undefined : undefined,
    };
  }).filter((r) => r.keyword.length > 0);
}

export default function ManualImport({ onImported }: ManualImportProps) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<CSVKeywordRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState('');

  const handleParse = () => {
    const rows = parseCSVText(text);
    setPreview(rows);
    setResult(null);
    setError('');
  };

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
      setPreview(parseCSVText(content));
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    multiple: false,
  });

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/keywords/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: preview, source: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import thất bại');
      setResult(json);
      setPreview([]);
      setText('');
      onImported();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Nhập từ khóa</h3>
        <p className="text-xs text-gray-500 mb-4">
          Nhập CSV (cột: keyword, volume, difficulty) hoặc kéo thả file. Mỗi dòng = 1 từ khóa.
        </p>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-3 ${
            isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={24} className="mx-auto mb-2 text-gray-500" />
          <p className="text-sm text-gray-400">
            {isDragActive ? 'Thả file vào đây...' : 'Kéo thả file CSV hoặc click để chọn'}
          </p>
          <p className="text-xs text-gray-600 mt-1">Hỗ trợ .csv, .txt</p>
        </div>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'keyword,volume,difficulty\nSEO là gì,5000,45\nTối ưu SEO onpage,2000,60'}
          className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
        />

        <button
          onClick={handleParse}
          disabled={!text.trim()}
          className="mt-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 rounded-lg transition-colors"
        >
          Xem trước
        </button>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">{preview.length} từ khóa sẽ được import:</p>
          <div className="bg-gray-900 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Từ khóa</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Volume</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-800">
                    <td className="px-4 py-2 text-gray-300">{row.keyword}</td>
                    <td className="px-4 py-2 text-gray-400">{row.volume ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-400">{row.difficulty ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing}
            className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {importing ? 'Đang import...' : `Xác nhận thêm ${preview.length} từ khóa`}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} />
          Đã thêm {result.inserted} từ khóa · Bỏ qua {result.skipped} trùng lặp
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950 rounded-xl px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
