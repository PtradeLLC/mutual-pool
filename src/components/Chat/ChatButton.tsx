import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useLanguage } from '../../i18n';

export const ChatButton: React.FC = () => {
  const { openChat, isChatOpen, totalUnreadCount, isConnected } = useChat();
  const { t } = useLanguage();

  if (isChatOpen) return null;

  return (
    <button
      id="floating-chat-trigger-btn"
      onClick={openChat}
      className="fixed bottom-[88px] sm:bottom-[88px] right-4 sm:right-6 z-40 flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-900 active:scale-95 text-white backdrop-blur-md rounded-full shadow-lg shadow-slate-900/25 hover:shadow-xl border border-slate-700/60 transition-all duration-200 group cursor-pointer"
      aria-label={t('chat.openChat')}
      title={t('chat.openChat')}
    >
      <div className="relative flex items-center justify-center">
        <MessageSquare className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
        {/* Real-time green status indicator dot */}
        <span 
          className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-slate-900 ${
            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`} 
        />
      </div>

      <span className="font-semibold text-xs tracking-tight hidden sm:inline text-slate-100 group-hover:text-white">
        {t('chat.openChat')}
      </span>

      {/* Unread badge count */}
      {totalUnreadCount > 0 && (
        <span 
          id="floating-chat-unread-badge"
          className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-black bg-rose-500 text-white rounded-full animate-bounce shadow-xs"
        >
          {totalUnreadCount}
        </span>
      )}
    </button>
  );
};
