import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import path from 'path';
import fs from 'fs';
import { ChatMessage, ChatThread, ChatParticipant, User, Pod } from '../types';

const CHATS_FILE = path.join(process.env.VERCEL ? '/tmp' : process.cwd(), 'chats_data.json');

interface StoredChatData {
  threads: ChatThread[];
  messages: ChatMessage[];
}

// In-memory chat storage
let threads: ChatThread[] = [];
let messages: ChatMessage[] = [];

// WebSocket active connection registry: userId -> Set<WebSocket>
const userSockets = new Map<string, Set<WebSocket>>();
const socketUserMap = new Map<WebSocket, { userId: string; displayName: string; avatarUrl?: string }>();

function getOnlineUserIds(): string[] {
  return Array.from(userSockets.keys());
}

function loadChatDataFromDisk(): StoredChatData {
  try {
    if (fs.existsSync(CHATS_FILE)) {
      const raw = fs.readFileSync(CHATS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.threads) && Array.isArray(parsed.messages)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('[ChatManager] Error reading chats_data.json:', err);
  }

  // Initial seed conversations for instant richness
  const seedThreads: ChatThread[] = [
    {
      id: 'thread_direct_sarah_marcus',
      type: 'DIRECT',
      name: 'Sarah Jenkins',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      participantIds: ['usr_verified_101', 'usr_uber_102', 'usr_marcus'],
      participantProfiles: [
        {
          userId: 'usr_uber_102',
          displayName: 'Sarah Jenkins',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
          platform: 'Uber Eats',
          isOnline: true,
        },
        {
          userId: 'usr_verified_101',
          displayName: 'Verified Driver',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
          platform: 'DoorDash',
          isOnline: true,
        }
      ],
      lastMessage: {
        content: 'Hey! Thanks for accepting the rotation swap for Week 1. My brake repairs are fully covered now!',
        senderName: 'Sarah Jenkins',
        senderId: 'usr_uber_102',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      unreadCount: 1,
      updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      isOnline: true,
    },
    {
      id: 'thread_pod_metro_riders',
      type: 'POD',
      name: 'Metro Delivery Riders Pod',
      avatar: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=200',
      podId: 'pod_metro_riders_20',
      podName: 'Metro Delivery Riders Pod',
      participantIds: ['usr_verified_101', 'usr_uber_102', 'usr_door_103', 'usr_marcus', 'usr_elena', 'usr_devon'],
      lastMessage: {
        content: 'Weekly pool target of $400.00 met! Treasury dispatches initiating at midnight.',
        senderName: 'MutualPool System',
        senderId: 'system',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      unreadCount: 0,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      isOnline: true,
    },
    {
      id: 'thread_direct_marcus_vance',
      type: 'DIRECT',
      name: 'Marcus Vance',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      participantIds: ['usr_verified_101', 'usr_door_103', 'usr_marcus'],
      participantProfiles: [
        {
          userId: 'usr_door_103',
          displayName: 'Marcus Vance',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
          platform: 'DoorDash',
          isOnline: true,
        }
      ],
      lastMessage: {
        content: 'Did you check out the Meineke 20% discount in the Fleet Perks tab? Saved me $35 on synthetic oil.',
        senderName: 'Marcus Vance',
        senderId: 'usr_door_103',
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
      unreadCount: 0,
      updatedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      isOnline: false,
    }
  ];

  const seedMessages: ChatMessage[] = [
    {
      id: 'msg_seed_1',
      threadId: 'thread_direct_sarah_marcus',
      senderId: 'usr_uber_102',
      senderName: 'Sarah Jenkins',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      senderPlatform: 'Uber Eats',
      recipientId: 'usr_verified_101',
      content: 'Hey! Are you open to a spot swap in the Metro Delivery pod for Week 1?',
      type: 'SWAP_OFFER',
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      readBy: ['usr_uber_102', 'usr_verified_101'],
      metadata: {
        podId: 'pod_metro_riders_20',
        requestedSlot: 1,
        offeredSlot: 4,
        status: 'ACCEPTED'
      }
    },
    {
      id: 'msg_seed_2',
      threadId: 'thread_direct_sarah_marcus',
      senderId: 'usr_verified_101',
      senderName: 'Verified Driver',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      senderPlatform: 'DoorDash',
      recipientId: 'usr_uber_102',
      content: 'Yes, absolutely! I just clicked approve on the rotation board.',
      type: 'TEXT',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      readBy: ['usr_uber_102', 'usr_verified_101']
    },
    {
      id: 'msg_seed_3',
      threadId: 'thread_direct_sarah_marcus',
      senderId: 'usr_uber_102',
      senderName: 'Sarah Jenkins',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
      senderPlatform: 'Uber Eats',
      recipientId: 'usr_verified_101',
      content: 'Hey! Thanks for accepting the rotation swap for Week 1. My brake repairs are fully covered now!',
      type: 'TEXT',
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      readBy: ['usr_uber_102']
    },
    {
      id: 'msg_seed_4',
      threadId: 'thread_pod_metro_riders',
      senderId: 'system',
      senderName: 'MutualPool System',
      content: 'Welcome to the Metro Delivery Riders Pod! Contributions are scheduled weekly at $20/cycle.',
      type: 'POD_ANNOUNCEMENT',
      podId: 'pod_metro_riders_20',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      readBy: ['usr_verified_101']
    },
    {
      id: 'msg_seed_5',
      threadId: 'thread_pod_metro_riders',
      senderId: 'usr_door_103',
      senderName: 'Marcus Vance',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      senderPlatform: 'DoorDash',
      content: 'Good luck on shifts this week everyone! Don’t forget to check the GasBuddy 15¢ discount before filling up.',
      type: 'TEXT',
      podId: 'pod_metro_riders_20',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      readBy: ['usr_verified_101', 'usr_door_103']
    },
    {
      id: 'msg_seed_6',
      threadId: 'thread_pod_metro_riders',
      senderId: 'system',
      senderName: 'MutualPool System',
      content: 'Weekly pool target of $400.00 met! Treasury dispatches initiating at midnight.',
      type: 'SYSTEM',
      podId: 'pod_metro_riders_20',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      readBy: ['usr_verified_101']
    },
    {
      id: 'msg_seed_7',
      threadId: 'thread_direct_marcus_vance',
      senderId: 'usr_door_103',
      senderName: 'Marcus Vance',
      senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      senderPlatform: 'DoorDash',
      recipientId: 'usr_verified_101',
      content: 'Did you check out the Meineke 20% discount in the Fleet Perks tab? Saved me $35 on synthetic oil.',
      type: 'TEXT',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      readBy: ['usr_door_103', 'usr_verified_101']
    }
  ];

  return { threads: seedThreads, messages: seedMessages };
}

function saveChatDataToDisk() {
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify({ threads, messages }, null, 2), 'utf8');
  } catch (err) {
    console.error('[ChatManager] Error saving chats_data.json:', err);
  }
}

// Initialize chat data
const initialData = loadChatDataFromDisk();
threads = initialData.threads;
messages = initialData.messages;

// Helper to broadcast message to sockets of target users
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

function broadcastToAll(payload: any) {
  const serialized = JSON.stringify(payload);
  for (const sockets of userSockets.values()) {
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }
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
        {
          userId: user1.id,
          displayName: user1.displayName,
          avatarUrl: user1.avatarUrl,
          platform: user1.platform,
          isOnline: userSockets.has(user1.id),
        },
        {
          userId: user2.id,
          displayName: user2.displayName,
          avatarUrl: user2.avatarUrl,
          platform: user2.platform,
          isOnline: userSockets.has(user2.id),
        }
      ],
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      isOnline: userSockets.has(user2.id),
    };
    threads.unshift(thread);
    saveChatDataToDisk();
  }
  return thread;
}

