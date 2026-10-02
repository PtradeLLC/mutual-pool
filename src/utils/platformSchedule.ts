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

export interface UpcomingCyclePair {
  cycleIndex: number; // 0, 1, 2
  label: string; // e.g. "Week 1: Immediate Settlement", "Week 2: Following Week", "Week 3: 3-Week Horizon"
  thursdayDate: Date;
  thursdayIso: string;
  thursdayFormatted: string; // e.g. "Thu, Oct 8, 2026"
  fridayDate: Date;
  fridayIso: string;
  fridayFormatted: string; // e.g. "Fri, Oct 9, 2026"
  isCurrentActiveWeek: boolean;
  msUntilThursday: number;
  msUntilFriday: number;
}

export function getUpcomingCycleDates(count: number = 3, now: Date = new Date()): UpcomingCyclePair[] {
  const currentDay = now.getDay();
  let baseThursday: Date;

  if (currentDay === 4) {
    // Thursday: today at 00:00:00
    baseThursday = new Date(now);
    baseThursday.setHours(0, 0, 0, 0);
  } else if (currentDay < 4) {
    // Sun(0), Mon(1), Tue(2), Wed(3): upcoming Thursday this week
    const daysToThu = 4 - currentDay;
    baseThursday = new Date(now);
    baseThursday.setDate(now.getDate() + daysToThu);
    baseThursday.setHours(0, 0, 0, 0);
  } else {
    // Fri(5), Sat(6): next Thursday
    const daysToThu = (4 - currentDay + 7);
    baseThursday = new Date(now);
    baseThursday.setDate(now.getDate() + daysToThu);
    baseThursday.setHours(0, 0, 0, 0);
  }

  const baseFriday = new Date(baseThursday);
  baseFriday.setDate(baseThursday.getDate() + 1);
  baseFriday.setHours(0, 0, 0, 0);

  const labels = [
    'Week 1: Immediate Settlement',
    'Week 2: Following Week',
    'Week 3: 3-Week Horizon'
  ];

  const dateOptions: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  };

  const cycles: UpcomingCyclePair[] = [];
  for (let i = 0; i < count; i++) {
    const thu = new Date(baseThursday.getTime() + i * 7 * 86400000);
    const fri = new Date(baseFriday.getTime() + i * 7 * 86400000);

    cycles.push({
      cycleIndex: i,
      label: labels[i] || `Week ${i + 1}`,
      thursdayDate: thu,
      thursdayIso: thu.toISOString(),
      thursdayFormatted: thu.toLocaleDateString('en-US', dateOptions),
      fridayDate: fri,
      fridayIso: fri.toISOString(),
      fridayFormatted: fri.toLocaleDateString('en-US', dateOptions),
      isCurrentActiveWeek: i === 0 && currentDay === 4,
      msUntilThursday: Math.max(0, thu.getTime() - now.getTime()),
      msUntilFriday: Math.max(0, fri.getTime() - now.getTime()),
    });
  }

  return cycles;
}

