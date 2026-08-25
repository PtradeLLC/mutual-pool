import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, ChatThread, ChatMessageType, User, Pod } from '../types';

interface ChatContextType {
  threads: ChatThread[];
  activeThread: ChatThread | null;
  messages: ChatMessage[];
  onlineUsers: string[];
  typingUsers: Record<string, { userId: string; displayName: string }[]>;
  isChatOpen: boolean;
  totalUnreadCount: number;
  isConnected: boolean;
  openChat: () => void;
  closeChat: () => void;
  selectThread: (thread: ChatThread | null) => void;
  sendMessage: (content: string, type?: ChatMessageType, metadata?: Record<string, unknown>) => Promise<void>;
  sendTyping: (isTyping: boolean) => void;
  startDirectChat: (targetUser: { id: string; displayName: string; avatarUrl?: string; platform?: string }) => Promise<ChatThread | null>;
  openPodChat: (pod: Pod) => void;
  refreshThreads: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ 
  children: React.ReactNode; 
  currentUser: User | null;
  availablePods?: Pod[];
}> = ({
  children,
  currentUser,
  availablePods = [],
}) => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; displayName: string }[]>>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activeThreadRef = useRef<ChatThread | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  activeThreadRef.current = activeThread;

  const currentUserId = currentUser?.id || 'usr_verified_101';
  const currentUserName = currentUser?.displayName || 'Verified Driver';
  const currentUserAvatar = currentUser?.avatarUrl || '';
  const currentUserPlatform = currentUser?.platform || 'DoorDash';