export function getOrCreatePodThread(pod: Pod): ChatThread {
  const threadId = `thread_pod_${pod.id}`;
  let thread = threads.find(t => t.id === threadId || (t.podId && t.podId === pod.id));

  const memberIds = (pod.members || []).map(m => m.userId || m.id).filter(Boolean);

  if (!thread) {
    thread = {
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
        isOnline: userSockets.has(m.userId || m.id),
      })),
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      isOnline: true,
    };
    threads.unshift(thread);
    saveChatDataToDisk();
  } else {
    // Sync participant ids & profiles if pod members changed
    thread.participantIds = Array.from(new Set([...thread.participantIds, ...memberIds]));
    thread.podName = pod.name || thread.podName;
    thread.name = pod.name || thread.name;
  }
  return thread;
}

export function getThreadsForUser(userId: string, availablePods?: Pod[]): ChatThread[] {
  // Ensure Pod threads exist for all user's pods
  if (availablePods && Array.isArray(availablePods)) {
    for (const pod of availablePods) {
      if (pod && pod.id && pod.members) {
        const isMember = pod.members.some(m => m && (m.userId === userId || m.id === userId));
        if (isMember) {
          getOrCreatePodThread(pod);
        }
      }
    }
  }

  // Filter threads where user is a participant or if it's a general demo pod
  const userThreads = threads.filter(t => {
    if (!t) return false;
    if (t.participantIds && t.participantIds.some(pid => pid === userId || pid.toLowerCase() === userId.toLowerCase())) {
      return true;
    }
    // Also include default demo threads for guest or verified user
    if (t.id === 'thread_pod_metro_riders' || t.id === 'thread_direct_sarah_marcus' || t.id === 'thread_direct_marcus_vance') {
      return true;
    }
    return false;
  });

  // Calculate unread counts and recipient names per user view
  return userThreads.map(t => {
    const threadMessages = messages.filter(m => m.threadId === t.id);
    const unread = threadMessages.filter(m => m.senderId !== userId && !m.readBy?.includes(userId)).length;
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
      lastMessage: lastMsg ? {
        content: lastMsg.content,
        senderName: lastMsg.senderName,
        senderId: lastMsg.senderId,
        createdAt: lastMsg.createdAt,
      } : t.lastMessage,
      updatedAt: lastMsg ? lastMsg.createdAt : t.updatedAt,
    };
  }).sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

