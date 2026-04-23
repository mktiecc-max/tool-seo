'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; spin?: boolean; label: string }> = {
  configuring:          { bg: 'bg-gray-800',     text: 'text-gray-400',   dot: 'bg-gray-500',    label: 'Cấu hình' },
  generating_outline:   { bg: 'bg-blue-950',     text: 'text-blue-300',   dot: 'bg-blue-400',    label: 'Tạo outline...', spin: true },
  outline_review:       { bg: 'bg-amber-950',    text: 'text-amber-300',  dot: 'bg-amber-400',   label: 'Chờ duyệt outline' },
  generating_content:   { bg: 'bg-blue-950',     text: 'text-blue-300',   dot: 'bg-blue-400',    label: 'Đang viết...', spin: true },
  content_review:       { bg: 'bg-amber-950',    text: 'text-amber-300',  dot: 'bg-amber-400',   label: 'Chờ duyệt nội dung' },
  generating_image:     { bg: 'bg-violet-950',   text: 'text-violet-300', dot: 'bg-violet-400',  label: 'Tạo ảnh...', spin: true },
  image_review:         { bg: 'bg-amber-950',    text: 'text-amber-300',  dot: 'bg-amber-400',   label: 'Chờ duyệt ảnh' },
  publishing:           { bg: 'bg-blue-950',     text: 'text-blue-300',   dot: 'bg-blue-400',    label: 'Đang đăng...', spin: true },
  done:                 { bg: 'bg-emerald-950',  text: 'text-emerald-300',dot: 'bg-emerald-400', label: 'Đã đăng' },
  failed:               { bg: 'bg-red-950',      text: 'text-red-300',    dot: 'bg-red-500',     label: 'Thất bại' },
  // v2 statuses
  ready_to_review:      { bg: 'bg-blue-950',     text: 'text-blue-300',   dot: 'bg-blue-400',    label: 'Chờ duyệt' },
  in_review:            { bg: 'bg-purple-950',   text: 'text-purple-300', dot: 'bg-purple-400',  label: 'Đang review' },
  needs_revision:       { bg: 'bg-red-950',      text: 'text-red-300',    dot: 'bg-red-400',     label: 'Cần sửa' },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['configuring'];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        cfg.bg,
        cfg.text
      )}
    >
      {cfg.spin ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      )}
      {cfg.label}
    </span>
  );
}
