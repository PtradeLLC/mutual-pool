import { PlatformScheduleStatus, SettlementPhase } from '../types';

export const PLATFORM_SCHEDULE_CONFIG = {
  depositDayName: 'Thursday',
  depositTimeLabel: '12:00 AM Midnight',
  depositTargetDay: 4, // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  depositTargetHour: 0,
  depositTargetMinute: 0,

  payoutDayName: 'Friday',
  payoutTimeLabel: '12:00 AM Midnight',
  payoutTargetDay: 5,
  payoutTargetHour: 0,
  payoutTargetMinute: 0,

  settlementBufferHours: 24, // 24-Hour window between Thursday 00:00 and Friday 00:00
  timezone: 'America/New_York (Eastern)',
};

/**
 * Returns the upcoming Thursday 12:00 AM Midnight Date relative to `from`
 */
export function getNextThursdayMidnight(from: Date = new Date()): Date {
  const target = new Date(from);
  target.setHours(0, 0, 0, 0);
  const currentDay = from.getDay();
  let daysUntilThursday = (4 - currentDay + 7) % 7;
  
  // If today is Thursday and current time is past 00:00:00, jump to next week
  if (daysUntilThursday === 0 && from.getTime() >= target.getTime()) {
    daysUntilThursday = 7;
  }
  target.setDate(target.getDate() + daysUntilThursday);
  return target;
}

/**
 * Returns the upcoming Friday 12:00 AM Midnight Date relative to `from`
 */
export function getNextFridayMidnight(from: Date = new Date()): Date {
  const target = new Date(from);
  target.setHours(0, 0, 0, 0);
  const currentDay = from.getDay();
  let daysUntilFriday = (5 - currentDay + 7) % 7;
  
  // If today is Friday and current time is past 00:00:00, jump to next week
  if (daysUntilFriday === 0 && from.getTime() >= target.getTime()) {
    daysUntilFriday = 7;
  }
  target.setDate(target.getDate() + daysUntilFriday);
  return target;
}

/**
 * Calculates human-readable breakdown of milliseconds remaining
 */
export function formatTimeRemaining(msRemaining: number): {
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
} {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let formatted = '';
  if (days > 0) {
    formatted += `${days}d `;
  }
  formatted += `${hours}h ${minutes}m`;

  return { days, hours, minutes, formatted };
}

/**
 * Computes complete real-time PlatformScheduleStatus
 */
export function getPlatformScheduleStatus(now: Date = new Date()): PlatformScheduleStatus {
  const nextThursday = getNextThursdayMidnight(now);
  const nextFriday = getNextFridayMidnight(now);

  const msUntilDeposit = Math.max(0, nextThursday.getTime() - now.getTime());
  const msUntilPayout = Math.max(0, nextFriday.getTime() - now.getTime());

  // Determine current settlement phase:
  // - Between Thursday 00:00:00 and Friday 00:00:00 -> SETTLEMENT_BUFFER
  // - Between Friday 00:00:00 and Friday 02:00:00 -> PAYOUT_DISBURSING
  // - Rest of the week -> COLLECTION_PENDING
  const dayOfWeek = now.getDay();
  let currentPhase: SettlementPhase = 'COLLECTION_PENDING';
  let phaseLabel = 'Active Week Accumulation';
  let phaseDescription = 'Members deposit commitments accumulating. Next sweep scheduled for Thursday 12:00 AM.';

  if (dayOfWeek === 4) { // Thursday
    currentPhase = 'SETTLEMENT_BUFFER';
    phaseLabel = '24-Hour Settlement & Clearing Window';
    phaseDescription = 'Thursday deposits swept into escrow. 24-hour verification & payment retry grace active before Friday payout.';
  } else if (dayOfWeek === 5 && now.getHours() < 3) { // Friday early morning
    currentPhase = 'PAYOUT_DISBURSING';
    phaseLabel = 'Friday Payout Settlement Window';
    phaseDescription = 'Rotating lump-sum disbursements actively transferring to rotation recipients\' Stripe Treasury accounts.';
  }

  return {
    weeklyDepositDay: 'THURSDAY',
    weeklyDepositTime: '12:00 AM',
    weeklyPayoutDay: 'FRIDAY',
    weeklyPayoutTime: '12:00 AM',
    timezone: PLATFORM_SCHEDULE_CONFIG.timezone,
    nextDepositDate: nextThursday.toISOString(),
    nextPayoutDate: nextFriday.toISOString(),
    msUntilNextDeposit: msUntilDeposit,
    msUntilNextPayout: msUntilPayout,
    currentPhase,
    phaseLabel,
    phaseDescription,
    activePodsCount: 0,
    totalWeeklyTargetVolumeUsd: 0,
  };
}
