// Members choose their delivery/rideshare fleet at sign-up, or "Non-essential/Other"
// when they don't work for one. Screens that mention the fleet use these helpers so
// "Other" members never see a fleet named.

import type { GigPlatform } from '../types';

/** Stored value for members who don't work for a delivery/rideshare fleet. */
export const NO_FLEET_PLATFORM: GigPlatform = 'Other';

/** True when the member works for a named fleet (DoorDash, Uber Eats, ...). */
export function hasFleet(platform?: string | null): boolean {
  const p = (platform || '').trim();
  return p !== '' && p !== NO_FLEET_PLATFORM;
}
