// The Privacy Policy and Terms of Service as data, so the same text is rendered
// by the server as standalone HTML pages (/privacy, /terms — linkable from
// Stripe, app stores, email) and by the in-app modals.
//
// Inline markup supported in strings: **bold** and [label](url).
// Shared by the browser and the server: no React, no DOM, no Node APIs.

import { FEES, GOVERNING_LAW_STATE, PRIVACY_VERSION, SUPPORT_EMAIL, TERMS_VERSION } from '../lib/legal';

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  // Paragraph shown after the bullets.
  after?: string;
}

export interface LegalDocument {
  slug: 'privacy' | 'terms';
  title: string;
  heading: string;
  version: string;
  intro: string;
  sections: LegalSection[];
  contact: string;
}

export interface LegalContext {
  entity: string;
  supportEmail?: string;
  retentionYears?: number;
  governingLawState?: string;
  // Only true once member funds are held in Stripe Treasury accounts.
  treasuryEnabled?: boolean;
}

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'link'; text: string; href: string };

// Parse **bold**, [label](url) and bare email addresses into tokens.
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ type: 'bold', text: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: 'link', text: m[2], href: m[3] });
    else tokens.push({ type: 'link', text: m[4], href: `mailto:${m[4]}` });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export function getPrivacyPolicy(ctx: LegalContext): LegalDocument {
  const email = ctx.supportEmail || SUPPORT_EMAIL;
  const years = ctx.retentionYears || 7;
  const custody = ctx.treasuryEnabled
    ? 'Your Treasury balance is held in a Stripe Treasury financial account in your name.'
    : 'Your Treasury balance is our record of funds we hold for you in MutualPool\'s account with Stripe; it is not a bank account in your name.';
  return {
    slug: 'privacy',
    title: 'Privacy Policy',
    heading: 'How MutualPool handles your information',
    version: PRIVACY_VERSION,
    intro: `MutualPool is operated by **${ctx.entity}** ("MutualPool", "we"). This policy explains what we collect when you use the MutualPool app and website, why we collect it, who we share it with, and the choices you have. We don't sell your personal information, and we only collect what the service needs to work.`,
    sections: [
      {
        title: 'Information we collect',
        paragraphs: [
          '**Account details.** When you sign up we collect your name, email address and, if you use them, your phone number or Google profile (name and photo). Sign-in is handled by Firebase Authentication.',
          '**Profile choices.** The gig platform you work for, your city, the name your community uses for a savings circle (for example "Tanda" or "Susu"), the app language you choose and your device\'s language setting.',
          '**Identity and payout details.** Identity verification and bank-account collection are done by Stripe through its secure onboarding. Stripe tells us whether you\'re verified, the name of your bank and the last four digits of the account, and a non-reversible "fingerprint" of the account that we use only to stop the same person opening several accounts. We never see your full bank account number, card number or government ID.',
          '**Bank debit authorization.** Before you create or join a pod you authorize bank debits through Stripe. Stripe gives us a reference to that authorization, the name of the bank and the last four digits and fingerprint of the account you chose, and the status of each debit we request. We use it only to collect amounts you owe under the Terms of Service, and we record each debit in the audit log.',
          `**Payments and balances.** Deposits and withdrawals are processed by Stripe. We keep records of amounts, dates, status and Stripe reference numbers, and we maintain your Treasury balance and transaction history. ${custody}`,
          '**Pod activity.** The pods you create or join, your position in the rotation, deposits, payouts, spot-swap requests and votes, and hardship requests together with the reason you give.',
          '**People you invite.** When you invite someone to a pod we store the name and email address or phone number you enter, so the pod can recognise them if they join. We use it for nothing else, delete it when the pod completes if they never joined, and anyone who was invited can ask us to remove their details at any time.',
          '**Brand-campaign shifts.** If you take part in a sponsored campaign: the photos you take of yourself wearing campaign gear, the start and end times of your shift, the neighbourhood you select, and the results of each gear check. We do not collect your device\'s GPS location; if that ever changes we will update this policy and ask for your permission first.',
          '**Messages and support.** Pod and direct chat messages, questions you ask the Lainie voice guide, and messages you send to support.',
          '**Perks and partners.** Perks you redeem; and, if you submit an offer or a campaign inquiry as a business, the contact details you provide.',
          '**Technical information.** Your IP address and request logs (used for security and rate limiting), browser type, and basic usage records such as sign-in times. We keep an audit log of actions that affect money in a pod.',
        ],
      },
      {
        title: 'How we use it',
        bullets: [
          'To run the service: form pods, collect deposits, make payouts, keep balances and send notifications.',
          'To verify who you are and prevent fraud, including detecting duplicate accounts and reviewing hardship requests for signs of abuse.',
          'To process payments and withdrawals through Stripe.',
          'To confirm you are wearing campaign gear during sponsored shifts, using automated image analysis (see "Automated gear checks and AI").',
          'To answer your questions through support and the voice guide.',
          'To meet legal obligations such as tax reporting, anti-money-laundering rules and responding to lawful requests.',
          'To understand which languages and communities use MutualPool, so we can decide which translations to add. We look at this in aggregate.',
        ],
      },
      {
        title: 'Who we share it with',
        bullets: [
          '**Stripe** — identity verification, bank accounts, deposits, withdrawals. Stripe\'s own privacy policy applies to the information it collects from you directly.',
          '**Google (Firebase)** — sign-in and the database where your account and pod records are stored.',
          '**Google Gemini and Groq** — automated analysis of campaign gear photos and of questions you ask the voice guide.',
          '**Fourthwall** — if sponsored gear is shipped to you, the name and address needed to deliver it.',
          '**Other members of your pod** — they can see your display name, photo, platform, rotation slot, whether you have deposited, and your email address, as pod members need to coordinate with each other. People who are not in your pod see only your display name, photo and platform.',
          '**Brand partners** — for shifts on their campaign, your display name, shift times, neighbourhood and whether gear checks passed. They do not receive your photos, contact details or financial information.',
          '**Our hosting and infrastructure providers** — who process data on our behalf under contract.',
          '**Authorities and advisers** — when the law requires it, to protect members from fraud, or to enforce our agreements.',
        ],
        after: 'We don\'t sell your personal information and we don\'t share it with advertisers for their own marketing.',
      },
      {
        title: 'Automated gear checks and AI',
        paragraphs: [
          'During a sponsored shift the app asks for selfies at random times. Each photo is sent to an automated image-analysis service (Google Gemini, with Groq as a fallback) which reports whether the campaign gear is visible. The result decides whether the shift\'s payout is released. Photos are used only for this purpose and are kept as part of the shift record. Questions you type or speak to the voice guide are sent to Google Gemini to generate an answer, together with basic account context such as your first name and balance. We don\'t use your photos or questions to train our own models.',
          'If you believe an automated gear check was wrong, contact support and a person will review it.',
        ],
      },
      {
        title: 'How long we keep it',
        paragraphs: [
          `Financial records — balances, deposits, payouts, pod membership, identity-verification status and related audit logs — are kept for **${years} years** after the activity, as tax and anti-money-laundering rules require. Chat messages, shift photos and support correspondence are kept while your account is open and for up to one year afterwards, unless they form part of a financial record. If you close your account we delete or anonymise everything else within 90 days.`,
        ],
      },
      {
        title: 'Your choices and rights',
        bullets: [
          'You can see and update your name, photo, platform, city and savings-circle name in Edit Profile, and change your language at any time.',
          'You can ask us for a copy of the personal information we hold about you, ask us to correct it, or ask us to delete it, subject to the retention periods above and to any pod you are still part of.',
          'We send transactional messages (pod activity, payments, verification, shift checks) by in-app notification and email, and by SMS if you signed up with a phone number. You can turn off push notifications in your device settings. We do not send marketing messages without your consent.',
          'Depending on where you live you may have additional rights, such as those under the California Consumer Privacy Act. We honour these for everyone regardless of location.',
        ],
        after: `To make a request, email ${email} from the address on your account. We'll respond within 30 days.`,
      },
      {
        title: 'Cookies and local storage',
        paragraphs: [
          'We don\'t use advertising trackers or third-party analytics cookies. The app stores your preferences (language, country, chosen tradition name) and a cached copy of your pod list in your browser\'s local storage so it loads quickly; you can clear this through your browser. Firebase and Stripe set the cookies they need to keep you signed in and to protect against fraud.',
        ],
      },
      {
        title: 'Where your information is processed',
        paragraphs: [
          'MutualPool runs on servers in the United States, and our providers (Stripe, Google, Groq) process data there and in other countries where they operate. If you use MutualPool from outside the United States, your information will be transferred to and processed in the United States.',
        ],
      },
      {
        title: 'Security',
        paragraphs: [
          'All traffic is encrypted in transit. Card and bank details are entered directly with Stripe and never touch our servers. Access to member data inside MutualPool is restricted to staff who need it, every money-related action is written to an audit log, and we apply rate limits and automated checks against abuse. No system is perfectly secure, so if you suspect your account has been accessed without permission, contact us straight away.',
        ],
      },
      {
        title: 'Children',
        paragraphs: [
          'MutualPool is for people aged 18 and over who work with delivery or rideshare platforms. We don\'t knowingly collect information from anyone under 18; if you believe we have, contact us and we\'ll delete it.',
        ],
      },
      {
        title: 'Changes to this policy',
        paragraphs: [
          'When we change this policy we\'ll update the version at the top and, for significant changes, tell you in the app or by email before they take effect.',
        ],
      },
    ],
    contact: `Questions about privacy: ${email} · ${ctx.entity}`,
  };
}

