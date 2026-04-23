import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function countKeywordDensity(content: string, keyword: string): number {
  const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
  const words = plainText.split(/\s+/).length;
  const kwWords = keyword.toLowerCase().split(/\s+/).length;
  const regex = new RegExp(keyword.toLowerCase().replace(/\s+/g, '\\s+'), 'gi');
  const matches = plainText.match(regex) || [];
  return words > 0 ? (matches.length * kwWords * 100) / words : 0;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    configuring: 'Đang cấu hình',
    generating_outline: 'Tạo outline...',
    outline_review: 'Chờ duyệt outline',
    generating_content: 'Đang viết bài...',
    content_review: 'Chờ duyệt nội dung',
    generating_image: 'Tạo ảnh...',
    image_review: 'Chờ duyệt ảnh',
    publishing: 'Đang đăng...',
    done: 'Đã đăng',
    failed: 'Thất bại',
  };
  return labels[status] || status;
}