export function getMessagesForThread(threadId: string, userId?: string): ChatMessage[] {
  const threadMsgs = messages.filter(m => m.threadId === threadId);
  
  // Auto mark read if userId provided
  if (userId) {
    let hasChanges = false;
    threadMsgs.forEach(m => {
      if (!m.readBy) m.readBy = [];
      if (!m.readBy.includes(userId)) {
        m.readBy.push(userId);
        hasChanges = true;
      }
    });
    if (hasChanges) {
      saveChatDataToDisk();
    }
  }

  return threadMsgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function createMessage(payload: {
  threadId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderPlatform?: string;
  recipientId?: string;
  podId?: string;
  content: string;
  type?: ChatMessage['type'];
  metadata?: Record<string, unknown>;
}): ChatMessage {
  const msg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    threadId: payload.threadId,
    senderId: payload.senderId,
    senderName: payload.senderName || 'Driver',
    senderAvatar: payload.senderAvatar,
    senderPlatform: payload.senderPlatform || 'DoorDash',
    recipientId: payload.recipientId,
    podId: payload.podId,
    content: payload.content,
    type: payload.type || 'TEXT',
    createdAt: new Date().toISOString(),
    readBy: [payload.senderId],
    metadata: payload.metadata,
  };

  messages.push(msg);

  // Update thread's updatedAt and lastMessage
  let thread = threads.find(t => t.id === payload.threadId);
  if (thread) {
    thread.lastMessage = {
      content: msg.content,
      senderName: msg.senderName,
      senderId: msg.senderId,
      createdAt: msg.createdAt,
    };
    thread.updatedAt = msg.createdAt;
    if (payload.recipientId && !thread.participantIds.includes(payload.recipientId)) {
      thread.participantIds.push(payload.recipientId);
    }
    if (!thread.participantIds.includes(payload.senderId)) {
      thread.participantIds.push(payload.senderId);
    }
  }

  saveChatDataToDisk();

  // Broadcast in real-time to all thread participants
  const targetIds = thread ? thread.participantIds : (payload.recipientId ? [payload.recipientId, payload.senderId] : [payload.senderId]);
  broadcastToUsers(targetIds, {
    type: 'RECEIVE_MESSAGE',
    message: msg,
    threadId: msg.threadId,
  });

  return msg;
}

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
    saveChatDataToDisk();
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

// WebSocket Server initialization
export function setupWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let currentUserId: string | null = null;

    ws.on('message', (data) => {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        const parsed = JSON.parse(text);

        switch (parsed.type) {
          case 'AUTH': {
            const { userId, displayName, avatarUrl, platform } = parsed;
            if (!userId) return;

            currentUserId = userId;
            if (!userSockets.has(userId)) {
              userSockets.set(userId, new Set());
            }
            userSockets.get(userId)!.add(ws);
            socketUserMap.set(ws, { userId, displayName, avatarUrl });

            // Acknowledge auth and send presence list
            ws.send(JSON.stringify({
              type: 'AUTH_SUCCESS',
              userId,
              onlineUsers: getOnlineUserIds(),
            }));

            // Broadcast presence to all other connected clients
            broadcastToAll({
              type: 'PRESENCE_UPDATE',
              userId,
              isOnline: true,
              onlineUsers: getOnlineUserIds(),
            });
            break;
          }

          case 'SEND_MESSAGE': {
            const { threadId, content, recipientId, podId, msgType, metadata, senderName, senderAvatar, senderPlatform } = parsed;
            const senderId = currentUserId || parsed.senderId || 'usr_guest';
            if (!threadId || !content) return;

            const newMsg = createMessage({
              threadId,
              senderId,
              senderName: senderName || 'Driver',
              senderAvatar,
              senderPlatform,
              recipientId,
              podId,
              content,
              type: msgType || 'TEXT',
              metadata,
            });

            ws.send(JSON.stringify({
              type: 'MESSAGE_SENT_ACK',
              messageId: newMsg.id,
              threadId,
            }));
            break;
          }

          case 'TYPING': {
            const { threadId, isTyping } = parsed;
            if (!threadId || !currentUserId) return;
            const thread = threads.find(t => t.id === threadId);
            const userMeta = socketUserMap.get(ws);
            if (thread) {
              const otherParticipants = thread.participantIds.filter(id => id !== currentUserId);
              broadcastToUsers(otherParticipants, {
                type: 'USER_TYPING',
                threadId,
                userId: currentUserId,
                displayName: userMeta?.displayName || 'A member',
                isTyping: !!isTyping,
              });
            }
            break;
          }

          case 'MARK_READ': {
            const { threadId } = parsed;
            if (threadId && currentUserId) {
              markThreadMessagesAsRead(threadId, currentUserId);
            }
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            break;
          }
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    });

    ws.on('close', () => {
      if (currentUserId) {
        const userSet = userSockets.get(currentUserId);
        if (userSet) {
          userSet.delete(ws);
          if (userSet.size === 0) {
            userSockets.delete(currentUserId);
            broadcastToAll({
              type: 'PRESENCE_UPDATE',
              userId: currentUserId,
              isOnline: false,
              onlineUsers: getOnlineUserIds(),
            });
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
