import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, Send, X, Users, User as UserIcon, Search, 
  ArrowLeft, ArrowLeftRight, Check, CheckCheck, Sparkles, 
  Radio, Circle, ShieldCheck
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useLanguage } from '../../i18n';
import { ChatThread, ChatMessage, User } from '../../types';

interface ChatDrawerProps {
  currentUser: User | null;
  onOpenSwapModal?: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ currentUser, onOpenSwapModal }) => {
  const { 
    threads, 
    activeThread, 
    messages, 
    isChatOpen, 
    closeChat, 
    selectThread, 
    sendMessage, 
    sendTyping, 
    typingUsers, 
    isConnected,
    onlineUsers,
  } = useChat();

  const { t } = useLanguage();
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'DIRECT' | 'POD'>('ALL');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = currentUser?.id || 'usr_verified_101';

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsers]);

  // Focus input on active thread change
  useEffect(() => {
    if (activeThread && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeThread]);

  if (!isChatOpen) return null;

  const filteredThreads = threads.filter(thread => {
    if (activeTab === 'DIRECT' && thread.type !== 'DIRECT') return false;
    if (activeTab === 'POD' && thread.type !== 'POD') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesName = thread.name.toLowerCase().includes(q);
    const matchesPod = thread.podName?.toLowerCase().includes(q);
    const matchesLastMsg = thread.lastMessage?.content.toLowerCase().includes(q);
    return matchesName || matchesPod || matchesLastMsg;
  });

  const currentTypers = activeThread ? (typingUsers[activeThread.id] || []).filter(u => u.userId !== currentUserId) : [];

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeThread) return;

    const content = inputText.trim();
    setInputText('');
    sendTyping(false);
    await sendMessage(content, 'TEXT');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    sendTyping(e.target.value.length > 0);
  };

  const handleQuickReply = async (reply: string) => {
    if (!activeThread) return;
    await sendMessage(reply, 'TEXT');
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div id="in-app-chat-overlay" className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
      <div 
        id="in-app-chat-panel"
        className="w-full max-w-4xl h-[92vh] sm:h-[88vh] max-h-[850px] mx-2 sm:mx-4 md:mr-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Chat Drawer Header */}
        <div id="chat-header-bar" className="px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
                  {t('chat.title')}
                </h2>
                <div 
                  id="chat-connection-pill"
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isConnected 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  }`}
                  title={isConnected ? 'WebSocket connected' : 'Connecting to WebSocket'}
                >
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className="hidden sm:inline">{isConnected ? t('chat.connected') : 'Connecting...'}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('chat.subtitle')}
              </p>
            </div>
          </div>

          <button
            id="chat-close-btn"
            onClick={closeChat}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl transition"
            aria-label={t('chat.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Drawer Body (Master-Detail Split) */}
        <div id="chat-body-container" className="flex-1 flex overflow-hidden">
          {/* Left / Sidebar Thread List */}
          <div 
            id="chat-threads-sidebar"
            className={`${
              activeThread ? 'hidden md:flex' : 'flex'
            } w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex-col bg-slate-50/50 dark:bg-slate-900/50`}
          >
            {/* Search and Tabs */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="chat-search-input"
                  type="text"
                  placeholder={t('chat.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Tabs */}
              <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400">
                <button
                  id="chat-tab-all"
                  onClick={() => setActiveTab('ALL')}
                  className={`flex-1 py-1.5 rounded-lg transition text-center ${activeTab === 'ALL' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white font-semibold shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {t('chat.allConversations')}
                </button>
                <button
                  id="chat-tab-direct"
                  onClick={() => setActiveTab('DIRECT')}
                  className={`flex-1 py-1.5 rounded-lg transition text-center ${activeTab === 'DIRECT' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white font-semibold shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {t('chat.directMessages')}
                </button>
                <button
                  id="chat-tab-pod"
                  onClick={() => setActiveTab('POD')}
                  className={`flex-1 py-1.5 rounded-lg transition text-center ${activeTab === 'POD' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white font-semibold shadow-xs' : 'hover:text-slate-900 dark:hover:text-white'}`}
                >
                  {t('chat.podChannels')}
                </button>
              </div>
            </div>

            {/* Thread Items List */}
            <div id="chat-thread-list" className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredThreads.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p>{t('chat.noThreads')}</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = activeThread?.id === thread.id;
                  const isDirect = thread.type === 'DIRECT';
                  const isOnline = thread.isOnline || (isDirect && thread.participantIds.some(pid => pid !== currentUserId && onlineUsers.includes(pid)));

                  return (
                    <button
                      key={thread.id}
                      id={`chat-thread-item-${thread.id}`}
                      onClick={() => selectThread(thread)}
                      className={`w-full p-3.5 flex items-start gap-3 text-left transition ${
                        isSelected 
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-blue-600' 
                          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {thread.avatar ? (
                          <img
                            src={thread.avatar}
                            alt={thread.name}
                            className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                            {isDirect ? <UserIcon className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                          </div>
                        )}
                        {/* Online Indicator */}
                        <span 
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                            isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                              {thread.name}
                            </span>
                            {thread.type === 'POD' && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                POD
                              </span>
                            )}
                          </div>
                          {thread.updatedAt && (
                            <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                              {formatMessageTime(thread.updatedAt)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                            {thread.lastMessage?.content || 'No messages yet'}
                          </p>
                          {(thread.unreadCount || 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shrink-0">
                              {thread.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right / Main Active Chat Conversation */}
          <div 
            id="chat-main-pane"
            className={`${
              activeThread ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col bg-white dark:bg-slate-900`}
          >
            {activeThread ? (
              <>
                {/* Active Thread Header */}
                <div id="active-thread-header" className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      id="chat-back-to-threads-btn"
                      onClick={() => selectThread(null)}
                      className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="relative shrink-0">
                      {activeThread.avatar ? (
                        <img
                          src={activeThread.avatar}
                          alt={activeThread.name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                          {activeThread.type === 'DIRECT' ? <UserIcon className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {activeThread.name}
                        </h3>
                        {activeThread.type === 'POD' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Pool Channel
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        {currentTypers.length > 0 ? (
                          <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                            {t('chat.isTyping', { name: currentTypers.map(u => u.displayName).join(', ') })}
                          </span>
                        ) : (
                          <span>
                            {activeThread.type === 'DIRECT' ? 'Verified Gig Driver' : `${activeThread.participantIds.length} members in pod`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions for this conversation */}
                  <div className="flex items-center gap-2">
                    {onOpenSwapModal && activeThread.type === 'DIRECT' && (
                      <button
                        id="chat-header-propose-swap-btn"
                        onClick={onOpenSwapModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl hover:bg-amber-100 transition"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t('chat.proposeSwap')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Stream */}
                <div id="chat-messages-container" className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40 dark:bg-slate-950/40">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
                      <Sparkles className="w-10 h-10 text-blue-500/40 mb-2" />
                      <p className="font-medium text-slate-600 dark:text-slate-300 text-sm">
                        {t('chat.noMessages')}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Connect with your peer driver to coordinate spot swaps, share road tips, and keep contributions active.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderId === currentUserId;
                      const isSystem = msg.type === 'SYSTEM' || msg.type === 'POD_ANNOUNCEMENT';
                      const isSwapOffer = msg.type === 'SWAP_OFFER';

                      if (isSystem) {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <div className="max-w-md px-4 py-2 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 rounded-xl text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-0.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {msg.type === 'POD_ANNOUNCEMENT' ? t('chat.podAnnouncementBadge') : t('chat.systemBadge')}
                              </span>
                              <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                                {msg.content}
                              </p>
                              <span className="text-[10px] text-slate-400 block mt-1">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          {!isMe && (
                            <img
                              src={msg.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                              alt={msg.senderName}
                              className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                            />
                          )}

                          <div className={`max-w-[78%] sm:max-w-md space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && activeThread.type === 'POD' && (
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block ml-1">
                                {msg.senderName} {msg.senderPlatform ? `• ${msg.senderPlatform}` : ''}
                              </span>
                            )}

                            <div
                              className={`p-3 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-none border border-slate-200/80 dark:border-slate-700/80 shadow-xs'
                              }`}
                            >
                              {isSwapOffer && (
                                <div className={`mb-2 p-2.5 rounded-xl border ${
                                  isMe 
                                    ? 'bg-blue-700/60 border-blue-500/60 text-white' 
                                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                }`}>
                                  <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                    <span>{t('chat.swapOfferBadge')}</span>
                                  </div>
                                  <p className="text-xs">
                                    {msg.metadata?.requestedSlot ? `Requested Rotation Slot #${msg.metadata.requestedSlot}` : 'Rotation Spot Exchange'}
                                  </p>
                                </div>
                              )}

                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                              <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                <span>{formatMessageTime(msg.createdAt)}</span>
                                {isMe && (
                                  <span>
                                    {(msg.readBy?.length || 0) > 1 ? (
                                      <CheckCheck className="w-3.5 h-3.5 text-blue-200 inline" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5 text-blue-300 inline" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator Live Display */}
                  {currentTypers.length > 0 && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs pl-2 py-1 animate-pulse">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200" />
                      </div>
                      <span>{t('chat.isTyping', { name: currentTypers.map(u => u.displayName).join(', ') })}</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Reply Chips */}
                <div id="chat-quick-replies-bar" className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1">
                    {t('chat.quickReplies')}:
                  </span>
                  <button
                    onClick={() => handleQuickReply(t('chat.quickReply1'))}
                    className="shrink-0 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 rounded-full border border-slate-200 dark:border-slate-700 transition"
                  >
                    {t('chat.quickReply1')}
                  </button>
                  <button
                    onClick={() => handleQuickReply(t('chat.quickReply2'))}
                    className="shrink-0 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 rounded-full border border-slate-200 dark:border-slate-700 transition"
                  >
                    {t('chat.quickReply2')}
                  </button>
                  <button
                    onClick={() => handleQuickReply(t('chat.quickReply3'))}
                    className="shrink-0 px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-slate-700 dark:text-slate-300 hover:text-blue-600 rounded-full border border-slate-200 dark:border-slate-700 transition"
                  >
                    {t('chat.quickReply3')}
                  </button>
                </div>

                {/* Message Input Form */}
                <form 
                  id="chat-message-form"
                  onSubmit={handleSendMessage}
                  className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    id="chat-message-input"
                    type="text"
                    placeholder={t('chat.typePlaceholder')}
                    value={inputText}
                    onChange={handleInputChange}
                    className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                  <button
                    id="chat-send-btn"
                    type="submit"
                    disabled={!inputText.trim()}
                    className={`p-2.5 rounded-xl font-medium transition flex items-center justify-center shrink-0 ${
                      inputText.trim()
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                    aria-label={t('chat.send')}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <h4 className="font-semibold text-slate-700 dark:text-slate-200 text-base mb-1">
                  Select a Conversation
                </h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Choose a direct driver chat or savings pod channel on the left to start messaging in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
