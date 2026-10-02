import test from 'node:test';
import assert from 'node:assert/strict';
import { getUpcomingCycleDates, formatTimeRemaining } from '../src/utils/platformSchedule';

const BASE_URL = 'http://127.0.0.1:3000';

function makeTestUser(prefix: string) {
  const nonce = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  return {
    id: `usr_test_${prefix}_${nonce}`,
    name: `Test ${prefix} ${nonce.slice(-4)}`,
    email: `${prefix}_${nonce}@gigmutual.test`,
    platform: 'DoorDash',
    role: 'RIDER',
  };
}

function getUserHeaders(user: ReturnType<typeof makeTestUser>) {
  return {
    'content-type': 'application/json',
    'x-user-id': user.id,
    'x-user-name': user.name,
    'x-user-email': user.email,
    'x-user-kyc-status': 'VERIFIED',
    'x-user-account-age-days': '180',
    'x-user-completed-pods-count': '2',
    'x-user-platform': user.platform,
    'x-user-role': user.role,
  };
}

test('1. Pod Creation Flow: POST /api/pods creates a new savings pod as expected', async () => {
  const creator = makeTestUser('creator_t1');
  const podPayload = {
    name: `Test Pod 1 - ${Date.now()}`,
    description: 'Automated test pod for deposit and payout verification',
    category: 'DoorDash Drivers Club',
    sizeTier: 20,
    depositTier: 50,
    stewardshipMode: 'MEMBER_HOSTED',
    activationPolicy: 'FLEXIBLE_EARLY',
  };

  const response = await fetch(`${BASE_URL}/api/pods`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify(podPayload),
  });

  if (response.status !== 200) {
    console.error('Test 1 failed with status:', response.status, await response.text());
  }
  assert.equal(response.status, 200, `Expected 200 OK from POST /api/pods, got ${response.status}`);
  const createdPod = await response.json();

  assert.ok(createdPod.id, 'Pod should have a unique ID');
  assert.equal(createdPod.name, podPayload.name);
  assert.equal(createdPod.depositTier, 50);
  assert.equal(createdPod.sizeTier, 20);
  assert.equal(createdPod.status, 'FORMING');
  assert.equal(createdPod.createdBy, creator.id);
  assert.ok(Array.isArray(createdPod.members), 'Pod should have members array');
  assert.equal(createdPod.members.length, 1, 'Creator should be automatically added as first member');
  assert.equal(createdPod.members[0].userId, creator.id);
});

test('2. Member Join, Pod Agreement Signing & Pod Activation', async () => {
  const creator = makeTestUser('creator_t2');
  const member = makeTestUser('member_t2');

  // Step A: Create pod
  const podRes = await fetch(`${BASE_URL}/api/pods`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      name: `Two-Member Test Pod ${Date.now()}`,
      description: 'Pod for testing agreement signing and deposit sweeps',
      category: 'Rideshare & Courier',
      sizeTier: 20,
      depositTier: 20,
      activationPolicy: 'FLEXIBLE_EARLY',
    }),
  });
  assert.equal(podRes.status, 200);
  const pod = await podRes.json();

  // Step B: Creator signs agreement
  const creatorSignRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/agreement/sign`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      signatureName: creator.name,
      confirmedAgreementVersion: 'v2.0-2026',
    }),
  });
  assert.equal(creatorSignRes.status, 200);

  // Step C: Member 2 Joins
  const joinRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/join`, {
    method: 'POST',
    headers: getUserHeaders(member),
    body: JSON.stringify({
      inviteCode: pod.inviteCode,
    }),
  });
  if (joinRes.status !== 200) {
    console.error('Test 2 joinRes failed:', joinRes.status, await joinRes.text());
  }
  assert.equal(joinRes.status, 200);
  const joinedPod = await joinRes.json();
  assert.equal(joinedPod.members.length, 2, 'Pod should now have 2 members');

  // Step D: Member 2 signs agreement with automated Thursday/Friday acknowledgment
  const signRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/agreement/sign`, {
    method: 'POST',
    headers: getUserHeaders(member),
    body: JSON.stringify({
      signatureName: member.name,
      confirmedAgreementVersion: 'v2.0-2026',
    }),
  });
  assert.equal(signRes.status, 200);
  const signResult = await signRes.json();
  assert.equal(signResult.success, true);
  assert.ok(signResult.member.agreementSignedAt, 'Member agreementSignedAt timestamp must be set');
  assert.equal(signResult.member.agreementSignatureName, member.name);

  // Step E: Lock & Activate Pod
  const lockRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/lock`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      forceEarly: true,
    }),
  });
  assert.equal(lockRes.status, 200);
  const lockedPod = await lockRes.json();
  assert.equal(lockedPod.status, 'ACTIVE');
  assert.equal(lockedPod.currentCycleWeek, 1);
});

