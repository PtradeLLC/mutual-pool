import React, { useEffect, useState } from 'react';
import { Languages, RefreshCw } from 'lucide-react';
import { getTradition } from '../data/roscaTraditions';

interface Row { language: string; members: number }
interface Stats {
  totalMembers: number;
  appLanguage: Row[];
  deviceLanguage: Row[];
  traditions: Array<{ traditionId: string; members: number }>;
}

// Admin-only: which languages members' devices and app settings use, so new
// translations are chosen from real demand rather than guesses.
export const LanguageStatsCard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/language-stats');
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.warn('Failed to load language stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const Table: React.FC<{ title: string; rows: Array<{ label: string; members: number }> }> = ({ title, rows }) => (
    <div>
      <h4 className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-1.5">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">No data yet</p>
      ) : (
        <ul className="space-y-1 text-xs text-[#374151]">
          {rows.slice(0, 8).map(r => (
            <li key={r.label} className="flex justify-between gap-2">
              <span className="font-mono">{r.label}</span>
              <span className="font-bold">{r.members}{stats ? ` (${Math.round((r.members / Math.max(1, stats.totalMembers)) * 100)}%)` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
            <Languages className="w-5 h-5 text-[#005FB8]" />
            Member Languages & Traditions
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Device language is read from the browser; app language is what members chose. Use this to decide which translations to add next (English, Spanish and French are available today).
          </p>
        </div>
        <button type="button" onClick={load} className="p-2 rounded-lg border border-[#DDE1E6] hover:bg-gray-50 text-[#6B7280]" aria-label="Refresh language stats">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Table title="Device language" rows={(stats?.deviceLanguage || []).map(r => ({ label: r.language, members: r.members }))} />
        <Table title="App language" rows={(stats?.appLanguage || []).map(r => ({ label: r.language, members: r.members }))} />
        <Table title="Savings circle name" rows={(stats?.traditions || []).map(r => ({ label: getTradition(r.traditionId)?.name || r.traditionId, members: r.members }))} />
      </div>
    </div>
  );
};
