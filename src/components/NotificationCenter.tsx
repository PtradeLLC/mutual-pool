import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, CheckCircle2, XCircle, Trash2, ArrowLeftRight, HeartHandshake, 
  DollarSign, Users, AlertCircle, Send, X, MessageSquare
} from 'lucide-react';
import { User, Pod, AppNotification } from '../types';

interface NotificationCenterProps {
  currentUser: User;
  myPods: Pod[];
  onOpenHardshipModal?: (initialTab?: 'hardship' | 'trade') => void;
  onOpenPodDetail?: (podId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  currentUser,
  myPods,
  onOpenHardshipModal,
  onOpenPodDetail,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [respondedStatus, setRespondedStatus] = useState<Record<string, 'ACCEPTED' | 'DECLINED'>>({});

  // Send Intent Modal state inside Notification Center
  const [showSendIntentModal, setShowSendIntentModal] = useState(false);
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [targetMemberUserId, setTargetMemberUserId] = useState<string>('');
  const [intentNote, setIntentNote] = useState<string>('');
  const [sendingIntent, setSendingIntent] = useState(false);
  const [intentSuccess, setIntentSuccess] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const params = new URLSearchParams({
        userId: currentUser.id,
        userEmail: currentUser.email || '',
        userName: currentUser.displayName || '',
      });
      const res = await fetch(`/api/notifications?${params.toString()}`, {
        headers: {
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Graceful fallback during offline or startup
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000); // poll every 8 sec
    return () => clearInterval(interval);
  }, [currentUser.id, currentUser.email, currentUser.displayName]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
      });
      if (res.ok) {
        const deleted = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (deleted && !deleted.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleRespondSwapRequest = async (podId: string, requestId: string, action: 'ACCEPT' | 'DECLINE', e: React.MouseEvent) => {
    e.stopPropagation();
    setRespondingRequestId(requestId);
    try {
      const res = await fetch(`/api/pods/${podId}/swap-request/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setRespondedStatus(prev => ({ ...prev, [requestId]: action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED' }));
        fetchNotifications();
      } else {
        const err = await res.json();
        alert(err.message || err.error || 'Failed to respond to spot trade request');
      }
    } catch (err) {
      console.error('Error responding to swap request:', err);
    } finally {
      setRespondingRequestId(null);
    }
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);

    if (notif.type === 'SWAP_EXECUTED' || notif.type === 'SWAP_REQUESTED') {
      if (onOpenHardshipModal) onOpenHardshipModal('trade');
    } else if (notif.type === 'HARDSHIP_REQUESTED' || notif.type === 'HARDSHIP_APPROVED' || notif.type === 'HARDSHIP_REJECTED') {
      if (onOpenHardshipModal) onOpenHardshipModal('hardship');
    } else if (notif.podId && onOpenPodDetail) {
      onOpenPodDetail(notif.podId);
    }
  };

  const handleSendSwapIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPodId || !targetMemberUserId) return;

    setSendingIntent(true);
    setIntentError(null);
    setIntentSuccess(null);

    try {
      const res = await fetch(`/api/pods/${selectedPodId}/notify-swap-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-email': currentUser.email || '',
          'x-user-name': currentUser.displayName || '',
        },
        body: JSON.stringify({
          targetMemberUserId,
          note: intentNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to send swap intent notice.');
      }

      setIntentSuccess('In-app notification sent successfully to pod member!');
      setTimeout(() => {
        setShowSendIntentModal(false);
        setIntentSuccess(null);
        setIntentNote('');
      }, 1500);
      fetchNotifications();
    } catch (err: any) {
      setIntentError(err.message || 'Error sending swap intent notice');
    } finally {
      setSendingIntent(false);
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDay = Math.floor(diffHour / 24);
      return `${diffDay}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'SWAP_EXECUTED':
        return <ArrowLeftRight className="w-4 h-4 text-emerald-600" />;
      case 'SWAP_REQUESTED':
        return <ArrowLeftRight className="w-4 h-4 text-[#005FB8]" />;
      case 'HARDSHIP_REQUESTED':
        return <HeartHandshake className="w-4 h-4 text-amber-600" />;
      case 'HARDSHIP_APPROVED':
        return <HeartHandshake className="w-4 h-4 text-emerald-600" />;
      case 'HARDSHIP_REJECTED':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      case 'PAYOUT_READY':
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case 'POD_JOINED':
        return <Users className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'unread') return !n.isRead;
    return true;
  });

  const selectedPod = myPods.find((p) => p.id === selectedPodId);
  const eligibleSwapTargetMembers = selectedPod?.members?.filter((m) => {
    if (!m) return false;
    if (m.userId && m.userId === currentUser.id) return false;
    if (m.id && m.id === currentUser.id) return false;
    if (m.email && currentUser.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) return false;
    if (m.displayName && currentUser.displayName && m.displayName.toLowerCase().trim() === currentUser.displayName.toLowerCase().trim()) return false;
    return true;
  }) || [];

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Icon Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          fetchNotifications();
        }}
        className="relative p-2 rounded-xl bg-white hover:bg-gray-100 border border-[#DDE1E6] text-[#374151] transition-colors cursor-pointer shadow-2xs group"
        title="In-App Notifications & Pod Intent Notices"
      >
        <Bell className="w-5 h-5 group-hover:scale-105 transition-transform text-[#111827]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse shadow-xs border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#DDE1E6] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 via-[#005FB8] to-blue-800 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-200" />
              <h3 className="font-bold text-sm">In-App Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  title="Mark all notifications as read"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-blue-200 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Bar & Tabs */}
          <div className="bg-gray-50 p-2.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2 text-xs">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  activeFilter === 'all' ? 'bg-white text-[#005FB8] shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unread')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  activeFilter === 'unread' ? 'bg-white text-[#005FB8] shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notify Swap Intent Button */}
            {myPods.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (myPods.length > 0) {
                    setSelectedPodId(myPods[0].id);
                  }
                  setShowSendIntentModal(true);
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="Send intent notification to a teammate in line for payout"
              >
                <Send className="w-3 h-3" />
                <span>Notify Intent</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-gray-500">
                  {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-gray-400">
                  Updates regarding spot trades, hardship approvals, and pool payouts will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-blue-50/50 ${
                    !notif.isRead ? 'bg-blue-50/30' : 'bg-white'
                  }`}
                >
                  {/* Category Icon */}
                  <div className="p-2 bg-gray-100 rounded-xl shrink-0 mt-0.5">
                    {getNotifIcon(notif.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-xs text-[#111827] truncate">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    {notif.podName && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-[#005FB8] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md truncate max-w-[200px]">
                          {notif.podName}
                        </span>
                      </div>
                    )}

                    {/* Trade Request Accept / Decline Actions */}
                    {notif.type === 'SWAP_REQUESTED' && notif.podId && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const reqId = (notif.metadata?.requestId || notif.metadata?.swapRequestId) as string;
                          const currentStatus = reqId ? respondedStatus[reqId] : undefined;

                          if (currentStatus === 'ACCEPTED') {
                            return (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmed & Accepted
                              </span>
                            );
                          }
                          if (currentStatus === 'DECLINED') {
                            return (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" /> Declined
                              </span>
                            );
                          }

                          if (!reqId) return null;

                          return (
                            <>
                              <button
                                type="button"
                                disabled={respondingRequestId === reqId}
                                onClick={(e) => handleRespondSwapRequest(notif.podId!, reqId, 'ACCEPT', e)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {respondingRequestId === reqId ? 'Saving...' : 'Accept Trade Request'}
                              </button>

                              <button
                                type="button"
                                disabled={respondingRequestId === reqId}
                                onClick={(e) => handleRespondSwapRequest(notif.podId!, reqId, 'DECLINE', e)}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Actions (Unread Indicator / Delete) */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    {!notif.isRead && (
                      <span
                        className="w-2.5 h-2.5 bg-[#005FB8] rounded-full animate-pulse"
                        title="Unread notification"
                      />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="p-1 text-gray-300 hover:text-rose-600 rounded transition-colors"
                      title="Clear notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-2.5 border-t border-[#E5E7EB] text-center">
            <span className="text-[11px] text-gray-500 font-medium">
              Pod Intent & Swap Notifications • Real-time Updates
            </span>
          </div>

        </div>
      )}

      {/* SEND INTENT NOTICE MODAL */}
      {showSendIntentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#DDE1E6] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 via-[#005FB8] to-blue-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Send Spot Swap Intent Notice</h3>
                  <p className="text-[11px] text-blue-100">
                    Notify a pod member in line for payout of your swap request.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSendIntentModal(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSendSwapIntent} className="p-5 space-y-4 text-xs">
              
              {intentSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{intentSuccess}</span>
                </div>
              )}

              {intentError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{intentError}</span>
                </div>
              )}

              {/* Select Pod */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Select Pod
                </label>
                <select
                  value={selectedPodId}
                  onChange={(e) => {
                    setSelectedPodId(e.target.value);
                    setTargetMemberUserId('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-[#DDE1E6] rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-[#005FB8] outline-none"
                >
                  {myPods.map((pod) => (
                    <option key={pod.id} value={pod.id}>
                      {pod.name} ({pod.members?.length || 0} Members)
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Target Member */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Select Member in Line for Payout / Teammate
                </label>
                {eligibleSwapTargetMembers.length === 0 ? (
                  <p className="p-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 italic">
                    No other members in this pod to notify.
                  </p>
                ) : (
                  <select
                    value={targetMemberUserId}
                    onChange={(e) => setTargetMemberUserId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#DDE1E6] rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-[#005FB8] outline-none"
                  >
                    <option value="">-- Choose Member to Notify --</option>
                    {eligibleSwapTargetMembers.map((member) => (
                      <option key={member.id || member.userId || member.displayName} value={member.userId || member.id || member.displayName}>
                        {member.displayName} (Slot #{ (member.rotationIndex ?? 0) + 1 } - Week { (member.rotationIndex ?? 0) + 1 })
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Message / Note */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Intent Message / Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={intentNote}
                  onChange={(e) => setIntentNote(e.target.value)}
                  placeholder="e.g. Hi! I have an upcoming vehicle repair next week and would love to request a spot swap if you're open to it..."
                  className="w-full px-3 py-2 bg-white border border-[#DDE1E6] rounded-xl text-gray-900 focus:ring-2 focus:ring-[#005FB8] outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSendIntentModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={sendingIntent || !targetMemberUserId}
                  className="px-5 py-2 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingIntent ? 'Sending...' : 'Send In-App Notice'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};