test('3. Deposits Process: Manual Deposit & Automated Thursday Deposit Sweep', async () => {
  const creator = makeTestUser('creator_t3');
  const member = makeTestUser('member_t3');

  // Step A: Create pod
  const podRes = await fetch(`${BASE_URL}/api/pods`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      name: `Deposit Test Pod ${Date.now()}`,
      category: 'DoorDash Drivers Club',
      sizeTier: 20,
      depositTier: 50,
      activationPolicy: 'FLEXIBLE_EARLY',
    }),
  });
  assert.equal(podRes.status, 200);
  const pod = await podRes.json();

  // Creator signs
  await fetch(`${BASE_URL}/api/pods/${pod.id}/agreement/sign`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      signatureName: creator.name,
      confirmedAgreementVersion: 'v2.0-2026',
    }),
  });

  // Member joins & signs
  const joinRes3 = await fetch(`${BASE_URL}/api/pods/${pod.id}/join`, {
    method: 'POST',
    headers: getUserHeaders(member),
    body: JSON.stringify({ inviteCode: pod.inviteCode }),
  });
  assert.equal(joinRes3.status, 200);

  await fetch(`${BASE_URL}/api/pods/${pod.id}/agreement/sign`, {
    method: 'POST',
    headers: getUserHeaders(member),
    body: JSON.stringify({
      signatureName: member.name,
      confirmedAgreementVersion: 'v2.0-2026',
    }),
  });

  // Lock pod to make it ACTIVE
  const lockRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/lock`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({ forceEarly: true }),
  });
  assert.equal(lockRes.status, 200);

  // Test Manual Member Deposit: POST /api/pods/:id/deposit
  const depositRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/deposit`, {
    method: 'POST',
    headers: getUserHeaders(creator),
  });
  assert.equal(depositRes.status, 200);
  const depositData = await depositRes.json();
  assert.equal(depositData.success, true);
  assert.equal(depositData.deposit.amount, 50);
  assert.equal(depositData.deposit.status, 'COMPLETE');

  // Test Automated Thursday Deposit Sweep: POST /api/platform/schedule/sweep
  const sweepRes = await fetch(`${BASE_URL}/api/platform/schedule/sweep`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sweepType: 'THURSDAY_DEPOSITS',
    }),
  });
  assert.equal(sweepRes.status, 200);
  const sweepData = await sweepRes.json();
  assert.equal(sweepData.success, true);
  assert.equal(sweepData.sweepType, 'THURSDAY_DEPOSITS');
  assert.ok(sweepData.result.executedAt, 'Sweep should record executedAt timestamp');
  assert.ok(sweepData.result.activePodsEvaluated >= 1, 'Should evaluate active pods');
});

test('4. Withdrawal & Payout Process: Friday Payout Sweep & Treasury Bank Withdrawal', async () => {
  const creator = makeTestUser('creator_t4');
  const member = makeTestUser('member_t4');

  // Create an active pod for payout testing
  const podRes = await fetch(`${BASE_URL}/api/pods`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      name: `Payout Test Pod ${Date.now()}`,
      category: 'General Gig Workers',
      sizeTier: 20,
      depositTier: 50,
      activationPolicy: 'FLEXIBLE_EARLY',
    }),
  });
  assert.equal(podRes.status, 200);
  const pod = await podRes.json();

  await fetch(`${BASE_URL}/api/pods/${pod.id}/agreement/sign`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      signatureName: creator.name,
      confirmedAgreementVersion: 'v2.0-2026',
    }),
  });

  const joinRes4 = await fetch(`${BASE_URL}/api/pods/${pod.id}/join`, {
    method: 'POST',
    headers: getUserHeaders(member),
    body: JSON.stringify({ inviteCode: pod.inviteCode }),
  });
  assert.equal(joinRes4.status, 200);

  await fetch(`${BASE_URL}/api/pods/${pod.id}/agreement/sign`, {
    method: 'POST',
    headers: getUserHeaders(member),
    body: JSON.stringify({
      signatureName: member.name,
      confirmedAgreementVersion: 'v2.0-2026',
    }),
  });

  const lockRes = await fetch(`${BASE_URL}/api/pods/${pod.id}/lock`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({ forceEarly: true }),
  });
  assert.equal(lockRes.status, 200);

  // Trigger Friday Payout Sweep: POST /api/platform/schedule/sweep
  const payoutSweepRes = await fetch(`${BASE_URL}/api/platform/schedule/sweep`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sweepType: 'FRIDAY_PAYOUTS',
    }),
  });
  assert.equal(payoutSweepRes.status, 200);
  const payoutSweepData = await payoutSweepRes.json();
  assert.equal(payoutSweepData.success, true);
  assert.equal(payoutSweepData.sweepType, 'FRIDAY_PAYOUTS');
  assert.ok(payoutSweepData.result.executedAt);

  // Fetch updated pod to verify rotation recipient received payout
  const updatedPodRes = await fetch(`${BASE_URL}/api/pods/${pod.id}`, {
    headers: getUserHeaders(creator),
  });
  const updatedPod = await updatedPodRes.json();
  const recipient = (updatedPod.members || []).find((m: any) => m.rotationIndex === 0);
  assert.ok(recipient, 'Recipient member at rotation index 0 should exist');
  assert.equal(recipient.hasReceivedPayout, true, 'Recipient should have hasReceivedPayout = true');
  assert.ok(recipient.payoutStripeTransferId, 'Recipient should have a Stripe transfer ID recorded');

  // Test Treasury Payout Withdrawal to External Bank: POST /api/treasury/payouts/withdraw
  const withdrawRes = await fetch(`${BASE_URL}/api/treasury/payouts/withdraw`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': recipient.userId,
      'x-user-name': recipient.displayName,
    },
    body: JSON.stringify({
      amount: 25,
      podId: pod.id,
    }),
  });
  if (withdrawRes.status !== 200) {
    console.error('Test 4 withdrawRes failed:', withdrawRes.status, await withdrawRes.text());
  }
  assert.equal(withdrawRes.status, 200);
  const withdrawData = await withdrawRes.json();
  assert.equal(withdrawData.success, true);
  assert.equal(withdrawData.amountWithdrawn, 25);
  assert.ok(withdrawData.withdrawTransferId, 'Should have generated an outbound withdrawal transfer ID');
});

