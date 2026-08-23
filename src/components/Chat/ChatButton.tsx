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
      className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40 border border-blue-400/30 transition-all duration-200 group"
      aria-label={t('chat.openChat')}
    >
      <div className="relative">
        <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
        {/* Real-time green status indicator dot */}
        <span 
          className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-blue-600 ${
            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`} 
        />
      </div>

      <span className="font-semibold text-sm tracking-tight hidden sm:inline">
        {t('chat.openChat')}
      </span>

      {/* Unread badge count */}
      {totalUnreadCount > 0 && (
        <span 
          id="floating-chat-unread-badge"
          className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-black bg-rose-500 text-white rounded-full animate-bounce shadow-xs"
        >
          {totalUnreadCount}
        </span>
      )}
    </button>
  );
};
