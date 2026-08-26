import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types';
import { Activity, Search, RefreshCw, ChevronDown, ChevronUp, FileCode, CheckCircle2 } from 'lucide-react';
import { subscribeToAuditLogs } from '../lib/firestoreService';
import { useTranslation, TranslationKey } from '../i18n';

export const AuditLogViewer: React.FC = () => {
  const { t, language } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    fetchLogs();
    const unsubscribe = subscribeToAuditLogs((firestoreLogs) => {
      if (firestoreLogs && firestoreLogs.length > 0) {
        setLogs(firestoreLogs);
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      !searchQuery || 
      log.detail.toLowerCase().includes(q) || 
      log.actorName.toLowerCase().includes(q) ||
      (log.podId && log.podId.toLowerCase().includes(q));
    return matchesAction && matchesSearch;
  });

  const actionPillColor = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'ROTATION_LOCKED': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'PAYOUT_EXECUTED': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'AGREEMENT_SIGNED': return 'bg-sky-50 text-[#005FB8] border-sky-200';
      case 'DEPOSIT_COMPLETED': return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'REPRIORITIZATION_REQUESTED': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'REPRIORITIZATION_VOTED': return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'SLOT_SWAP_EXECUTED': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'KYC_VERIFIED': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'WELCOME_MATCH_GRANTED': return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      case 'CONTINGENCY_BUFFER_USED': return 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
      case 'HARDSHIP_REQUESTED': return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'HARDSHIP_APPROVED': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'HARDSHIP_REPAID': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'HARDSHIP_REJECTED': return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'CAMPAIGN_AGREEMENT_RECORDED': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'COURIER_GEAR_VERIFIED_PAYOUT': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActionLabel = (action: AuditLogEntry['action'] | 'ALL') => {
    const key = `audit.action.${action}` as TranslationKey;
    const translated = t(key);
    return translated !== (key as string) ? translated : action;
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const locale = language === 'es' ? 'es-US' : language === 'fr' ? 'fr-FR' : 'en-US';
      return new Date(dateStr).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return new Date(dateStr).toLocaleString();
    }
  };

  const availableActions: Array<AuditLogEntry['action']> = [
    'ROTATION_LOCKED',
    'PAYOUT_EXECUTED',
    'AGREEMENT_SIGNED',
    'DEPOSIT_COMPLETED',
    'REPRIORITIZATION_REQUESTED',
    'REPRIORITIZATION_VOTED',
    'SLOT_SWAP_EXECUTED',
    'KYC_VERIFIED',
    'WELCOME_MATCH_GRANTED',
    'CONTINGENCY_BUFFER_USED',
    'BANK_LINKED',
    'USER_REGISTERED',
    'HARDSHIP_REQUESTED',
    'HARDSHIP_APPROVED',
    'CAMPAIGN_AGREEMENT_RECORDED',
    'COURIER_GEAR_VERIFIED_PAYOUT',
  ];

  return (
    <div className="space-y-5">
      
      {/* Banner */}
      <div className="bg-white border border-[#DDE1E6] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-[#005FB8]" />
            <h2 className="text-xl font-bold text-[#111827]">
              {t('audit.title')}
            </h2>
          </div>
          <p className="text-xs text-[#6B7280] max-w-2xl leading-relaxed">
            {t('audit.subtitle')}
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isRefreshing}
          className="px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs flex items-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#005FB8] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? t('audit.refreshing') : t('audit.refresh')}</span>
        </button>
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('audit.searchPlaceholder')}
            className="w-full bg-white border border-[#DDE1E6] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8] shadow-xs"
          />
        </div>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="bg-white border border-[#DDE1E6] rounded-lg px-3.5 py-2.5 text-xs text-[#111827] focus:outline-none focus:border-[#005FB8] shadow-xs font-medium cursor-pointer"
        >
          <option value="ALL">{t('audit.filter.all')}</option>
          {availableActions.map((act) => (
            <option key={act} value={act}>
              {getActionLabel(act)}
            </option>
          ))}
        </select>
      </div>

      {/* Log Feed */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">{t('audit.emptyTitle')}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{t('audit.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;

            return (
              <div
                key={log.id}
                className="bg-white border border-[#DDE1E6] hover:border-gray-400 rounded-lg p-4 transition-all text-xs shadow-xs"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${actionPillColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                    {log.podId && (
                      <span className="font-mono text-gray-600 text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {t('audit.podIdLabel')} {log.podId}
                      </span>
                    )}
                  </div>

                  <span className="text-gray-500 text-[10px] font-mono shrink-0">
                    {formatTimestamp(log.createdAt)}
                  </span>
                </div>

                <p className="text-[#111827] leading-relaxed font-sans mb-2 font-medium">
                  {log.detail}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                  <span className="text-[#6B7280]">
                    {t('audit.actor')} <strong className="text-[#111827]">{log.actorName}</strong> {log.actorId ? `(${log.actorId})` : ''}
                  </span>

                  {log.metadata && (
                    <button
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="text-[#005FB8] hover:underline font-mono text-[10px] flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <FileCode className="w-3 h-3" />
                      <span>{isExpanded ? t('audit.hidePayload') : t('audit.viewPayload')}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {isExpanded && log.metadata && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 font-mono text-[10px] text-gray-800 overflow-x-auto">
                    <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

