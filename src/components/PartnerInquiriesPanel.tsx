import React, { useEffect, useState } from 'react';
import { Handshake, RefreshCw, Mail, Phone } from 'lucide-react';

interface PartnerInquiry {
  id: string;
  orgName: string;
  orgType: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  workforceSize?: number;
  metro?: string;
  payCadence?: string;
  interests: string[];
  notes?: string;
  submittedAt: string;
  status: string;
}

/** Admin Ops: leads from the Partners page (pods as a worker benefit). */
export const PartnerInquiriesPanel: React.FC = () => {
  const [items, setItems] = useState<PartnerInquiry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/partner-inquiries');
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.inquiries)) setItems(data.inquiries);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white border border-[#DDE1E6] rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-extrabold text-sm flex items-center gap-2"><Handshake className="w-4 h-4 text-[#005FB8]" /> Partner pilot requests ({items.length})</h3>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#DDE1E6] hover:bg-gray-50 text-[11px] font-semibold">
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No partner requests yet. They arrive from the Partners page.</p>
      ) : (
        <ul className="divide-y divide-[#E2E8F0]">
          {items.map(q => (
            <li key={q.id} className="py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-sm">{q.orgName} <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-[#005FB8] text-[10px] font-bold uppercase">{q.orgType}</span></div>
                <span className="font-mono text-[10px] text-slate-500">{new Date(q.submittedAt).toLocaleString()}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-600">
                <span>{q.contactName}</span>
                <a href={`mailto:${q.contactEmail}`} className="inline-flex items-center gap-1 text-[#005FB8]"><Mail className="w-3 h-3" /> {q.contactEmail}</a>
                {q.contactPhone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {q.contactPhone}</span>}
                {q.workforceSize ? <span>{q.workforceSize} workers</span> : null}
                {q.metro && <span>{q.metro}</span>}
                {q.payCadence && <span>Paid {q.payCadence}</span>}
              </div>
              {q.interests?.length > 0 && <div className="mt-1 text-slate-500">Interested in: {q.interests.join(', ')}</div>}
              {q.notes && <p className="mt-1 text-slate-700 whitespace-pre-wrap">{q.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
