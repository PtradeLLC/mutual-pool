import React, { useState } from 'react';
import { Pod, User } from '../types';
import heroImg from '../assets/images/gig_driver_hero_1784926420728.jpg';
import { Logo } from './Logo';
import { WatchVideoModal } from './WatchVideoModal';
import { 
  ShieldCheck, Users, Wallet, ArrowRight, Gift, Activity, 
  Sparkles, Layers, CheckCircle2, Lock, ChevronRight, HelpCircle, Building2,
  AlertCircle, DollarSign, Clock, RefreshCw, Zap, Play
} from 'lucide-react';

interface LandingPageProps {
  allPods: Pod[];
  onOpenAuth: (mode?: 'LOGIN' | 'REGISTER' | 'DEMO') => void;
  onSelectUser: (user: User) => void;
  onOpenAbout?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenContact?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  allPods,
  onOpenAuth,
  onOpenAbout,
  onOpenHowItWorks,
  onOpenContact,
}) => {
  // Simulator state
  const [calcMembers, setCalcMembers] = useState<number>(20);
  const [calcDeposit, setCalcDeposit] = useState<number>(20);

  // Video Walkthrough Modal State
  const [showWatchVideoModal, setShowWatchVideoModal] = useState(false);

  const totalPoolPayout = calcMembers * calcDeposit;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col font-sans selection:bg-[#005FB8] selection:text-white">
      
      {/* 1. LANDING NAVBAR */}
      <header className="bg-white border-b border-[#DDE1E6] sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#005FB8] border border-blue-200">
              Stripe Treasury
            </span>
          </div>

          {/* Quick Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-xs text-[#4B5563] font-semibold">
            <button
              onClick={onOpenAbout}
              className="hover:text-[#005FB8] transition-colors py-1 px-2 rounded hover:bg-gray-50"
            >
              About Us
            </button>
            <button
              onClick={onOpenHowItWorks}
              className="hover:text-[#005FB8] transition-colors py-1 px-2 rounded hover:bg-gray-50"
            >
              How It Works & Rules
            </button>
            <button
              onClick={onOpenContact}
              className="hover:text-[#005FB8] transition-colors py-1 px-2 rounded hover:bg-gray-50"
            >
              Contact Us
            </button>
          </div>

          {/* Quick Nav Links & Auth CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenAuth('LOGIN')}
              className="px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-xs transition-all shadow-xs"
            >
              Sign In
            </button>

            <button
              onClick={() => onOpenAuth('REGISTER')}
              className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="bg-white border-b border-[#DDE1E6] pt-10 pb-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* LEFT COLUMN: HERO IMAGE & OVERLAY BADGES */}
            <div className="lg:col-span-5 relative order-2 lg:order-1">
              <div className="relative rounded-2xl overflow-hidden border border-[#DDE1E6] shadow-xl bg-[#F8FAFC]">
                <img
                  src={heroImg}
                  alt="Gig delivery driver using mutual savings app"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-[480px] object-cover object-center"
                />
                
                {/* Gradient overlay at bottom for text readability if needed */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

                {/* Floating Badge Top Right */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-[#DDE1E6] rounded-xl p-3 shadow-lg flex items-center gap-2.5 text-xs">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#111827] block text-[11px]">Pass-Through FDIC</span>
                    <span className="text-[10px] text-[#6B7280]">Insured up to $250k</span>
                  </div>
                </div>

                {/* Floating Badge Bottom Left */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-[#DDE1E6] rounded-xl p-3 shadow-lg flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-50 text-[#005FB8] shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-[#111827] block text-[11px]">Fleet Savings Circles</span>
                      <span className="text-[10px] text-[#6B7280]">DoorDash, Uber Eats, Lyft, Instacart</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                    0% Interest
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: HERO TEXT & CTAS */}
            <div className="lg:col-span-7 space-y-6 order-1 lg:order-2 text-left">
              
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-[#005FB8] text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-[#005FB8]" />
                <span>Built for DoorDash, Uber, Lyft, Instacart & Amazon Flex Drivers and more</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-[#111827] tracking-tight leading-tight">
                Money pools, Perks & Benefits built for gig workers
              </h1>

              <p className="text-base sm:text-lg text-[#4B5563] leading-relaxed">
                Pool weekly deposits with your crew and other members — one member gets the full pot each week, on a fair, fixed rotation.
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onOpenAuth('REGISTER')}
                  className="px-6 py-3.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-sm transition-all shadow-xs flex items-center gap-2"
                >
                  <span>Join a Pod Free</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowWatchVideoModal(true)}
                  className="px-6 py-3.5 rounded-xl bg-white hover:bg-gray-50 text-[#111827] border border-[#DDE1E6] font-semibold text-sm transition-all shadow-xs flex items-center gap-2 group"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-[#005FB8] flex items-center justify-center group-hover:bg-[#005FB8] group-hover:text-white transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                  <span>Watch Video</span>
                </button>
              </div>

              {/* Trust Highlights Strip */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-[#111827] block">Create pod & Invite</span>
                  <span className="text-[10px] text-[#6B7280]">Create pods for free and invite friends to participate</span>
                </div>

                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <Lock className="w-4 h-4 text-[#005FB8]" />
                  <span className="text-xs font-bold text-[#111827] block">All deposits are safe</span>
                  <span className="text-[10px] text-[#6B7280]">Every Pod is Safe, Secure & Insured up to $250k via Stripe</span>
                </div>

                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <Gift className="w-4 h-4 text-[#005FB8]" />
                  <span className="text-xs font-bold text-[#111827] block">Perks and Benefits</span>
                  <span className="text-[10px] text-[#6B7280]">Get 15-20% off products & services</span>
                </div>

                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0] space-y-1">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-[#111827] block">Emergency Swap</span>
                  <span className="text-[10px] text-[#6B7280]">Swap payout with other members in community voting</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 3. INTERACTIVE ROSCA CALCULATOR SIMULATOR */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="bg-white border border-[#DDE1E6] rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl mb-8">
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block mb-1">Interactive Calculator</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
              Calculate Your Mutual Pool Payout
            </h2>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
              See how a small weekly commitment turns into lump-sum emergency fund for impromptu financial hardships.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            
            {/* Controls */}
            <div className="space-y-6 bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0]">
              
              {/* Member Tier Selector */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#111827] mb-2">
                  <span>Pod Capacity (Fleet Drivers):</span>
                  <span className="text-[#005FB8] font-mono">{calcMembers} Drivers</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 50, 100, 500].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCalcMembers(num)}
                      className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                        calcMembers === num
                          ? 'bg-[#005FB8] border-[#005FB8] text-white shadow-xs'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {num} Members
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekly Deposit Tier Selector */}
              <div>
                <div className="flex justify-between text-xs font-bold text-[#111827] mb-2">
                  <span>Weekly Deposit Tier:</span>
                  <span className="text-emerald-700 font-mono">${calcDeposit}/week</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCalcDeposit(amt)}
                      className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                        calcDeposit === amt
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      ${amt}/wk
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#6B7280]">
                * ROSCA savings circles operate at 0% interest and 0% administrative fees. You contribute ${calcDeposit}/wk for {calcMembers} weeks (${(calcMembers * calcDeposit).toLocaleString()}) and receive 1 full pool payout of ${(calcMembers * calcDeposit).toLocaleString()}.
              </p>
            </div>

            {/* Live Result Display */}
            <div className="bg-[#005FB8] text-white rounded-xl p-8 space-y-6 shadow-sm relative overflow-hidden">
              <div>
                <span className="text-xs uppercase font-mono font-bold tracking-wider text-blue-200 block mb-1">
                  Guaranteed Single Weekly Payout
                </span>
                <div className="text-4xl sm:text-5xl font-extrabold font-mono tracking-tight">
                  ${totalPoolPayout.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                  <span className="text-base font-normal text-blue-200 ml-2">USD</span>
                </div>
              </div>

              <div className="space-y-3 text-xs border-t border-blue-400/40 pt-4">
                <div className="flex justify-between">
                  <span className="text-blue-100">Weekly Driver Contribution:</span>
                  <span className="font-bold font-mono">${calcDeposit}.00 / week</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-blue-100">Total Cycle Length:</span>
                  <span className="font-bold font-mono">{calcMembers} Weeks</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-blue-100">FDIC Pass-Through Status:</span>
                  <span className="font-bold text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Eligible ($250k Limit)
                  </span>
                </div>
              </div>

              <button
                onClick={() => onOpenAuth('REGISTER')}
                className="w-full py-3 rounded-lg bg-white hover:bg-blue-50 text-[#005FB8] font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <span>Join or Create {calcMembers}-Member Circle</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider">Transparent Architecture</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
            How MutualPool Pods Work
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Digital Rotating Savings and Credit Associations (ROSCAs) engineered specifically for gig workers and delivery driver fleets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-base text-[#111827]">Forming Circle</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Create or Join an open pod in your region or fleet category (DoorDash, Uber Eats, Instacart).
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-base text-[#111827]">Rotation Locking</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              When capacity is reached, a cryptographically random shuffle permanently locks rotation indices.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-base text-[#111827]">Stripe Treasury Payout</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Each week everyone deposits what they can afford. The collected pool then goes into Stripe Treasury holding accounts and transfer the full lump-sum to whoever's next in the rotation.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#DDE1E6] space-y-3 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005FB8] font-bold text-sm flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-base text-[#111827]">Emergency Voting</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Facing sudden transmission or brake failure? Submit a reprioritization request. Members vote to swap payout weeks transparently.
            </p>
          </div>

        </div>
      </section>

      {/* 5. CURRENT FORMING PODS PREVIEW */}
      <section className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block mb-0.5">Live Marketplace</span>
            <h2 className="text-2xl font-extrabold text-[#111827]">
              Open Forming Pods ({allPods.length})
            </h2>
          </div>

          <button
            onClick={() => onOpenAuth('DEMO')}
            className="px-4 py-2 rounded-lg bg-white hover:bg-gray-50 text-[#005FB8] border border-[#DDE1E6] font-bold text-xs flex items-center gap-1.5 shadow-xs"
          >
            <span>Browse All Savings Circles</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allPods.slice(0, 3).map((pod) => (
            <div key={pod.id} className="bg-white border border-[#DDE1E6] rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#005FB8] border border-blue-200">
                    {pod.category}
                  </span>
                  <h3 className="font-bold text-base text-[#111827] mt-1">{pod.name}</h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                  ${pod.weeklyPoolTarget}/wk Pool
                </span>
              </div>

              <p className="text-xs text-[#6B7280] line-clamp-2">
                {pod.description}
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                <div>
                  <span className="text-[#6B7280] text-[10px] block font-medium">Weekly Deposit</span>
                  <span className="font-bold text-[#111827] font-mono">${pod.depositTier}/wk</span>
                </div>
                <div>
                  <span className="text-[#6B7280] text-[10px] block font-medium">Capacity</span>
                  <span className="font-bold text-[#111827] font-mono">{pod.members.length} / {pod.sizeTier} Members</span>
                </div>
              </div>

              <button
                onClick={() => onOpenAuth('LOGIN')}
                className="w-full py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>View & Join Pod</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 6. CALL TO ACTION FOOTER BANNER */}
      <section className="bg-white border-t border-[#DDE1E6] py-12 px-4 sm:px-6 mt-12 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827]">
            Ready to Build Your Emergency Reserve?
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Join thousands of gig workers saving together with Stripe Treasury security and pass-through FDIC insurance.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onOpenAuth('REGISTER')}
              className="px-6 py-3 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2"
            >
              <span>Create Account Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenAuth('LOGIN')}
              className="px-6 py-3 rounded-lg bg-[#F8FAFC] hover:bg-gray-100 text-[#111827] border border-[#DDE1E6] font-semibold text-xs transition-all shadow-xs"
            >
              Sign In to Your Account
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#F8FAFC] border-t border-[#DDE1E6] py-6 text-center text-xs text-[#6B7280]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">         
          <span>© {new Date().getFullYear()} Chris Bitoye Ventures. All rights reserved.</span>
        </div>
      </footer>

      {/* WATCH VIDEO WALKTHROUGH MODAL */}
      <WatchVideoModal
        isOpen={showWatchVideoModal}
        onClose={() => setShowWatchVideoModal(false)}
        onOpenRegister={() => onOpenAuth('REGISTER')}
        onOpenHowItWorks={onOpenHowItWorks}
      />

    </div>
  );
};
