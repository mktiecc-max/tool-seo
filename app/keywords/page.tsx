'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import ManualImport from '@/components/keywords/ManualImport';
import CompetitorCrawl from '@/components/keywords/CompetitorCrawl';
import SerpCrawl from '@/components/keywords/SerpCrawl';
import KeywordsTable from '@/components/keywords/KeywordsTable';
import BatchCreateModal from '@/components/keywords/BatchCreateModal';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'manual', label: '📋 Từ khóa có sẵn' },
  { id: 'competitor', label: '🔍 Crawl URL đối thủ' },
  { id: 'serp', label: '🌐 Crawl Google SERP' },
];

export default function KeywordsPage() {
  const [activeTab, setActiveTab] = useState('manual');
  const [refreshKey, setRefreshKey] = useState(0);
  const [batchIds, setBatchIds] = useState<string[] | null>(null);

  const onImported = () => setRefreshKey((k) => k + 1);

  const handleBatchCreate = (ids: string[]) => {
    setBatchIds(ids);
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
          <KeyRound size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Quản lý từ khóa</h1>
          <p className="text-gray-400 text-sm mt-0.5">Thu thập và quản lý từ khóa SEO</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="glass-card rounded-2xl p-1 flex gap-1 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        {activeTab === 'manual' && <ManualImport onImported={onImported} />}
        {activeTab === 'competitor' && <CompetitorCrawl onImported={onImported} />}
        {activeTab === 'serp' && <SerpCrawl onImported={onImported} />}
      </div>

      {/* Keywords Table — passes onBatchCreate to open modal */}
      <KeywordsTable key={refreshKey} onBatchCreate={handleBatchCreate} />

      {/* Batch Create Modal */}
      {batchIds && (
        <BatchCreateModal
          selectedIds={batchIds}
          onClose={() => setBatchIds(null)}
        />
      )}
    </div>
  );
}
