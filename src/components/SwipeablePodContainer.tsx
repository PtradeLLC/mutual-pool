import React, { useState, useRef, useCallback } from 'react';
import { Pod, User } from '../types';
import { PodCard } from './PodCard';
import { PlusCircle, Layers, Users, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../i18n';

interface SwipeablePodContainerProps {
  activeTab: 'my-pods' | 'explore-pods';
  onTabChange: (tab: 'my-pods' | 'explore-pods') => void;
  myPods: Pod[];
  explorePods: Pod[];
  activeUser: User;
  onSelectPod: (pod: Pod, initialTab?: 'rotation' | 'circle' | 'deposits' | 'reprioritize' | 'audit' | 'hardship') => void;
  onJoinPod: (pod: Pod) => void;
  onLeavePod?: (pod: Pod) => void;
  onSignAgreement: (pod: Pod) => void;
  onOpenCreatePod: () => void;
}

export const SwipeablePodContainer: React.FC<SwipeablePodContainerProps> = ({
  activeTab,
  onTabChange,
  myPods,
  explorePods,
  activeUser,
  onSelectPod,
  onJoinPod,
  onLeavePod,
  onSignAgreement,
  onOpenCreatePod,
}) => {
  const { t } = useTranslation();

  // Touch Swipe Gesture State
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  const SWIPE_THRESHOLD = 45; // Pixels required to trigger tab switch
  const VELOCITY_THRESHOLD = 0.3; // px/ms for flick gestures

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    directionLockedRef.current = null;
    setIsDragging(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Detect direction on initial movement
    if (!directionLockedRef.current) {
      if (Math.abs(deltaY) > 8 && Math.abs(deltaY) > Math.abs(deltaX)) {
        directionLockedRef.current = 'vertical';
        return; // Allow native vertical scroll
      }
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        directionLockedRef.current = 'horizontal';
        setIsDragging(true);
      }
    }

    if (directionLockedRef.current === 'horizontal') {
      let offset = deltaX;

      // Apply rubberband resistance if swiping past available bounds
      if (activeTab === 'my-pods' && deltaX > 0) {
        // Can't swipe right on first tab
        offset = deltaX * 0.15;
      } else if (activeTab === 'explore-pods' && deltaX < 0) {
        // Can't swipe left on second tab
        offset = deltaX * 0.15;
      } else {
        // Smooth clamping for active transition direction
        if (offset < -120) offset = -120 + (offset + 120) * 0.2;
        if (offset > 120) offset = 120 + (offset - 120) * 0.2;
      }

      setDragOffset(offset);
    }
  }, [activeTab]);

  const handleTouchEnd = useCallback(() => {
    if (touchStartRef.current && directionLockedRef.current === 'horizontal') {
      const elapsed = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(dragOffset) / Math.max(elapsed, 1);
      const isFlick = velocity > VELOCITY_THRESHOLD && Math.abs(dragOffset) > 25;
      const shouldSwitch = Math.abs(dragOffset) >= SWIPE_THRESHOLD || isFlick;

      if (shouldSwitch) {
        if (activeTab === 'my-pods' && dragOffset < 0) {
          onTabChange('explore-pods');
        } else if (activeTab === 'explore-pods' && dragOffset > 0) {
          onTabChange('my-pods');
        }
      }
    }

    touchStartRef.current = null;
    directionLockedRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, [activeTab, dragOffset, onTabChange]);

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    directionLockedRef.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const isSwipingPastThreshold = Math.abs(dragOffset) >= SWIPE_THRESHOLD;

  return (
    <div className="space-y-4">
      {/* Mobile-Only Segmented Swipe Bar & Indicator (visible on < md screens) */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center justify-between bg-gray-100/90 backdrop-blur-xs p-1 rounded-xl border border-gray-200 shadow-2xs">
          <button
            type="button"
            onClick={() => onTabChange('my-pods')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'my-pods'
                ? 'bg-white text-[#005FB8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{t('dash.myPodsTabTitle')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'my-pods' ? 'bg-blue-50 text-[#005FB8] border border-blue-200' : 'bg-gray-200 text-gray-700'
            }`}>
              {myPods.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('explore-pods')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'explore-pods'
                ? 'bg-white text-[#005FB8] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{t('dash.explorePodsTabTitle')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'explore-pods' ? 'bg-blue-50 text-[#005FB8] border border-blue-200' : 'bg-gray-200 text-gray-700'
            }`}>
              {explorePods.length}
            </span>
          </button>
        </div>

        {/* Mobile Swipe Hint & Dot Pagination Indicators */}
        <div className="flex items-center justify-between px-1 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            {activeTab === 'my-pods' ? (
              <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                <span>{t('dash.swipeLeftToExplore')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-600 font-medium">
                <span>{t('dash.swipeRightToMyPods')}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onTabChange('my-pods')}
              aria-label={t('dash.myPodsTabTitle')}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'my-pods' ? 'w-4 bg-[#005FB8]' : 'w-1.5 bg-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => onTabChange('explore-pods')}
              aria-label={t('dash.explorePodsTabTitle')}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeTab === 'explore-pods' ? 'w-4 bg-[#005FB8]' : 'w-1.5 bg-gray-300'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Header Row for Desktop & Tablet View */}
      <div className="flex items-center justify-between">
        <div>
          {activeTab === 'my-pods' ? (
            <>
              <h3 className="text-lg font-bold text-[#111827]">
                {t('dash.myActivePodsTitle', { count: myPods.length })}
              </h3>
              <p className="text-xs text-[#6B7280]">{t('dash.myActivePodsDesc')}</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-[#111827]">
                {t('dash.exploreOpenPodsTitle', { count: explorePods.length })}
              </h3>
              <p className="text-xs text-[#6B7280]">{t('dash.exploreOpenPodsDesc')}</p>
            </>
          )}
        </div>

        {activeTab === 'my-pods' && (
          <button
            onClick={onOpenCreatePod}
            className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('dash.newPod')}</span>
          </button>
        )}
      </div>

      {/* Swipeable Grid Container */}
      <div
        className="w-full relative touch-pan-y overflow-hidden rounded-xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {/* Dynamic Drag Transition Feedback Indicator */}
        {isDragging && (
          <div
            className={`pointer-events-none absolute top-3 z-30 px-3 py-1 rounded-full text-xs font-bold font-mono transition-opacity shadow-sm flex items-center gap-1.5 ${
              isSwipingPastThreshold ? 'bg-[#005FB8] text-white' : 'bg-gray-800/80 text-white'
            } ${
              dragOffset < 0 ? 'right-3' : 'left-3'
            }`}
          >
            {dragOffset < 0 && activeTab === 'my-pods' && (
              <>
                <span>{isSwipingPastThreshold ? t('dash.releaseToSwitch') : t('dash.explorePodsTabTitle')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
            {dragOffset > 0 && activeTab === 'explore-pods' && (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isSwipingPastThreshold ? t('dash.releaseToSwitch') : t('dash.myPodsTabTitle')}</span>
              </>
            )}
          </div>
        )}

        {/* Animated Inner View Wrapper */}
        <div
          style={{
            transform: dragOffset !== 0 ? `translateX(${dragOffset}px)` : undefined,
            transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.9, 0.4, 1), opacity 0.2s ease',
          }}
          className={`w-full ${isDragging ? 'select-none pointer-events-none' : ''}`}
        >
          {activeTab === 'my-pods' ? (
            myPods.length === 0 ? (
              <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-3 shadow-xs">
                <Layers className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-base font-bold text-[#111827]">{t('dash.noMyPodsTitle')}</h4>
                <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                  {t('dash.noMyPodsDesc')}
                </p>
                <button
                  type="button"
                  onClick={() => onTabChange('explore-pods')}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{t('dash.exploreFormingPodsBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myPods.map((pod) => (
                  <PodCard
                    key={pod.id}
                    pod={pod}
                    currentUser={activeUser}
                    onSelectPod={onSelectPod}
                    onJoinPod={onJoinPod}
                    onLeavePod={onLeavePod}
                    onSignAgreement={onSignAgreement}
                  />
                ))}
              </div>
            )
          ) : (
            explorePods.length === 0 ? (
              <div className="bg-white border border-[#DDE1E6] rounded-xl p-10 text-center space-y-3 shadow-xs">
                <Users className="w-10 h-10 text-gray-400 mx-auto" />
                <h4 className="text-base font-bold text-[#111827]">{t('dash.noExplorePodsTitle')}</h4>
                <p className="text-xs text-[#6B7280] max-w-md mx-auto">
                  {t('dash.noExplorePodsDesc')}
                </p>
                <button
                  type="button"
                  onClick={onOpenCreatePod}
                  className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{t('dash.createPodBtn')}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {explorePods.map((pod) => (
                  <PodCard
                    key={pod.id}
                    pod={pod}
                    currentUser={activeUser}
                    onSelectPod={onSelectPod}
                    onJoinPod={onJoinPod}
                    onLeavePod={onLeavePod}
                    onSignAgreement={onSignAgreement}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
