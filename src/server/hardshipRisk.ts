// Risk scoring for Financial Hardship Fund requests.
//
// An approved hardship request puts platform money into a pod's pot, which
// members can later withdraw. The main abuse is collusion: a pod creator and a
// member (or the creator's own second account) repeatedly using hardship
// requests to pull platform money. The score is advisory: it is shown to the
// administrator who must approve every request.

export type HardshipRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface HardshipRiskInput {
  // This member's earlier hardship requests in pods run by the same creator
  // (excluding rejected ones).
  priorRequestsWithSameCreator: number;
  // This member's earlier hardship requests anywhere (excluding rejected ones).
  priorRequestsTotal: number;
  // Hardship requests approved in this creator's pods over the last 90 days,
  // for other members.
  creatorRecentApprovals: number;
  // Completed deposits the member has made into this pod.
  memberDepositsInPod: number;
  accountAgeDays: number;
  // The requester is the pod's creator (approval hands the pod to the
  // platform-funded autonomous custodian).
  requesterIsCreator: boolean;
}

export interface HardshipRiskAssessment {
  score: number;
  level: HardshipRiskLevel;
  reasons: string[];
}

export function assessHardshipRisk(input: HardshipRiskInput): HardshipRiskAssessment {
  let score = 0;
  const reasons: string[] = [];

  if (input.priorRequestsWithSameCreator > 0) {
    score += Math.min(60, 40 * input.priorRequestsWithSameCreator);
    reasons.push(`Repeat pair: ${input.priorRequestsWithSameCreator} earlier hardship request(s) in pods run by the same creator`);
  }
  const elsewhere = input.priorRequestsTotal - input.priorRequestsWithSameCreator;
  if (elsewhere > 0) {
    score += Math.min(30, 15 * elsewhere);
    reasons.push(`${elsewhere} earlier hardship request(s) in other pods`);
  }
  if (input.creatorRecentApprovals > 0) {
    score += Math.min(30, 10 * input.creatorRecentApprovals);
    reasons.push(`Creator's pods had ${input.creatorRecentApprovals} approved hardship request(s) in the last 90 days`);
  }
  if (input.memberDepositsInPod < 2) {
    score += 20;
    reasons.push(`Member has made only ${input.memberDepositsInPod} deposit(s) into this pod`);
  }
  if (input.accountAgeDays < 90) {
    score += 10;
    reasons.push(`Account is ${input.accountAgeDays} day(s) old`);
  }
  if (input.requesterIsCreator) {
    score += 15;
    reasons.push('Requester is the pod creator: approval hands the pod to platform-funded custody');
  }

  score = Math.min(100, score);
  const level: HardshipRiskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  return { score, level, reasons };
}