export function getTermsOfService(ctx: LegalContext): LegalDocument {
  const email = ctx.supportEmail || SUPPORT_EMAIL;
  const state = ctx.governingLawState || GOVERNING_LAW_STATE;
  const balance = ctx.treasuryEnabled
    ? '**Balances are held with Stripe Treasury.** Your Treasury balance is held in a Stripe Treasury financial account in your name, provided by Stripe\'s partner bank.'
    : '**Balances are a record, not a bank deposit.** Your Treasury balance is our record of funds we hold for you in MutualPool\'s account with Stripe. It is not a deposit account in your name and it is not FDIC insured.';
  return {
    slug: 'terms',
    title: 'Terms of Service',
    heading: 'MutualPool Terms of Service',
    version: TERMS_VERSION,
    intro: `These terms are an agreement between you and **${ctx.entity}** ("MutualPool", "we"). By creating an account or using MutualPool you agree to them, to our [Privacy Policy](/privacy), and to the Pod Agreement shown whenever you join a pod. Please read them: they explain what you're committing to when you join a savings pod, how fees work, and what happens if a member stops paying.`,
    sections: [
      {
        title: 'Who can use MutualPool',
        bullets: [
          'You must be at least 18, live in the United States, and work with (or be eligible to work with) a delivery or rideshare platform.',
          'One account per person. We verify identity through Stripe, and we may close duplicate accounts and withhold any benefit obtained through them.',
          'You must give accurate information and keep your sign-in details private. You are responsible for everything done through your account until you tell us it has been compromised.',
          'Businesses that submit perks or run brand campaigns ("partners") accept these terms on behalf of the business (see "Partners and advertisers").',
        ],
      },
      {
        title: 'What MutualPool is, and what it is not',
        paragraphs: [
          'MutualPool is software that lets groups of gig workers run a rotating savings pod: each member deposits the same amount every week, and each week one member receives the pot, in a fixed order, until everyone has had a turn.',
        ],
        bullets: [
          '**Not a bank, lender or investment.** Pods pay no interest and are not investments. We don\'t lend you money (the hardship fund is an advance against your own future payouts, not a loan product).',
          balance,
          '**Not an employer.** Taking part in brand campaigns is as an independent contractor.',
          '**Members rely on each other.** Whether every member of your pod keeps paying is not something we can guarantee; "Missed deposits, defaults and what we may do" explains the protections and their limits.',
        ],
      },
      {
        title: 'Your Treasury balance, deposits and withdrawals',
        bullets: [
          'Deposits are made through Stripe. Funds appear in your balance only after Stripe confirms the payment.',
          'You can withdraw your available balance to the bank account you verified with Stripe. Withdrawals have no MutualPool fee; your bank may take 1–3 business days to post them.',
          'We may hold or reverse funds that are the subject of a chargeback, refund, fraud review or legal requirement, and we may delay withdrawals of recently deposited funds while a payment is still contestable.',
          'Your weekly pod deposits are taken from your balance automatically on the schedule in the Pod Agreement. Keep enough balance to cover them.',
          '**Bank debit authorization.** Before you create or join a pod you authorize MutualPool, through Stripe, to debit your linked bank account for amounts you owe under these terms and your Pod Agreement: a weekly deposit your balance could not cover, anything advanced on your behalf, and the remaining deposits you committed to if you leave or are removed from a pod after receiving its payout. We tell you in the app before each debit. You can revoke the authorization by contacting support; revoking it does not cancel what you owe, and you can\'t create or join pods without it.',
          'If a payment to you was made in error, you agree we may deduct it from your balance or future payouts.',
        ],
      },
      {
        title: 'Pods',
        bullets: [
          'When you create or join a pod you commit to making the weekly deposit for the full length of the cycle (one week per member), even after you have received your payout.',
          'The rotation order is set when the creator locks the pod and cannot be changed except by a mutual swap or a reprioritization vote, both described in the Pod Agreement. Decisions reached that way are binding on all members.',
          'Pod size follows your track record. Until you have completed a pod you can join pods with a total pot of up to $1,000; the limit rises to $2,500 after one completed pod, $5,000 after two, and is removed after three. A pod where you missed a deposit does not count, and an unresolved missed deposit returns you to the first limit until it is settled.',
          'The first half of each rotation goes to the members with the longest track record: completed pods first, then at least 90 days on MutualPool, then newer members. In pods with a pot over $1,000 those slots are only held by members with a completed pod or 90 days\' tenure. A swap or vote can\'t move a member ahead of a more established one in the early half.',
          'The pod creator takes the final payout slot and receives the host reward for doing so; if they trade that slot, the reward goes with it.',
          'You can only leave a pod once every member has received a payout.',
          'A pod is a group of the members in it, not a product we sell. Other members can see your name, photo, platform and payment status within the pod.',
        ],
      },
      {
        title: 'Fees',
        paragraphs: ['These are the only fees MutualPool charges members:'],
        bullets: [
          `**Deposit fee: ${pct(FEES.depositFeeRate)}** of each weekly deposit, charged when the deposit is taken.`,
          `**Payout fee: ${pct(FEES.payoutFeeRate)}** of each rotation payout, deducted before the payout is credited. ${pct(FEES.hostRewardRate)} of the pot goes to the member holding the final slot (normally the creator) as the host reward; the rest goes to MutualPool.`,
          `**Hardship repayment fee: ${pct(FEES.hardshipRepaymentFeeRate)}** of a hardship advance, added when you repay it.`,
        ],
        after: 'We may change fees with at least 30 days\' notice in the app; changes apply to pods that start after the notice period.',
      },
      {
        title: 'Missed deposits, defaults and what we may do',
        bullets: [
          'If your balance can\'t cover a deposit, the pod may draw on its contingency buffer or on MutualPool\'s escrow so the week\'s payout still happens. Any amount advanced on your behalf becomes money you owe.',
          'We may deduct what you owe from your balance, from any future payout in any pod, and, under your bank debit authorization, from your linked bank account.',
          'A member who misses deposits may be given a grace period, removed from the pod, or both, as described in the Pod Agreement.',
          'A member who receives a payout and then stops depositing is in default of this agreement. We may suspend their account, keep any balance to cover the shortfall, pursue the amount owed, and share the default with other members of the pod.',
          'We are not obliged to cover a shortfall caused by another member, and our escrow and contingency buffers are limited and discretionary.',
        ],
      },
      {
        title: 'Hardship advances and the welcome match',
        bullets: [
          'A hardship request asks MutualPool to make one weekly deposit on your behalf. Requests are reviewed by MutualPool, may be declined for any reason, and are limited per pod and per week. An approved advance must be repaid with the hardship repayment fee before you can join or create another pod.',
          'The welcome match is a promotional cushion we may add to a member\'s first pod to cover a missed deposit. It is granted once per person, is never paid out as cash, returns to MutualPool if unused, and may be changed or withdrawn at any time.',
        ],
      },
      {
        title: 'Spot swaps and reprioritization',
        paragraphs: [
          'A swap needs both members\' consent in the app. A reprioritization vote moves the requesting member into the next payout slot if more than half of the pod votes for it, and the member displaced moves to the requester\'s old slot. You accept that a vote can change your position. Members who have already received their payout cannot swap.',
        ],
      },
      {
        title: 'Brand campaigns and shifts',
        bullets: [
          'Campaigns are optional. When you start a shift you act as an independent contractor: you choose when to work, you use your own vehicle and platform accounts, and you are responsible for your own taxes (we may issue tax forms where the law requires).',
          'Pay is the campaign\'s stated daily rate for each shift that is completed and verified. Verification means a passing gear photo when you start, passing responses to the random selfie checks during the shift (each with a 5-minute window), and a passing photo when you finish. A rejected check, or missing more than a quarter of the day\'s checks, means the shift is not paid.',
          'Checks arrive at random times and are only delivered while the app is open. Keep it open during your shift.',
          'Verification is automated. If you believe a check was wrong, contact support within 7 days and a person will review it. Our decision after review is final.',
          'Campaign gear sent to you is for use during campaign shifts. You may keep it when the campaign ends unless the campaign says otherwise.',
          'We don\'t guarantee that shifts or campaigns will be available, and a partner may pause or end a campaign at any time; completed, verified shifts are still paid.',
          'Payment for shifts depends on the partner funding the campaign. We will show each shift\'s payout status in the app.',
        ],
      },
      {
        title: 'Perks',
        paragraphs: [
          'Perks are offers from third-party businesses. We check that a submitted offer looks genuine before listing it, but the business, not MutualPool, is responsible for honouring it, and its own terms apply. If you submit an offer, you confirm you are authorised to and that it is accurate; we may edit or remove listings at any time.',
        ],
      },
      {
        title: 'Things you must not do',
        bullets: [
          'Create more than one account, or an account for someone else.',
          'Coordinate with other members to obtain hardship advances, welcome matches, host rewards or payouts you are not entitled to, or to swing a reprioritization vote.',
          'Sell, trade or promise a rotation slot outside the app\'s swap feature.',
          'Submit photos that are not of you, taken at another time, or altered.',
          'Harass, threaten or deceive other members, in chat or elsewhere.',
          'Interfere with the service, scrape it, or try to access accounts or data that aren\'t yours.',
        ],
        after: 'If you break these rules we may remove you from pods, withhold payouts and rewards obtained by breaking them, freeze your balance while we investigate, and close your account.',
      },
      {
        title: 'Suspension and closing your account',
        bullets: [
          'We may suspend your account or freeze your balance while we investigate suspected fraud, a chargeback or a legal request. We will tell you unless the law prevents it.',
          'You can close your account by emailing support once you are not in an active pod and owe nothing. Your obligations to pods you were in, and amounts you owe, survive closure.',
          'If we close your account, we will pay out your available balance, less anything you owe, to your verified bank account.',
          'Balances untouched for 3 years may be treated as abandoned property under state law.',
        ],
      },
      {
        title: 'Partners and advertisers',
        bullets: [
          'Campaign and perk partners must be legitimate businesses and provide accurate information. Campaign fees are as quoted when a campaign is created; gear orders become non-refundable once sent to production.',
          'Impression and reach figures shown in the app are estimates, not guarantees.',
          'Partners grant MutualPool a licence to display their names, logos and campaign content in the app for the purpose of the campaign or offer.',
        ],
      },
      {
        title: 'Messages from us',
        paragraphs: [
          'We send transactional messages about your account, pods, payments, verification and shifts by in-app notification and email, and by SMS if you signed up with a phone number. Message and data rates may apply. We don\'t send marketing messages without your consent, and you can opt out of any marketing at any time.',
        ],
      },
      {
        title: 'Content and intellectual property',
        paragraphs: [
          'You keep ownership of what you post and upload. You give us permission to use it to run the service, including sharing it with your pod, verifying shifts, and showing a partner that a shift was completed. MutualPool\'s software, design and name belong to us; these terms don\'t give you any rights in them beyond using the app.',
        ],
      },
      {
        title: 'Disclaimers and limits on our liability',
        paragraphs: [
          'MutualPool is provided "as is". We don\'t promise it will be uninterrupted or error-free, that other members will pay, or that campaigns or perks will be available. To the fullest extent the law allows, we are not liable for indirect, incidental or consequential losses, and our total liability to you for any claim is limited to the greater of the fees you paid us in the 12 months before the claim and $100. Nothing in these terms limits liability that can\'t be limited by law, including for our fraud or gross negligence, or your rights as a consumer where they can\'t be waived.',
        ],
      },
      {
        title: 'Indemnity',
        paragraphs: [
          'If your breach of these terms, your default in a pod, or your use of the service causes a claim against MutualPool by another member, a partner or a third party, you agree to cover our reasonable costs and losses from that claim.',
        ],
      },
      {
        title: 'Disputes',
        bullets: [
          `Talk to us first. Email ${email} with the details and we'll try to resolve it within 30 days.`,
          'If we can\'t, any dispute will be resolved by binding individual arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules, except that either side may bring an individual claim in small-claims court. You and MutualPool each waive the right to a jury trial and to bring or join a class or representative action.',
          'You can opt out of arbitration by emailing support within 30 days of first accepting these terms.',
          `These terms are governed by the laws of the State of ${state}, without regard to its conflict-of-law rules.`,
        ],
      },
      {
        title: 'Changes to these terms',
        paragraphs: [
          'When we change these terms we\'ll update the version at the top and ask you to accept the new version in the app before you next move money. If you don\'t agree, you may close your account; terms in force when you joined a pod continue to apply to that pod until it completes.',
        ],
      },
    ],
    contact: `Questions: ${email} · ${ctx.entity}`,
  };
}
