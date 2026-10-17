import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import path from 'path';
import fs from 'fs';
import { ChatMessage, ChatThread, Pod } from '../types';
import { IS_PRODUCTION, DATA_DIR } from './runtime';

const CHATS_FILE = path.join(DATA_DIR, 'chats_data.json');
const MAX_MESSAGE_LENGTH = 4000;
const MAX_METADATA_BYTES = 2000;

interface StoredChatData {
  threads: ChatThread[];
  messages: ChatMessage[];
}

export interface VerifiedSocketUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  platform?: string;
}

// Wired up by server.ts: token verification, the pod list (for pod channels),
// allowed WebSocket origins and the persistence hook.
interface ChatManagerConfig {
  verifyToken: (token: string) => Promise<VerifiedSocketUser | null>;
  getPods: () => Pod[];
  allowedOrigins: string[];
  onChange: () => void;
}

let config: ChatManagerConfig = {
  verifyToken: async () => null,
  getPods: () => [],
  allowedOrigins: [],
  onChange: () => {},
};

export function configureChatManager(partial: Partial<ChatManagerConfig>): void {
  config = { ...config, ...partial };
}

// In-memory chat storage
let threads: ChatThread[] = [];
let messages: ChatMessage[] = [];

export function getChatThreads(): ChatThread[] {
  return threads;
}
export function setChatThreads(next: ChatThread[]): void {
  threads = next;
}
export function getChatMessages(): ChatMessage[] {
  return messages;
}
export function setChatMessages(next: ChatMessage[]): void {
  messages = next;
}

// WebSocket active connection registry: userId -> Set<WebSocket>
const userSockets = new Map<string, Set<WebSocket>>();
const socketUserMap = new Map<WebSocket, VerifiedSocketUser>();

function loadChatDataFromDisk(): StoredChatData {
  if (IS_PRODUCTION) return { threads: [], messages: [] };
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.threads) && Array.isArray(parsed.messages)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[ChatManager] Error reading chats_data.json:', err);
  }
  return { threads: [], messages: [] };
}

function saveChatData() {
  config.onChange();
  if (IS_PRODUCTION) return;
  try {
    const data = JSON.stringify({ threads, messages }, null, 2);
    if (fs.existsSync(CHATS_FILE) && fs.readFileSync(CHATS_FILE, 'utf8') === data) return;
    fs.writeFileSync(CHATS_FILE, data, 'utf8');
  } catch (err) {
    console.error('[ChatManager] Error saving chats_data.json:', err);
  }
}

// Initialize chat data (development only; production hydrates from Firestore)
const initialData = loadChatDataFromDisk();
threads = initialData.threads;
messages = initialData.messages;

function broadcastToUsers(targetUserIds: string[], payload: any) {
  const serialized = JSON.stringify(payload);
  const sentSockets = new Set<WebSocket>();

  for (const uid of targetUserIds) {
    const sockets = userSockets.get(uid);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN && !sentSockets.has(ws)) {
          ws.send(serialized);
          sentSockets.add(ws);
        }
      }
    }
  }
}

// Users who share at least one thread with userId (presence is only visible to them).
function getContactsOf(userId: string): string[] {
  const contacts = new Set<string>();
  for (const t of threads) {
    if (t?.participantIds?.includes(userId)) {
      t.participantIds.forEach(id => contacts.add(id));
    }
  }
  contacts.delete(userId);
  return Array.from(contacts);
}

function getOnlineContacts(userId: string): string[] {
  return getContactsOf(userId).filter(id => userSockets.has(id));
}

function broadcastPresence(userId: string, isOnline: boolean) {
  for (const contactId of getContactsOf(userId)) {
    if (!userSockets.has(contactId)) continue;
    broadcastToUsers([contactId], {
      type: 'PRESENCE_UPDATE',
      userId,
      isOnline,
      onlineUsers: getOnlineContacts(contactId),
    });
  }
}

export function isThreadParticipant(threadId: string, userId: string): boolean {
  const thread = threads.find(t => t.id === threadId);
  return Boolean(thread && thread.participantIds.includes(userId));
}

