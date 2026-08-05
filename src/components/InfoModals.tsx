import React, { useState } from 'react';
import { Logo } from './Logo';
import { 
  X, ShieldCheck, Users, Heart, Award, CheckCircle2, 
  HelpCircle, Scale, Clock, Lock, AlertCircle, Phone, 
  Mail, MessageSquare, Send, Building2, Sparkles, MapPin, ExternalLink,
  Gift, RefreshCw, Zap, Layers, FileText
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* 1. ABOUT US MODAL                                                         */
/* -------------------------------------------------------------------------- */
interface AboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutUsModal: React.FC<AboutUsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[82vh] overflow-y-auto space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block">Company & Mission</span>
            <h3 className="text-xl font-bold text-[#111827]">About MutualPool</h3>
          </div>
        </div>

        {/* Core Mission Statement */}
        <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-[#005FB8] font-bold text-sm">
            <Heart className="w-4 h-4 fill-current" />
            <span>Built By Drivers, For Drivers</span>
          </div>
          <p className="text-xs text-[#374151] leading-relaxed">
            MutualPool was founded to solve a critical issue faced by 15+ million independent delivery and ride-share workers: unpredictable cash flow and unexpected vehicle repair costs that can instantly wipe out a week's earnings.
          </p>
        </div>

        {/* Key Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-[#111827]">Pass-Through FDIC</h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              Partnered with Stripe Treasury to provide pass-through FDIC insurance up to $250,000 per driver account.
            </p>
          </div>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
            <Scale className="w-5 h-5 text-[#005FB8]" />
            <h4 className="font-bold text-[#111827]">0% Interest ROSCAs</h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              Traditional peer-to-peer rotating savings. You put in $20/week for 20 weeks and receive 1 full $400 lump payout. No interest, no fees.
            </p>
          </div>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold text-[#111827]">Fleet Collective Perks</h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              Negotiated bulk fleet discounts saving members 15-20% on gas, tires, oil changes, and tax prep tools.
            </p>
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#111827]">Fleet Integration Coverage</h4>
          <p className="text-xs text-[#6B7280]">
            Our platform supports verified gig workers across all major delivery and rideshare networks:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {['DoorDash', 'Uber Eats', 'Lyft', 'Instacart', 'Amazon Flex', 'Walmart Spark', 'Grubhub'].map((platform) => (
              <span key={platform} className="px-3 py-1 rounded-lg bg-gray-100 text-[#374151] font-medium border border-gray-200">
                {platform}
              </span>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-[#DDE1E6] flex items-center justify-between text-xs text-[#6B7280]">
          <span>Headquarters: San Francisco, CA & Remote Fleet Hubs</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#005FB8] hover:bg-[#004C93] text-white font-bold rounded-lg transition-colors shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};


/* -------------------------------------------------------------------------- */
/* 2. HOW IT WORKS & RULES MODAL                                              */
/* -------------------------------------------------------------------------- */
interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[82vh] overflow-y-auto space-y-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="border-b border-[#DDE1E6] pb-5 space-y-2">
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
              Official Platform Governance
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            How It Works & Rules
          </h2>
          <p className="text-sm text-[#4B5563]">
            Everything you need to know about how pools work, how payouts are decided, and how your money is protected.
          </p>
        </div>

        {/* Highlight Feature: Welcome Match & First-Cycle Contingency Buffer */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 space-y-3 text-xs shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black text-sm text-emerald-950">
              <Sparkles className="w-5 h-5 text-emerald-600 fill-emerald-600/30 shrink-0" />
              <span>Founding Member Welcome Match & First-Cycle Contingency Buffer</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-700 text-white uppercase tracking-wider">
              100% Platform Funded
            </span>
          </div>
          <p className="text-emerald-900 leading-relaxed text-xs">
            To build immediate platform trust and de-risk early savings cycles, Mutual Pool puts its own treasury funds behind your pod creation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-1">
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">🎁 $20 First Deposit Match</strong>
              <p className="text-emerald-800">
                When a verified KYC member creates their first pod, Mutual Pool matches their first deposit up to $20.00.
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">🛡️ Pod Contingency Buffer</strong>
              <p className="text-emerald-800">
                The match goes directly into your pod's non-withdrawable <strong>First-Cycle Contingency Buffer</strong> to cover any missed member deposits.
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">🔒 Fair & Secure Rules</strong>
              <p className="text-emerald-800">
                Gated behind verified KYC identity. Limited to 1 lifetime match per account to prevent gaming or pod farming.
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">🏦 Direct Treasury Backing</strong>
              <p className="text-emerald-800">
                Funded entirely from Mutual Pool marketing/treasury budget — never from other members' deposits.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: The Two Kinds of Pods */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Users className="w-5 h-5 text-[#005FB8]" />
            <h3>The Two Kinds of Pods</h3>
          </div>
          <p className="text-xs text-[#6B7280]">
            Every pod is one of two types. You choose which one when you create it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Trusted Circle */}
            <div className="p-5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#005FB8] text-sm flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  <span>🔒 Trusted Circle</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#005FB8]">Default</span>
              </div>
              <p className="text-[#374151] leading-relaxed">
                A Trusted Circle is built from people you already know — contacts from your phone, email, or social invites. When you create a pod, we check which of your contacts are already members and invite the rest to join.
              </p>
              <ul className="space-y-1.5 text-[#4B5563] list-disc list-inside text-[11px]">
                <li>Only people you invite can join.</li>
                <li>If your circle doesn't fill the pod within your set invite window, you can choose to open remaining spots to verified members outside your circle, or keep waiting.</li>
                <li><strong>Best for:</strong> Friends, family, coworkers, people from your delivery hub or driver group — anyone you'd trust to show up every week.</li>
              </ul>
            </div>

            {/* Open Pod */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#111827] text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#005FB8]" />
                  <span>🌐 Open Pod</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-[#374151]">Automated Match</span>
              </div>
              <p className="text-[#374151] leading-relaxed">
                An Open Pod is open to any verified member on the platform looking for a pod at that size and deposit tier.
              </p>
              <ul className="space-y-1.5 text-[#4B5563] list-disc list-inside text-[11px]">
                <li>Matching is automatic — we fill your pod with verified members based on availability.</li>
                <li>Every member you're matched with has completed identity verification, and you can see their track record before the pod locks.</li>
                <li>Requires having completed at least one full Trusted Circle cycle first with no missed payments.</li>
                <li><strong>Best for:</strong> Members who don't have 20+ people in their network yet, or who want a pod to fill faster.</li>
              </ul>
            </div>

          </div>
        </div>

        {/* Section 2: How Pods Work */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Layers className="w-5 h-5 text-[#005FB8]" />
            <h3>How Pods Work</h3>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Pool Creation:</strong> Any member can create a pod.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Starting size:</strong> New accounts can create pods at the 20-member or 50-member size to start.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Starting deposit tiers:</strong> New pods can be created at the $5, $10, or $20 deposit tier to start.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Growing your limits:</strong> Larger pod sizes (100, 500, 1,000, 5,000, 10,000 members) and higher deposit tiers ($50, $100) unlock after you've completed a full pod cycle successfully, with no missed payments, over at least 3 months.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>One tier per pod:</strong> Every member in a pod deposits the same amount, on the same schedule. You can't mix deposit tiers within a single pod.
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Invitations:</strong> Pod creators invite members via contacts, shareable links, or social media (Trusted Circle), or the pod fills automatically (Open Pod).
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: How Your Money is Held */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3>How Your Money is Held</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Individually Held Accounts</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                Your deposits sit in your own individually held account, not in one shared pot controlled by another person. No single member ever holds or controls anyone else's money.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>FDIC Pass-Through Insurance</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                Funds held in your account are eligible for FDIC pass-through insurance up to $250,000 per member through Stripe Treasury banking partners.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Locked Once Deposited</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                Once you deposit into a cycle, that deposit can't be withdrawn or canceled. It's released automatically to that week's recipient.
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>No Interest (0% Fee)</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                Deposits don't earn interest. Every dollar you put in comes back to you as your full payout when it's your turn — no more, no less.
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: How Payout Order Works */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Clock className="w-5 h-5 text-[#005FB8]" />
            <h3>How Payout Order Works</h3>
          </div>

          <p className="text-xs text-[#4B5563]">
            We know "who gets picked" is the most important part of this — here's exactly how it works, with no randomness involved once your pod is locked in.
          </p>

          <ul className="space-y-2 text-xs text-[#374151]">
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>Order is set once, when your pod locks</strong> (i.e., when it reaches full membership). We randomize the order one time, and that becomes the fixed schedule for the entire cycle.
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>Every week, the full pool goes to whoever is next in that fixed order.</strong> There's no re-drawing, no weekly lottery, and no chance involved after your pod locks — you'll always know roughly when your turn is coming.
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>Once you've received your payout, you're not eligible again</strong> until every other member of your pod has had their turn.
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>Need your turn moved up?</strong> You can request early payout for a documented emergency. Requests go through a review process — either a pod-wide vote or an admin review — and every decision is logged and visible to the pod.
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>Want to trade spots?</strong> Two members can agree to swap their positions in the order at any time, no review needed — just mutual consent.
            </li>
          </ul>
        </div>

        {/* Section 5: Missed Payments & Pod Agreement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
          
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
            <h4 className="font-bold text-[#111827] flex items-center gap-1.5 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>If a Payment is Missed</span>
            </h4>
            <ul className="space-y-1.5 text-[#374151] list-disc list-inside text-[11px]">
              <li>A missed weekly deposit is flagged immediately and the member is marked delinquent with a 24-hour grace window.</li>
              <li><strong>First-Cycle Contingency Buffer:</strong> For new pods, the platform-funded $20 Welcome Match buffer automatically covers missed deposit gaps during Cycle 1 to ensure payout continuity.</li>
              <li>Your pod's signed agreement spells out backup rules if the buffer is exhausted: whether remaining members cover the gap, payout is adjusted, or delinquent members are replaced.</li>
              <li>Repeated missed payments affect your ability to join or create pods in the future, including Open Pods.</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
            <h4 className="font-bold text-[#111827] flex items-center gap-1.5 text-sm">
              <FileText className="w-4 h-4 text-[#005FB8]" />
              <span>The Pod Agreement</span>
            </h4>
            <p className="text-[#374151] text-[11px]">
              Before any pod locks and its first cycle begins, every member reviews and signs a plain-language agreement covering:
            </p>
            <ul className="space-y-1 text-[#374151] list-disc list-inside text-[11px]">
              <li>The fixed payout order and how it was set</li>
              <li>No guaranteed return and no interest</li>
              <li>Welcome Match rules and First-Cycle Contingency Buffer governance</li>
              <li>How reprioritization requests and slot swaps work</li>
              <li>What happens if someone misses a payment</li>
              <li>A link to the current insurance disclosure</li>
            </ul>
          </div>

        </div>

        {/* Section 6: Perks & Benefits Marketplace */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Gift className="w-5 h-5 text-amber-600" />
            <h3>Perks & Benefits</h3>
          </div>

          <p className="text-xs text-[#4B5563]">
            Being a member gets you more than access to your pod — it also unlocks a marketplace of real-world benefits built for delivery riders and drivers.
          </p>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3 text-xs">
            <div>
              <h4 className="font-bold text-[#111827] mb-2">Browse & Search Categories:</h4>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Healthcare', 'Dental', 'Vision', 'Retirement plans', 'Training opportunities', 
                  'Legal assistance', 'Mental health resources', 'Financial services', 'Discounts', 
                  'Entertainment offers', 'Restaurants', 'Hotels', 'Retail savings', 
                  'Insurance programs', 'Scholarships', 'Family benefits', 'Emergency assistance'
                ].map((cat) => (
                  <span key={cat} className="px-2.5 py-1 rounded-md bg-white border border-[#DDE1E6] text-[11px] text-[#374151] font-medium shadow-2xs">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200 text-[11px]">
              <div>
                <strong>Where they come from:</strong> Some perks are added directly by our team; others are submitted by outside partners and reviewed before they go live, so you can trust that everything listed is legitimate.
              </div>
              <div>
                <strong>Eligibility:</strong> Most perks are open to all verified members. Some may require a bit more — like having completed a full pod cycle — and we'll always show you exactly what's needed before you try to redeem.
              </div>
              <div>
                <strong>How to redeem:</strong> Find a perk, tap redeem, and depending on the offer you'll get a promo code, a direct link, or a voucher. Your redemption history is saved so you can find it again anytime.
              </div>
              <div>
                <strong>New perks added regularly:</strong> We're always adding new categories and partners. Member requests directly shape what we add next.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-[#DDE1E6] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <span>MutualPool Governance & Rules • Stripe Treasury Protected</span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#005FB8] hover:bg-[#004C93] text-white font-bold rounded-xl transition-colors shadow-xs w-full sm:w-auto"
          >
            I Understand the Rules
          </button>
        </div>

      </div>
    </div>
  );
};


/* -------------------------------------------------------------------------- */
/* 3. CONTACT US MODAL                                                        */
/* -------------------------------------------------------------------------- */
interface ContactUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactUsModal: React.FC<ContactUsModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('DRIVER_SUPPORT');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#DDE1E6] rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-[#111827] my-auto max-h-[82vh] overflow-y-auto space-y-5">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block">24/7 Fleet Help Desk</span>
            <h3 className="text-xl font-bold text-[#111827]">Contact MutualPool Support</h3>
          </div>
        </div>

        {submitted ? (
          <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center space-y-3 my-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-lg font-bold text-[#111827]">Message Received!</h4>
            <p className="text-xs text-[#4B5563]">
              Thanks, {name || 'Driver'}! Our fleet support specialist will reach out to <strong>{email || 'your email'}</strong> within 2 hours.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setMessage('');
                onClose();
              }}
              className="px-4 py-2 bg-[#005FB8] text-white font-bold text-xs rounded-lg shadow-xs"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Quick Contact Direct Lines */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#111827]">
                  <Phone className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>24/7 Driver Line</span>
                </div>
                <p className="text-[#6B7280] text-[11px] font-mono">1-800-GIG-POOL</p>
              </div>

              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#111827]">
                  <Mail className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>Email Support</span>
                </div>
                <p className="text-[#6B7280] text-[11px] font-mono">support@mutualpool.org</p>
              </div>
            </div>

            {/* Interactive Support Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. marcus.vance@example.com"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  Inquiry Topic
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                >
                  <option value="DRIVER_SUPPORT">General Driver Assistance</option>
                  <option value="PAYOUT_TREASURY">Stripe Treasury & Payouts</option>
                  <option value="SWAP_REQUEST">Emergency Slot Swap Inquiry</option>
                  <option value="FLEET_PERKS">Gas & Fleet Perks Partnering</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  Message / Question
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Inquiry</span>
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
};
