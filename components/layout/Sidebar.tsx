'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, KeyRound, FileText, Settings, Zap, Library, Palette } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/keywords', label: 'Từ khóa', icon: KeyRound },
  { href: '/library', label: 'Content Library', icon: Library },
  { href: '/brand-kits', label: 'Brand Kit', icon: Palette },
  { href: '/articles', label: 'Tạo bài đơn lẻ', icon: FileText },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadPendingCount();
    const channel = supabase
      .channel('sidebar-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => {
        loadPendingCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadPendingCount() {
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ready_to_review', 'in_review']);
    setPendingCount(count || 0);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">SEO Automation</p>
          <p className="text-xs text-gray-500 leading-tight">Content AI Tool</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          const isLibrary = href === '/library';

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
            >
              <Icon
                className={cn(
                  'w-4.5 h-4.5 shrink-0',
                  isActive ? 'text-blue-400' : 'text-gray-500'
                )}
                size={18}
              />
              {label}
              {isLibrary && pendingCount > 0 && (
                <span className="ml-auto bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 font-bold min-w-[20px] text-center leading-none flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
              {!isLibrary && isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">v2.0.0 — Internal Tool</p>
      </div>
    </aside>
  );
}