function podMemberIds(pod: Pod): string[] {
  const ids = (pod.members || []).map(m => m.userId).filter(Boolean) as string[];
  if (pod.createdBy && !ids.includes(pod.createdBy)) ids.push(pod.createdBy);
  return ids;
}

export function getOrCreateDirectThread(
  user1: { id: string; displayName: string; avatarUrl?: string; platform?: string },
  user2: { id: string; displayName: string; avatarUrl?: string; platform?: string }
): ChatThread {
  const sortedIds = [user1.id, user2.id].sort();
  const threadId = `thread_direct_${sortedIds[0]}_${sortedIds[1]}`;

  let thread = threads.find(t => t.id === threadId);
  if (!thread) {
    thread = {
      id: threadId,
      type: 'DIRECT',
      name: user2.displayName || 'Driver',
      avatar: user2.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user2.displayName)}&background=005FB8&color=fff`,
      participantIds: [user1.id, user2.id],
      participantProfiles: [
        { userId: user1.id, displayName: user1.displayName, avatarUrl: user1.avatarUrl, platform: user1.platform },
        { userId: user2.id, displayName: user2.displayName, avatarUrl: user2.avatarUrl, platform: user2.platform },
      ],
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    };
    threads.unshift(thread);
    saveChatData();
  }
  return thread;
}

// Pod channel participants always mirror the pod's current members + creator,
// so members who leave or are removed lose access.
export function getOrCreatePodThread(pod: Pod): ChatThread {
  const threadId = `thread_pod_${pod.id}`;
  let thread = threads.find(t => t.id === threadId);
  const memberIds = podMemberIds(pod);
  const profiles = (pod.members || []).filter(m => m.userId).map(m => ({
    userId: m.userId,
    displayName: m.displayName || 'Member',
    avatarUrl: m.avatarUrl,
    platform: m.platform,
  }));

  if (!thread) {
    thread = {
      id: threadId,
      type: 'POD',
      name: pod.name || 'Savings Pod Channel',
      avatar: 'https://ui-avatars.com/api/?name=Lainie&background=7C3AED&color=fff&size=200',
      podId: pod.id,
      podName: pod.name,
      participantIds: memberIds,
      participantProfiles: profiles,
      unreadCount: 0,
      updatedAt: pod.createdAt || new Date().toISOString(),
    };
    threads.unshift(thread);
    saveChatData();
    return thread;
  }

  const changed =
    thread.participantIds.length !== memberIds.length ||
    thread.participantIds.some(id => !memberIds.includes(id)) ||
    thread.name !== (pod.name || thread.name);
  if (changed) {
    thread.participantIds = memberIds;
    thread.participantProfiles = profiles;
    thread.podName = pod.name || thread.podName;
    thread.name = pod.name || thread.name;
    saveChatData();
  }
  return thread;
}

function syncPodThreadsForUser(userId: string): void {
  for (const pod of config.getPods()) {
    if (pod && pod.id && podMemberIds(pod).includes(userId)) {
      getOrCreatePodThread(pod);
    }
  }
}

// Make sure a pod channel exists (and is in sync) before checking participation.
export function ensureThreadForUser(threadId: string, userId: string): void {
  if (!threadId.startsWith('thread_pod_')) return;
  const pod = config.getPods().find(p => p && `thread_pod_${p.id}` === threadId);
  if (pod && podMemberIds(pod).includes(userId)) getOrCreatePodThread(pod);
}

export function getThreadsForUser(userId: string): ChatThread[] {
  syncPodThreadsForUser(userId);

  return threads
    .filter(t => t && t.participantIds?.includes(userId))
    .map(t => {
      const threadMessages = messages.filter(m => m.threadId === t.id);
      const unread = threadMessages.filter(m => m.senderId !== userId && (!m.readBy || !m.readBy.includes(userId))).length;
      const lastMsg = threadMessages[threadMessages.length - 1];

      let dynamicName = t.name;
      let dynamicAvatar = t.avatar;
      let isPeerOnline = false;

      if (t.type === 'DIRECT' && t.participantProfiles) {
        const peer = t.participantProfiles.find(p => p.userId !== userId);
        if (peer) {
          dynamicName = peer.displayName;
          dynamicAvatar = peer.avatarUrl || dynamicAvatar;
          isPeerOnline = userSockets.has(peer.userId);
        }
      }

      return {
        ...t,
        name: dynamicName,
        avatar: dynamicAvatar,
        unreadCount: unread,
        isOnline: t.type === 'POD' ? true : isPeerOnline,
        participantProfiles: t.participantProfiles?.map(p => ({ ...p, isOnline: userSockets.has(p.userId) })),
        lastMessage: lastMsg ? {
          content: lastMsg.content,
          senderName: lastMsg.senderName,
          senderId: lastMsg.senderId,
          createdAt: lastMsg.createdAt,
        } : t.lastMessage,
        updatedAt: lastMsg ? lastMsg.createdAt : t.updatedAt,
      };
    })
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

// Callers must check isThreadParticipant first.
export function getMessagesForThread(threadId: string, userId: string): ChatMessage[] {
  const threadMsgs = messages.filter(m => m.threadId === threadId);
  let hasChanges = false;
  threadMsgs.forEach(m => {
    if (!m.readBy) m.readBy = [];
    if (!m.readBy.includes(userId)) {
      m.readBy.push(userId);
      hasChanges = true;
    }
  });
  if (hasChanges) saveChatData();
  return threadMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export interface CreateMessageResult {
  ok: boolean;
  message?: ChatMessage;
  error?: 'THREAD_NOT_FOUND' | 'NOT_A_PARTICIPANT' | 'INVALID_MESSAGE';
}

// The sender must already be a participant; sending never adds anyone to a thread.
export function createMessage(payload: {
  threadId: string;
  sender: VerifiedSocketUser;
  content: unknown;
  type?: ChatMessage['type'];
  metadata?: unknown;
}): CreateMessageResult {
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (!content || content.length > MAX_MESSAGE_LENGTH) return { ok: false, error: 'INVALID_MESSAGE' };

  ensureThreadForUser(payload.threadId, payload.sender.userId);
  const thread = threads.find(t => t.id === payload.threadId);
  if (!thread) return { ok: false, error: 'THREAD_NOT_FOUND' };
  if (!thread.participantIds.includes(payload.sender.userId)) return { ok: false, error: 'NOT_A_PARTICIPANT' };

  let metadata: Record<string, unknown> | undefined;
  if (payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)) {
    try {
      const serialized = JSON.stringify(payload.metadata);
      // Firestore cannot store arrays nested in arrays; keep metadata small and flat.
      if (serialized.length <= MAX_METADATA_BYTES && !/\[\s*\[/.test(serialized)) {
        metadata = JSON.parse(serialized);
      }
    } catch {
      metadata = undefined;
    }
  }

  const msg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    threadId: thread.id,
    senderId: payload.sender.userId,
    senderName: payload.sender.displayName || 'Member',
    senderAvatar: payload.sender.avatarUrl,
    senderPlatform: payload.sender.platform || 'DoorDash',
    recipientId: thread.type === 'DIRECT' ? thread.participantIds.find(id => id !== payload.sender.userId) : undefined,
    podId: thread.podId,
    content,
    type: payload.type === 'SYSTEM' ? 'TEXT' : (payload.type || 'TEXT'),
    createdAt: new Date().toISOString(),
    readBy: [payload.sender.userId],
    metadata,
  };

  messages.push(msg);
  thread.lastMessage = {
    content: msg.content,
    senderName: msg.senderName,
    senderId: msg.senderId,
    createdAt: msg.createdAt,
  };
  thread.updatedAt = msg.createdAt;
  saveChatData();

  broadcastToUsers(thread.participantIds, {
    type: 'RECEIVE_MESSAGE',
    message: msg,
    threadId: msg.threadId,
  });

  return { ok: true, message: msg };
}

// Callers must check isThreadParticipant first.
export function markThreadMessagesAsRead(threadId: string, userId: string): void {
  let changed = false;
  for (const m of messages) {
    if (m.threadId === threadId && m.senderId !== userId) {
      if (!m.readBy) m.readBy = [];
      if (!m.readBy.includes(userId)) {
        m.readBy.push(userId);
        changed = true;
      }
    }
  }
  if (changed) {
    saveChatData();
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      broadcastToUsers(thread.participantIds, {
        type: 'MESSAGES_READ',
        threadId,
        userId,
        readAt: new Date().toISOString(),
      });
    }
  }
}

function isAllowedOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return !IS_PRODUCTION;
  if (config.allowedOrigins.includes(origin)) return true;
  // Same-origin connections (the SPA is served by this server).
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

// WebSocket Server initialization
export function setupWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws' && url.pathname !== '/ws/') return;
      if (!isAllowedOrigin(request)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      console.warn('[WebSocket] Upgrade error:', err);
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    let currentUser: VerifiedSocketUser | null = null;

    // Unauthenticated sockets are closed after 10s.
    const authTimeout = setTimeout(() => {
      if (!currentUser) ws.close(4001, 'Authentication required');
    }, 10_000);

    ws.on('message', async (data) => {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        const parsed = JSON.parse(text);

        if (parsed.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          return;
        }

        if (parsed.type === 'AUTH') {
          const verified = typeof parsed.token === 'string' ? await config.verifyToken(parsed.token) : null;
          if (!verified) {
            ws.send(JSON.stringify({ type: 'AUTH_FAILED' }));
            ws.close(4001, 'Invalid token');
            return;
          }
          clearTimeout(authTimeout);
          currentUser = verified;
          if (!userSockets.has(verified.userId)) {
            userSockets.set(verified.userId, new Set());
          }
          userSockets.get(verified.userId)!.add(ws);
          socketUserMap.set(ws, verified);
          syncPodThreadsForUser(verified.userId);

          ws.send(JSON.stringify({
            type: 'AUTH_SUCCESS',
            userId: verified.userId,
            onlineUsers: getOnlineContacts(verified.userId),
          }));
          broadcastPresence(verified.userId, true);
          return;
        }

        if (!currentUser) {
          ws.send(JSON.stringify({ type: 'ERROR', error: 'UNAUTHENTICATED' }));
          return;
        }

        switch (parsed.type) {
          case 'SEND_MESSAGE': {
            const { threadId, content, msgType, metadata } = parsed;
            if (typeof threadId !== 'string') return;
            const result = createMessage({ threadId, sender: currentUser, content, type: msgType, metadata });
            if (result.ok) {
              ws.send(JSON.stringify({ type: 'MESSAGE_SENT_ACK', messageId: result.message.id, threadId }));
            } else {
              ws.send(JSON.stringify({ type: 'ERROR', error: result.error, threadId }));
            }
            break;
          }

          case 'TYPING': {
            const { threadId, isTyping } = parsed;
            if (typeof threadId !== 'string' || !isThreadParticipant(threadId, currentUser.userId)) return;
            const thread = threads.find(t => t.id === threadId)!;
            broadcastToUsers(thread.participantIds.filter(id => id !== currentUser!.userId), {
              type: 'USER_TYPING',
              threadId,
              userId: currentUser.userId,
              displayName: currentUser.displayName || 'A member',
              isTyping: !!isTyping,
            });
            break;
          }

          case 'MARK_READ': {
            const { threadId } = parsed;
            if (typeof threadId === 'string' && isThreadParticipant(threadId, currentUser.userId)) {
              markThreadMessagesAsRead(threadId, currentUser.userId);
            }
            break;
          }
        }
      } catch (err) {
        console.error('[WebSocket] Error handling message:', err);
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (currentUser) {
        const userSet = userSockets.get(currentUser.userId);
        if (userSet) {
          userSet.delete(ws);
          if (userSet.size === 0) {
            userSockets.delete(currentUser.userId);
            broadcastPresence(currentUser.userId, false);
          }
        }
      }
      socketUserMap.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket] Client connection error:', err?.message || err);
    });
  });

  console.log('[ChatManager] WebSocket server initialized on path /ws');
  return wss;
}