test('5. Upcoming Payments & Payment History Endpoints & Schedule Calculations', async () => {
  const creator = makeTestUser('creator_t5');

  // Test Schedule Status endpoint
  const scheduleRes = await fetch(`${BASE_URL}/api/platform/schedule`);
  assert.equal(scheduleRes.status, 200);
  const scheduleData = await scheduleRes.json();
  assert.equal(scheduleData.weeklyDepositDay, 'THURSDAY');
  assert.equal(scheduleData.weeklyDepositTime, '12:00 AM');
  assert.equal(scheduleData.weeklyPayoutDay, 'FRIDAY');
  assert.equal(scheduleData.weeklyPayoutTime, '12:00 AM');
  assert.ok(scheduleData.nextDepositDate, 'Should return next Thursday deposit date');
  assert.ok(scheduleData.nextPayoutDate, 'Should return next Friday payout date');

  // Create a pod and deposit for creator to have historical items
  const podRes = await fetch(`${BASE_URL}/api/pods`, {
    method: 'POST',
    headers: getUserHeaders(creator),
    body: JSON.stringify({
      name: `History Pod ${Date.now()}`,
      category: 'General Gig Workers',
      sizeTier: 20,
      depositTier: 20,
      activationPolicy: 'FLEXIBLE_EARLY',
    }),
  });
  assert.equal(podRes.status, 200);

  // Test Payment History endpoint: GET /api/user/payment-history
  const historyRes = await fetch(`${BASE_URL}/api/user/payment-history`, {
    headers: {
      'x-user-id': creator.id,
      'x-user-name': creator.name,
    },
  });
  assert.equal(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert.equal(historyData.success, true);
  assert.ok(Array.isArray(historyData.history), 'History should be an array');
  assert.ok(historyData.history.length > 0, 'User should have recorded deposits and/or payouts');

  const sampleItem = historyData.history[0];
  assert.ok(sampleItem.id, 'History item must have an id');
  assert.ok(sampleItem.type === 'DEPOSIT' || sampleItem.type === 'PAYOUT', 'Type must be DEPOSIT or PAYOUT');
  assert.ok(sampleItem.amount > 0, 'Amount must be positive');
  assert.ok(sampleItem.status, 'Status must exist');
  assert.ok(sampleItem.date, 'Date must exist');
  assert.ok(sampleItem.description, 'Description must exist');

  // Test getUpcomingCycleDates(3) utility
  const fixedNow = new Date('2026-10-02T12:00:00Z'); // Friday afternoon
  const upcomingCycles = getUpcomingCycleDates(3, fixedNow);

  assert.equal(upcomingCycles.length, 3, 'Should generate exactly 3 upcoming cycle pairs');
  upcomingCycles.forEach((cycle, idx) => {
    assert.equal(cycle.cycleIndex, idx);
    assert.ok(cycle.thursdayDate instanceof Date);
    assert.ok(cycle.fridayDate instanceof Date);
    // Thursday is day 4 of week, Friday is day 5
    assert.equal(cycle.thursdayDate.getDay(), 4, 'Thursday date must fall on Thursday (day 4)');
    assert.equal(cycle.fridayDate.getDay(), 5, 'Friday date must fall on Friday (day 5)');
    assert.ok(cycle.thursdayIso);
    assert.ok(cycle.fridayIso);
    assert.ok(cycle.label);
  });

  const countdown = formatTimeRemaining(3600000 * 25);
  assert.ok(countdown.formatted.includes('d') || countdown.formatted.includes('h'), 'Countdown formatting should format hours/days');
});