// Fetch threads via REST API and merge with available pods
  const availablePodsRef = useRef<Pod[]>(availablePods);
  useEffect(() => {
    availablePodsRef.current = availablePods;
  }, [availablePods]);

  const refreshThreads = useCallback(async () => {
    try {
      const uEmail = currentUser?.email || '';
      const uName = currentUser?.displayName || '';
      const params = new URLSearchParams({
        userId: currentUserId,
        userEmail: uEmail,
        userName: uName,
      });

      const res = await fetch(`/api/chats/threads?${params.toString()}`, {
        headers: {
          'x-user-id': currentUserId,
          'x-user-email': uEmail,
          'x-user-name': uName,
        }
      });

      let serverThreads: ChatThread[] = [];
      if (res.ok) {
        serverThreads = await res.json();
      }

      // Merge server threads and availablePods
      const threadMap = new Map<string, ChatThread>();
      for (const t of serverThreads) {
        if (t && t.id) threadMap.set(t.id, t);
      }

      const currentPods = availablePodsRef.current;
      if (currentPods && Array.isArray(currentPods)) {
        for (const pod of currentPods) {
          if (!pod || !pod.id) continue;
          const threadId = `thread_pod_${pod.id}`;
          const existing = threadMap.get(threadId);
          if (existing) {
            existing.name = pod.name || existing.name;
            existing.podName = pod.name || existing.podName;
          } else {
            threadMap.set(threadId, {
              id: threadId,
              type: 'POD',
              name: pod.name || 'Savings Pod Channel',
              avatar: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=200',
              podId: pod.id,
              podName: pod.name,
              participantIds: [currentUserId, ...(pod.members || []).map(m => m.userId || m.id).filter(Boolean)],
              participantProfiles: (pod.members || []).map(m => ({
                userId: m.userId || m.id,
                displayName: m.displayName || 'Member',
                avatarUrl: m.avatarUrl,
                platform: m.platform,
                isOnline: true,
              })),
              unreadCount: 0,
              updatedAt: pod.createdAt || new Date().toISOString(),
              isOnline: true,
            });
          }
        }
      }

      const newThreads = Array.from(threadMap.values());
      setThreads(prev => {
        // Only trigger state update if thread contents actually changed
        if (JSON.stringify(prev.map(p => ({ id: p.id, unread: p.unreadCount, updated: p.updatedAt }))) ===
            JSON.stringify(newThreads.map(p => ({ id: p.id, unread: p.unreadCount, updated: p.updatedAt })))) {
          return prev;
        }
        return newThreads;
      });
      setIsConnected(true);
    } catch (err) {
      console.warn('[ChatContext] Error fetching threads:', err);
    }
  }, [currentUserId, currentUser?.email, currentUser?.displayName]);

  // Fetch messages for active thread
  const fetchMessagesForThread = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(`/api/chats/messages?threadId=${encodeURIComponent(threadId)}&userId=${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        setMessages(data);
        setIsConnected(true);
      }
    } catch (err) {
      console.warn('[ChatContext] Error fetching messages:', err);
    }
  }, [currentUserId]);

  // WebSocket Connection Lifecycle
  const retryCountRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const isServerlessHost = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('now.sh')
    );

    const connectWebSocket = () => {
      if (isServerlessHost) {
        return;
      }

      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      // If hosting environment does not support persistent WebSockets (e.g. serverless proxy), stop aggressive retries
      if (retryCountRef.current > 3) {
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          retryCountRef.current = 0;
          setIsConnected(true);
          // Authenticate with server
          ws.send(JSON.stringify({
            type: 'AUTH',
            userId: currentUserId,
            displayName: currentUserName,
            avatarUrl: currentUserAvatar,
            platform: currentUserPlatform,
          }));
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'AUTH_SUCCESS':
                setIsConnected(true);
                if (Array.isArray(data.onlineUsers)) {
                  setOnlineUsers(data.onlineUsers);
                }
                refreshThreads();
                break;

              case 'PRESENCE_UPDATE':
                if (Array.isArray(data.onlineUsers)) {
                  setOnlineUsers(data.onlineUsers);
                }
                break;

              case 'RECEIVE_MESSAGE': {
                const incomingMsg: ChatMessage = data.message;
                const threadId = data.threadId;

                // If message belongs to active thread, append it
                if (activeThreadRef.current && activeThreadRef.current.id === threadId) {
                  setMessages(prev => {
                    if (prev.some(m => m.id === incomingMsg.id)) return prev;
                    return [...prev, incomingMsg];
                  });

                  // Mark as read immediately if chat is open
                  if (incomingMsg.senderId !== currentUserId) {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({
                        type: 'MARK_READ',
                        threadId,
                      }));
                    }
                  }
                }

                // Update thread list with new message and refresh thread preview
                refreshThreads();
                break;
              }

              case 'USER_TYPING': {
                const { threadId, userId, displayName, isTyping } = data;
                setTypingUsers(prev => {
                  const currentTypers = prev[threadId] || [];
                  if (isTyping) {
                    if (!currentTypers.some(u => u.userId === userId)) {
                      return { ...prev, [threadId]: [...currentTypers, { userId, displayName }] };
                    }
                    return prev;
                  } else {
                    return { ...prev, [threadId]: currentTypers.filter(u => u.userId !== userId) };
                  }
                });
                break;
              }

              case 'MESSAGES_READ': {
                const { threadId, userId } = data;
                if (activeThreadRef.current && activeThreadRef.current.id === threadId) {
                  setMessages(prev => prev.map(m => {
                    if (!m.readBy) m.readBy = [];
                    if (!m.readBy.includes(userId)) {
                      return { ...m, readBy: [...m.readBy, userId] };
                    }
                    return m;
                  }));
                }
                refreshThreads();
                break;
              }
            }
          } catch (e) {
            console.error('[ChatContext] WS Message Parse Error:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          wsRef.current = null;
          retryCountRef.current += 1;
          if (retryCountRef.current <= 4) {
            const delay = Math.min(20000, 2000 * Math.pow(2, retryCountRef.current));
            reconnectTimeoutRef.current = window.setTimeout(connectWebSocket, delay);
          }
        };

        ws.onerror = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
      } catch (err) {
        // Fall back to REST polling gracefully
      }
    };

    connectWebSocket();
    refreshThreads();

    // Periodic sync fallback (every 8s, or 3s when chat is open)
    const interval = setInterval(() => {
      refreshThreads();
      if (activeThreadRef.current) {
        fetchMessagesForThread(activeThreadRef.current.id);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [currentUserId, currentUserName, currentUserAvatar, currentUserPlatform, refreshThreads, fetchMessagesForThread]);

  // When active thread changes, fetch messages and mark read
  const activeThreadId = activeThread?.id;
  useEffect(() => {
    if (activeThreadId) {
      fetchMessagesForThread(activeThreadId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'MARK_READ',
          threadId: activeThreadId,
        }));
      }
    } else {
      setMessages([]);
    }
  }, [activeThreadId, fetchMessagesForThread]);

  const selectThread = useCallback((thread: ChatThread | null) => {
    setActiveThread(thread);
    if (thread) {
      setIsChatOpen(true);
    }
  }, []);

  const openChat = useCallback(() => {
    setIsChatOpen(true);
    if (!activeThread && threads.length > 0) {
      setActiveThread(threads[0]);
    }
  }, [activeThread, threads]);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const sendMessage = useCallback(async (
    content: string,
    type: ChatMessageType = 'TEXT',
    metadata?: Record<string, unknown>
  ) => {
    if (!activeThread || !content.trim()) return;

    const payload = {
      type: 'SEND_MESSAGE',
      threadId: activeThread.id,
      content: content.trim(),
      senderId: currentUserId,
      senderName: currentUserName,
      senderAvatar: currentUserAvatar,
      senderPlatform: currentUserPlatform,
      recipientId: activeThread.type === 'DIRECT' ? activeThread.participantIds.find(id => id !== currentUserId) : undefined,
      podId: activeThread.podId,
      msgType: type,
      metadata,
    };

    // Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Fallback to REST API
      try {
        await fetch('/api/chats/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: activeThread.id,
            content: content.trim(),
            senderId: currentUserId,
            senderName: currentUserName,
            senderAvatar: currentUserAvatar,
            senderPlatform: currentUserPlatform,
            recipientId: activeThread.type === 'DIRECT' ? activeThread.participantIds.find(id => id !== currentUserId) : undefined,
            podId: activeThread.podId,
            type,
            metadata,
          }),
        });
        fetchMessagesForThread(activeThread.id);
        refreshThreads();
      } catch (err) {
        console.error('[ChatContext] Error sending message via REST:', err);
      }
    }
  }, [activeThread, currentUserId, currentUserName, currentUserAvatar, currentUserPlatform, fetchMessagesForThread, refreshThreads]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!activeThread) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TYPING',
        threadId: activeThread.id,
        isTyping,
      }));
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'TYPING',
            threadId: activeThread.id,
            isTyping: false,
          }));
        }
      }, 3000);
    }
  }, [activeThread]);

  const startDirectChat = useCallback(async (targetUser: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    platform?: string;
  }): Promise<ChatThread | null> => {
    try {
      const res = await fetch('/api/chats/start-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          targetUserId: targetUser.id,
          targetName: targetUser.displayName,
          targetAvatar: targetUser.avatarUrl,
          targetPlatform: targetUser.platform,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.thread) {
          await refreshThreads();
          setActiveThread(data.thread);
          setIsChatOpen(true);
          return data.thread;
        }
      }
    } catch (err) {
      console.error('[ChatContext] Error starting direct chat:', err);
    }
    return null;
  }, [currentUserId, refreshThreads]);

  const openPodChat = useCallback((pod: Pod) => {
    const threadId = `thread_pod_${pod.id}`;
    let matchingThread = threads.find(t => t.id === threadId || t.podId === pod.id);

    if (!matchingThread) {
      const memberIds = (pod.members || []).map(m => m.userId || m.id).filter(Boolean);
      if (pod.createdBy && !memberIds.includes(pod.createdBy)) memberIds.push(pod.createdBy);
      if (currentUserId && !memberIds.includes(currentUserId)) memberIds.push(currentUserId);

      matchingThread = {
        id: threadId,
        type: 'POD',
        name: pod.name || 'Savings Pod Channel',
        avatar: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=200',
        podId: pod.id,
        podName: pod.name,
        participantIds: memberIds,
        participantProfiles: (pod.members || []).map(m => ({
          userId: m.userId || m.id,
          displayName: m.displayName || 'Member',
          avatarUrl: m.avatarUrl,
          platform: m.platform,
          isOnline: true,
        })),
        unreadCount: 0,
        updatedAt: pod.createdAt || new Date().toISOString(),
        isOnline: true,
      };
      setThreads(prev => [matchingThread!, ...prev.filter(t => t.id !== threadId)]);
    }

    setActiveThread(matchingThread);
    setIsChatOpen(true);
  }, [threads, currentUserId]);

  const totalUnreadCount = Math.max(0, threads.reduce((acc, t) => acc + (typeof t.unreadCount === 'number' && t.unreadCount > 0 ? t.unreadCount : 0), 0));

  return (
    <ChatContext.Provider
      value={{
        threads,
        activeThread,
        messages,
        onlineUsers,
        typingUsers,
        isChatOpen,
        totalUnreadCount,
        isConnected,
        openChat,
        closeChat,
        selectThread,
        sendMessage,
        sendTyping,
        startDirectChat,
        openPodChat,
        refreshThreads,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
