import React, { useState, useMemo } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Logo } from './Logo';
import { 
  X, Search, HelpCircle, ChevronDown, ChevronUp, ShieldCheck, 
  Coins, Sparkles, Bot, Lock, ArrowRightLeft, Gift, Phone, 
  CheckCircle2, AlertCircle, RefreshCw, Cpu, Layers, DollarSign
} from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenContact?: () => void;
  onOpenHowItWorks?: () => void;
  initialCategory?: string;
}

export type FaqCategory = 
  | 'ALL'
  | 'BASICS'
  | 'CREATOR_REWARDS'
  | 'DEPOSITS_PAYOUTS'
  | 'AI_CUSTODIAN_ESCROW'
  | 'SECURITY_FDIC'
  | 'AD_CAMPAIGNS'
  | 'VOICE_ASSISTANT';

interface FaqItem {
  id: string;
  category: FaqCategory;
  questionKey: string;
  questionDefault: string;
  answerDefault: React.ReactNode;
  tags: string[];
}

export const FaqModal: React.FC<FaqModalProps> = ({
  isOpen,
  onClose,
  onOpenContact,
  onOpenHowItWorks,
  initialCategory = 'ALL'
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>(initialCategory as FaqCategory);
  const [expandedId, setExpandedId] = useState<string | null>('faq_rosca_basics');

  const categories: { id: FaqCategory; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'ALL', label: 'All Questions', icon: HelpCircle },
    { id: 'BASICS', label: 'Basics & ROSCAs', icon: Layers },
    { id: 'CREATOR_REWARDS', label: 'Creator Host Rewards (3%)', icon: Sparkles },
    { id: 'DEPOSITS_PAYOUTS', label: 'Deposits, Payouts & Fees', icon: Coins },
    { id: 'AI_CUSTODIAN_ESCROW', label: 'AI Custodian & System Escrow', icon: Bot },
    { id: 'SECURITY_FDIC', label: 'FDIC & KYC Security', icon: ShieldCheck },
    { id: 'AD_CAMPAIGNS', label: 'Brand Gear & Extra Earnings', icon: Gift },
  ];

  const faqList: FaqItem[] = useMemo(() => [
    {
      id: 'faq_rosca_basics',
      category: 'BASICS',
      questionKey: 'faq.roscaBasics_q',
      questionDefault: 'What is MutualPool and how does a Mutual Savings Pod work?',
      tags: ['rosca', 'tanda', 'susu', 'pardna', 'basics', 'rotation', 'payout', 'pool'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>MutualPool</strong> is a modernized peer-to-peer <strong>Rotating Savings and Credit Association (ROSCA)</strong>—known culturally worldwide as a <em>tanda, susu, pardna, arisan, or chit fund</em>—built specifically for independent delivery drivers, couriers, and freelance gig workers.
          </p>
          <p>
            Members join a pod and contribute a fixed weekly deposit (e.g., <strong>$20.00/week</strong>). Each week, one member in the scheduled rotation receives the entire collective lump-sum pot (e.g., <strong>$400.00 gross / $360.00 net</strong> for a 20-member pod). By the end of the 20-week cycle, every single member has received one full lump-sum payout.
          </p>
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 font-medium">
            💡 <strong>Key Advantage:</strong> 0% interest, 0 predatory compounding fees, and no bank loan debt. You save together with verified peers and unlock lump-sum capital for vehicle repairs, tax reserves, or emergency savings.
          </div>
        </div>
      )
    },
    {
      id: 'faq_loan_difference',
      category: 'BASICS',
      questionKey: 'faq.loanDiff_q',
      questionDefault: 'Is MutualPool a loan, credit card, or bank?',
      tags: ['loan', 'credit', 'interest', 'bank', 'debt', 'score', 'credit check'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>No! MutualPool is neither a lender nor a credit card company.</strong> There is <strong>zero interest</strong>, no compounding debt, and no minimum credit score requirement. 
          </p>
          <p>
            Instead of borrowing from a predatory payday lender, you are pooling your own hard-earned income with verified community peers. Every dollar paid into the rotation comes directly from your earnings or Stripe Treasury balance.
          </p>
        </div>
      )
    },
    {
      id: 'faq_trusted_vs_open',
      category: 'BASICS',
      questionKey: 'faq.trustedVsOpen_q',
      questionDefault: 'What is the difference between a "Trusted Circle" and an "Open Pod"?',
      tags: ['trusted circle', 'open pod', 'private', 'public', 'invitation', 'eligibility'],
      answerDefault: (
        <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1">
              <strong className="text-blue-950 font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-700" />
                Trusted Circle (Private)
              </strong>
              <p className="text-blue-900">
                Created by you for people you know (family, friends, regional delivery hub coworkers). Accessible only via private link or invite code. Perfect for close-knit gig crews.
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 space-y-1">
              <strong className="text-slate-950 font-bold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-700" />
                Open Pod (Public)
              </strong>
              <p className="text-slate-800">
                Open to any verified MutualPool driver. To create an Open Pod, creators must have completed at least 1 full cycle with 100% on-time deposit history.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'faq_creator_skin_in_game',
      category: 'CREATOR_REWARDS',
      questionKey: 'faq.skinInGame_q',
      questionDefault: 'Why is the Pod Creator placed in the final rotation slot (Skin-in-the-Game)?',
      tags: ['creator', 'skin in the game', 'final slot', 'last turn', 'security', 'default protection'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            To prevent fraud and protect all participating members, MutualPool enforces an architectural <strong>"Skin-in-the-Game" Guarantee</strong>:
          </p>
          <p>
            In traditional unmonitored circles, bad actors might start a group, take Turn #1 to collect an early lump-sum payout, and then disappear without making subsequent weekly payments. By <strong>pinning the Creator to the final rotation slot (Turn #N)</strong>, the Creator has direct skin in the game and stays committed to ensuring all weekly cycles complete successfully.
          </p>
          <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-950 font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
            <span>In exchange for taking the last slot, Creators receive the <strong>3% Host Stewardship Reward</strong>!</span>
          </div>
        </div>
      )
    },
    {
      id: 'faq_creator_host_reward',
      category: 'CREATOR_REWARDS',
      questionKey: 'faq.hostReward_q',
      questionDefault: 'How does the 3% Creator Host Stewardship Reward work?',
      tags: ['host reward', 'creator fee', '3%', '10%', 'payout fee', 'passive earnings', 'compensation'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            As compensation for hosting the pod and waiting until the final rotation turn, active Pod Creators earn a <strong>3% Host Stewardship Reward</strong> on every teammate payout throughout the circle (disbursed out of the 10% Payout Service Fee).
          </p>
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1.5 font-mono text-[11px]">
            <div className="font-bold text-emerald-950 font-sans">Example on a 20-Member Pod ($20/wk, $400 Pool):</div>
            <div className="flex justify-between text-slate-700">
              <span>Gross Collective Pool:</span>
              <span className="font-bold">$400.00</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Recipient Net Payout (90%):</span>
              <span className="font-bold text-emerald-700">$360.00</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Total 10% Payout Service Fee:</span>
              <span>-$40.00</span>
            </div>
            <div className="pt-1.5 border-t border-emerald-200 flex justify-between text-emerald-900 font-bold">
              <span>🎉 Creator Host Reward (3%):</span>
              <span>+$12.00 / payout</span>
            </div>
            <div className="flex justify-between text-slate-600 text-[10px]">
              <span>🏛️ Platform Treasury & Reserves (7%):</span>
              <span>$28.00 / payout</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-600">
            Over 19 teammate payouts, the Creator earns <strong>$228.00 in cumulative host rewards</strong> credited directly to their Stripe Treasury balance!
          </p>
        </div>
      )
    },
    {
      id: 'faq_invite_expiration_flexible',
      category: 'CREATOR_REWARDS',
      questionKey: 'faq.inviteExpiration_q',
      questionDefault: 'What happens if a pod does not fill up before the invite window expires?',
      tags: ['invite window', 'expiration', 'flexible launch', 'start early', 'capacity', 'auto open'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            When creating a pod, the Creator selects an <strong>Invite Window</strong> (3, 7, 14, or 30 days) and an expiration action:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
            <li><strong>Auto-Open to Public:</strong> Remaining vacant spots automatically open to KYC-verified drivers across the MutualPool network.</li>
            <li><strong>Keep Waiting:</strong> The circle remains strictly private while you send more direct invites.</li>
          </ul>
          <p>
            Additionally, with <strong>Flexible Early Launch</strong>, the Creator can lock the rotation and begin weekly payout cycles as soon as <strong>2 or more members</strong> have joined, without waiting for the full 20 slots. Weekly payouts dynamically scale to match the active member count.
          </p>
        </div>
      )
    },
    {
      id: 'faq_deposits_collection',
      category: 'DEPOSITS_PAYOUTS',
      questionKey: 'faq.depositsCollection_q',
      questionDefault: 'How are weekly deposits collected?',
      tags: ['deposit', 'payment', 'direct debit', 'stripe treasury', 'automatic', 'bank'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Deposits are collected automatically each week on the scheduled cycle cutoff date. You can fund your deposits using:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Stripe Treasury Account Balance:</strong> Funds available in your verified MutualPool Treasury wallet.</li>
            <li><strong>Linked Bank Account (ACH Direct Debit):</strong> Backed by Plaid / Stripe Financial Connections.</li>
            <li><strong>Brand Campaign Daily Courier Earnings:</strong> Daily wages earned from verified brand delivery shifts can automatically offset weekly pod contributions.</li>
          </ol>
        </div>
      )
    },
    {
      id: 'faq_payout_fee_explained',
      category: 'DEPOSITS_PAYOUTS',
      questionKey: 'faq.payoutFee_q',
      questionDefault: 'What are the platform fees and where does the money go?',
      tags: ['fees', '5%', '10%', 'service fee', 'cost', 'treasury', 'charges'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool charges transparent, simple service fees with zero hidden compounding interest:
          </p>
          <ul className="space-y-2 text-[11px]">
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Initial Deposit Fee (5%):</strong> Applied only to your initial deposit when creating or joining a pod to initialize your FDIC-insured Stripe Treasury financial account.
            </li>
            <li className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <strong>Payout Service Fee (10%):</strong> Deducted when a lump-sum payout is disbursed to the rotation recipient (e.g., $40 on a $400 pool $\rightarrow$ $360 net payout).
              <div className="mt-1 text-[10px] text-slate-600">
                • <strong>3%</strong> is disbursed to the active Pod Creator as a Host Stewardship Reward.<br />
                • <strong>7%</strong> funds MutualPool Treasury operations, the First-Cycle Contingency Reserve, and FDIC compliance.
              </div>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_payout_execution',
      category: 'DEPOSITS_PAYOUTS',
      questionKey: 'faq.payoutExecution_q',
      questionDefault: 'How and when do I receive my lump-sum payout?',
      tags: ['payout', 'withdrawal', 'transfer', 'turn', 'schedule', 'earmarked'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            When your scheduled rotation week arrives, the full net lump-sum (e.g. <strong>$360.00</strong>) is instantly transferred directly into your <strong>Stripe Treasury Financial Account</strong>.
          </p>
          <p>
            Once deposited in Treasury:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
            <li>You can withdraw funds immediately to your linked external bank via Stripe OutboundTransfer.</li>
            <li>You can keep the balance in Treasury to automatically cover future pod deposits or earn interest.</li>
            <li><strong>Subsequent rotation weeks never wait, pause, or block for delayed withdrawals.</strong></li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_missed_deposit_default',
      category: 'AI_CUSTODIAN_ESCROW',
      questionKey: 'faq.missedDeposit_q',
      questionDefault: 'What happens if a member misses a weekly deposit or defaults?',
      tags: ['missed payment', 'default', 'contingency buffer', 'welcome match', 'grace period', 'replacement'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool has a multi-layered safety net to ensure that weekly rotation recipients <strong>always receive their 100% full payout on time</strong>:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
            <li><strong>72-Hour Grace Period:</strong> Members receive automated reminders to clear overdue deposits without penalty.</li>
            <li><strong>First-Cycle Contingency Buffer (Welcome Match):</strong> In Cycle 1, MutualPool's platform-funded Welcome Match covers the missing deposit so the rotation is not interrupted.</li>
            <li><strong>Delinquent Member Replacement:</strong> If a member fails to resolve their balance, their spot is opened as an urgent replacement for verified drivers.</li>
            <li><strong>System Deposits Escrow Account:</strong> The platform automatically backstops any remaining shortfall so the weekly payout is never delayed.</li>
          </ol>
        </div>
      )
    },
    {
      id: 'faq_autonomous_custodian',
      category: 'AI_CUSTODIAN_ESCROW',
      questionKey: 'faq.autonomousCustodian_q',
      questionDefault: 'What is the Autonomous AI Custodian Protocol (Lainie)?',
      tags: ['lainie', 'ai custodian', 'autonomous', 'stewardship', 'creator default', 'zero burden'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            If a Pod Creator experiences hardship, misses deposits, or defaults, rather than forcing administrative stress or debt collection onto other members, the platform triggers the <strong>Autonomous AI Custodian Protocol</strong>:
          </p>
          <div className="p-3 bg-purple-900 text-white rounded-xl space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 font-bold text-purple-200 text-xs">
              <Bot className="w-4 h-4 text-purple-300" />
              <span>🤖 Lainie AI Assumes Pod Custodianship</span>
            </div>
            <p className="text-purple-200/90">
              Lainie takes over all pod operations, rotation locking, and automated weekly payouts with <strong>zero administrative burden on members</strong>.
            </p>
            <p className="text-purple-200/80 text-[10px]">
              • Creator forfeits their 3% Host Reward.<br />
              • The full 10% Payout Service Fee is redirected into the <strong>System Deposits Escrow Account</strong> to backstop future member payouts.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'faq_system_escrow',
      category: 'AI_CUSTODIAN_ESCROW',
      questionKey: 'faq.systemEscrow_q',
      questionDefault: 'What is the System Deposits Escrow Account?',
      tags: ['system escrow', 'liquidity', 'advance', 'reserve', 'shortfall', 'guarantee'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            The <strong>System Deposits Escrow Account</strong> is a central platform liquidity reserve managed by MutualPool. 
          </p>
          <p>
            If a pod has a vacant spot or an uncollected deposit, the System Escrow advances the required weekly deposit (e.g. <strong>$20.00</strong>) on behalf of the pod. This guarantees that rotation recipients receive 100% of their scheduled lump sum without waiting for replacement members to join.
          </p>
        </div>
      )
    },
    {
      id: 'faq_hardship_relief',
      category: 'AI_CUSTODIAN_ESCROW',
      questionKey: 'faq.hardshipRelief_q',
      questionDefault: 'What if I experience personal or financial hardship during an active cycle?',
      tags: ['hardship', 'emergency', 'pause', 'accident', 'medical', 'relief'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            We understand gig work can be unpredictable due to vehicle breakdowns, accidents, or medical emergencies.
          </p>
          <p>
            Members can submit a <strong>Financial Hardship Relief Request</strong> directly from their pod screen. The platform can grant an extended deposit grace period, activate contingency coverage, or gracefully transition the pod without damaging your platform standing.
          </p>
        </div>
      )
    },
    {
      id: 'faq_fdic_insurance',
      category: 'SECURITY_FDIC',
      questionKey: 'faq.fdicInsurance_q',
      questionDefault: 'Are my savings and pod balances FDIC insured?',
      tags: ['fdic', 'insurance', 'stripe treasury', '$250,000', 'bank protection', 'safety'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>Yes!</strong> All MutualPool funds and pod holding accounts reside in dedicated <strong>Stripe Treasury Financial Accounts</strong> backed by FDIC member institutions (such as Evolve Bank & Trust or Fifth Third Bank, N.A.).
          </p>
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Deposits qualify for <strong>pass-through FDIC insurance up to $250,000 per member</strong> against bank failure.</span>
          </div>
        </div>
      )
    },
    {
      id: 'faq_kyc_verification',
      category: 'SECURITY_FDIC',
      questionKey: 'faq.kyc_q',
      questionDefault: 'Why do I need to complete Stripe Identity (KYC) verification?',
      tags: ['kyc', 'identity', 'stripe identity', 'verification', 'compliance', 'security'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Under federal banking regulations (Bank Secrecy Act / Anti-Money Laundering) and Stripe Treasury policies, identity verification is legally required to establish financial holding accounts.
          </p>
          <p>
            Verification also safeguards our gig community by ensuring every pool participant is a real, authenticated individual—protecting everyone against fraud and duplicate accounts.
          </p>
        </div>
      )
    },
    {
      id: 'faq_slot_swap',
      category: 'SECURITY_FDIC',
      questionKey: 'faq.slotSwap_q',
      questionDefault: 'Can I swap my rotation payout spot if I have an emergency?',
      tags: ['swap', 'reprioritize', 'trade slot', 'emergency', 'rotation order', 'peer swap'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            <strong>Yes!</strong> If you need an earlier payout for an unexpected expense (such as a tire replacement or transmission repair), you can send a <strong>Peer Rotation Swap Request</strong> to another member in your pod.
          </p>
          <p>
            Once the other member accepts the swap request in their app, your rotation positions trade automatically with zero manual paperwork.
          </p>
        </div>
      )
    },
    {
      id: 'faq_ad_campaigns_apparel',
      category: 'AD_CAMPAIGNS',
      questionKey: 'faq.adCampaigns_q',
      questionDefault: 'How do Brand Partner Sponsorship Campaigns work?',
      tags: ['brand', 'campaign', 'sponsor', 'hoodie', 'delivery bag', 'daily wage', 'extra earnings'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            MutualPool partners with leading lifestyle and beverage brands to sponsor gig couriers.
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 pl-1">
            <li><strong>Free Sponsor Apparel:</strong> Approved couriers receive premium weatherproof hoodies, insulated delivery bags, and t-shirts.</li>
            <li><strong>Daily Supplemental Wages:</strong> Earn <strong>$55.00 to $75.00/day</strong> in guaranteed payouts disbursed directly to your Stripe Treasury account.</li>
            <li><strong>Pod Deposit Discount:</strong> Active ambassadors receive up to <strong>$50/month off</strong> their weekly Pod deposits!</li>
          </ul>
        </div>
      )
    },
    {
      id: 'faq_gear_vision_verification',
      category: 'AD_CAMPAIGNS',
      questionKey: 'faq.gearVerification_q',
      questionDefault: 'How are courier brand shifts and gear verified?',
      tags: ['vision', 'ai verification', 'gps', 'shift checkin', 'photo', 'proof'],
      answerDefault: (
        <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
          <p>
            Couriers simply snap a selfie wearing their sponsor gear at the start of their delivery route. 
          </p>
          <p>
            Our multi-modal <strong>AI Vision engine</strong> verifies that the partner gear is properly worn, while GPS tracks active route mileage during campaign hours. Once verified, daily wages are released instantly to your Stripe Treasury wallet.
          </p>
        </div>
      )
    }
  ], []);

  // Filter FAQ items
  const filteredFaqs = useMemo(() => {
    return faqList.filter(item => {
      // Category check
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      // Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuestion = item.questionDefault.toLowerCase().includes(query);
        const matchesTags = item.tags.some(tag => tag.toLowerCase().includes(query));
        return matchesQuestion || matchesTags;
      }
      return true;
    });
  }, [faqList, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[88vh] overflow-y-auto space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close FAQ"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="border-b border-[#DDE1E6] pb-5 space-y-2">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-xs font-mono font-extrabold text-[#005FB8] uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-[#005FB8]" />
              <span>Help Center & Knowledge Base</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-[#4B5563]">
            Everything you need to know about Mutual Savings Pods, the 3% Creator Host Reward, FDIC pass-through security, and Autonomous AI Custodianship.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions by keyword (e.g. Creator Reward, FDIC, Defaults, Lainie AI, Fees, Payouts)..."
            className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005FB8] focus:ring-1 focus:ring-[#005FB8] transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#005FB8] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* FAQ List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-sm text-slate-800">No matching questions found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try searching for a different keyword or browse through the category filters above.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
                className="mt-2 text-xs font-bold text-[#005FB8] hover:underline cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isExpanded 
                      ? 'border-[#005FB8]/40 bg-white shadow-xs' 
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                    className="w-full p-4 text-left flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                        isExpanded ? 'bg-[#005FB8] text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        Q
                      </div>
                      <span className="font-bold text-xs sm:text-sm text-[#111827] leading-snug">
                        {faq.questionDefault}
                      </span>
                    </div>
                    <div className="shrink-0 text-slate-400 mt-0.5">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#005FB8]" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      {faq.answerDefault}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Support Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5 text-center sm:text-left">
            <div className="font-bold text-slate-900">Still have questions?</div>
            <p className="text-slate-600 text-[11px]">
              Our driver support fleet team and Voice AI Assistant are available 24/7.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenHowItWorks && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenHowItWorks(); }}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                View Rules
              </button>
            )}
            {onOpenContact && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenContact(); }}
                className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Contact Help Desk</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
