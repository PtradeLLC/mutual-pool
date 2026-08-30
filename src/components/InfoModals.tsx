import React, { useState } from 'react';
import { Logo } from './Logo';
import { useTranslation } from '../i18n/LanguageContext';
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
  const { t } = useTranslation();
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
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block">{t('aboutModal.badge')}</span>
            <h3 className="text-xl font-bold text-[#111827]">{t('aboutModal.title')}</h3>
          </div>
        </div>

        {/* Core Mission Statement */}
        <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-[#005FB8] font-bold text-sm">
            <Heart className="w-4 h-4 fill-current" />
            <span>{t('aboutModal.builtByDrivers')}</span>
          </div>
          <p className="text-xs text-[#374151] leading-relaxed">
            {t('aboutModal.missionText')}
          </p>
        </div>

        {/* Key Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-[#111827]">{t('aboutModal.fdicTitle')}</h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              {t('aboutModal.fdicDesc')}
            </p>
          </div>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
            <Scale className="w-5 h-5 text-[#005FB8]" />
            <h4 className="font-bold text-[#111827]">{t('aboutModal.roscaTitle')}</h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              {t('aboutModal.roscaDesc')}
            </p>
          </div>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h4 className="font-bold text-[#111827]">{t('aboutModal.perksTitle')}</h4>
            <p className="text-[#6B7280] text-[11px] leading-relaxed">
              {t('aboutModal.perksDesc')}
            </p>
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#111827]">{t('aboutModal.fleetCoverageTitle')}</h4>
          <p className="text-xs text-[#6B7280]">
            {t('aboutModal.fleetCoverageDesc')}
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
          <span>{t('aboutModal.hqFooter')}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#005FB8] hover:bg-[#004C93] text-white font-bold rounded-lg transition-colors shadow-xs"
          >
            {t('aboutModal.closeBtn')}
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
  const { t } = useTranslation();
  if (!isOpen) return null;

  const categories = [
    { key: 'howItWorksModal.cat_healthcare' },
    { key: 'howItWorksModal.cat_dental' },
    { key: 'howItWorksModal.cat_vision' },
    { key: 'howItWorksModal.cat_retirement' },
    { key: 'howItWorksModal.cat_training' },
    { key: 'howItWorksModal.cat_legal' },
    { key: 'howItWorksModal.cat_mental' },
    { key: 'howItWorksModal.cat_financial' },
    { key: 'howItWorksModal.cat_discounts' },
    { key: 'howItWorksModal.cat_entertainment' },
    { key: 'howItWorksModal.cat_restaurants' },
    { key: 'howItWorksModal.cat_hotels' },
    { key: 'howItWorksModal.cat_retail' },
    { key: 'howItWorksModal.cat_insurance' },
    { key: 'howItWorksModal.cat_scholarships' },
    { key: 'howItWorksModal.cat_family' },
    { key: 'howItWorksModal.cat_emergency' }
  ] as const;

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
              {t('howItWorksModal.badge')}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            {t('howItWorksModal.title')}
          </h2>
          <p className="text-sm text-[#4B5563]">
            {t('howItWorksModal.subtitle')}
          </p>
        </div>

        {/* Highlight Feature: Welcome Match & First-Cycle Contingency Buffer */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 space-y-3 text-xs shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-black text-sm text-emerald-950">
              <Sparkles className="w-5 h-5 text-emerald-600 fill-emerald-600/30 shrink-0" />
              <span>{t('howItWorksModal.welcomeMatchBannerTitle')}</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-700 text-white uppercase tracking-wider">
              {t('howItWorksModal.welcomeMatchBannerBadge')}
            </span>
          </div>
          <p className="text-emerald-900 leading-relaxed text-xs">
            {t('howItWorksModal.welcomeMatchBannerDesc')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] pt-1">
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">{t('howItWorksModal.welcomeMatchCard1Title')}</strong>
              <p className="text-emerald-800">
                {t('howItWorksModal.welcomeMatchCard1Desc')}
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">{t('howItWorksModal.welcomeMatchCard2Title')}</strong>
              <p className="text-emerald-800">
                {t('howItWorksModal.welcomeMatchCard2Desc')}
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">{t('howItWorksModal.welcomeMatchCard3Title')}</strong>
              <p className="text-emerald-800">
                {t('howItWorksModal.welcomeMatchCard3Desc')}
              </p>
            </div>
            <div className="p-3 bg-white/90 rounded-xl border border-emerald-200/80 space-y-1">
              <strong className="text-emerald-950 block font-bold">{t('howItWorksModal.welcomeMatchCard4Title')}</strong>
              <p className="text-emerald-800">
                {t('howItWorksModal.welcomeMatchCard4Desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: The Two Kinds of Pods */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Users className="w-5 h-5 text-[#005FB8]" />
            <h3>{t('howItWorksModal.twoKindsTitle')}</h3>
          </div>
          <p className="text-xs text-[#6B7280]">
            {t('howItWorksModal.twoKindsSubtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Trusted Circle */}
            <div className="p-5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#005FB8] text-sm flex items-center gap-1.5">
                  <Lock className="w-4 h-4" />
                  <span>{t('howItWorksModal.trustedCircleTitle')}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#005FB8]">{t('howItWorksModal.trustedCircleBadge')}</span>
              </div>
              <p className="text-[#374151] leading-relaxed">
                {t('howItWorksModal.trustedCircleDesc')}
              </p>
              <ul className="space-y-1.5 text-[#4B5563] list-disc list-inside text-[11px]">
                <li>{t('howItWorksModal.trustedCircleBullet1')}</li>
                <li>{t('howItWorksModal.trustedCircleBullet2')}</li>
                <li><strong>{t('howItWorksModal.bestForLabel')}</strong> {t('howItWorksModal.trustedCircleBullet3')}</li>
              </ul>
            </div>

            {/* Open Pod */}
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#111827] text-sm flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#005FB8]" />
                  <span>{t('howItWorksModal.openPodTitle')}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-[#374151]">{t('howItWorksModal.openPodBadge')}</span>
              </div>
              <p className="text-[#374151] leading-relaxed">
                {t('howItWorksModal.openPodDesc')}
              </p>
              <ul className="space-y-1.5 text-[#4B5563] list-disc list-inside text-[11px]">
                <li>{t('howItWorksModal.openPodBullet1')}</li>
                <li>{t('howItWorksModal.openPodBullet2')}</li>
                <li>{t('howItWorksModal.openPodBullet3')}</li>
                <li><strong>{t('howItWorksModal.bestForLabel')}</strong> {t('howItWorksModal.openPodBullet4')}</li>
              </ul>
            </div>

          </div>
        </div>

        {/* Section 2: How Pods Work */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Layers className="w-5 h-5 text-[#005FB8]" />
            <h3>{t('howItWorksModal.howPodsWorkTitle')}</h3>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('howItWorksModal.poolCreationLabel')}</strong> {t('howItWorksModal.poolCreationDesc')}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('howItWorksModal.startingSizeLabel')}</strong> {t('howItWorksModal.startingSizeDesc')}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('howItWorksModal.startingTiersLabel')}</strong> {t('howItWorksModal.startingTiersDesc')}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('howItWorksModal.growingLimitsLabel')}</strong> {t('howItWorksModal.growingLimitsDesc')}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('howItWorksModal.oneTierLabel')}</strong> {t('howItWorksModal.oneTierDesc')}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>{t('howItWorksModal.invitationsLabel')}</strong> {t('howItWorksModal.invitationsDesc')}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: How Your Money is Held */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3>{t('howItWorksModal.moneyHeldTitle')}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>{t('howItWorksModal.individuallyHeldTitle')}</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                {t('howItWorksModal.individuallyHeldDesc')}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('howItWorksModal.fdicTitle')}</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                {t('howItWorksModal.fdicDesc')}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>{t('howItWorksModal.lockedOnceTitle')}</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                {t('howItWorksModal.lockedOnceDesc')}
              </p>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#111827] flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>{t('howItWorksModal.noInterestTitle')}</span>
              </h4>
              <p className="text-[#374151] text-[11px] leading-relaxed">
                {t('howItWorksModal.noInterestDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: How Payout Order Works */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Clock className="w-5 h-5 text-[#005FB8]" />
            <h3>{t('howItWorksModal.payoutOrderTitle')}</h3>
          </div>

          <p className="text-xs text-[#4B5563]">
            {t('howItWorksModal.payoutOrderSubtitle')}
          </p>

          <ul className="space-y-2 text-xs text-[#374151]">
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>{t('howItWorksModal.payoutOrderItem1Prefix')}</strong> {t('howItWorksModal.payoutOrderItem1')}
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>{t('howItWorksModal.payoutOrderItem2Prefix')}</strong> {t('howItWorksModal.payoutOrderItem2')}
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>{t('howItWorksModal.payoutOrderItem3Prefix')}</strong> {t('howItWorksModal.payoutOrderItem3')}
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>{t('howItWorksModal.payoutOrderItem4Prefix')}</strong> {t('howItWorksModal.payoutOrderItem4')}
            </li>
            <li className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
              <strong>{t('howItWorksModal.payoutOrderItem5Prefix')}</strong> {t('howItWorksModal.payoutOrderItem5')}
            </li>
          </ul>
        </div>

        {/* Section 5: Missed Payments & Pod Agreement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
          
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
            <h4 className="font-bold text-[#111827] flex items-center gap-1.5 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>{t('howItWorksModal.missedPaymentTitle')}</span>
            </h4>
            <ul className="space-y-1.5 text-[#374151] list-disc list-inside text-[11px]">
              <li>{t('howItWorksModal.missedPaymentBullet1')}</li>
              <li>{t('howItWorksModal.missedPaymentBullet2')}</li>
              <li>{t('howItWorksModal.missedPaymentBullet3')}</li>
              <li>{t('howItWorksModal.missedPaymentBullet4')}</li>
            </ul>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
            <h4 className="font-bold text-[#111827] flex items-center gap-1.5 text-sm">
              <FileText className="w-4 h-4 text-[#005FB8]" />
              <span>{t('howItWorksModal.agreementTitle')}</span>
            </h4>
            <p className="text-[#374151] text-[11px]">
              {t('howItWorksModal.agreementDesc')}
            </p>
            <ul className="space-y-1 text-[#374151] list-disc list-inside text-[11px]">
              <li>{t('howItWorksModal.agreementBullet1')}</li>
              <li>{t('howItWorksModal.agreementBullet2')}</li>
              <li>{t('howItWorksModal.agreementBullet3')}</li>
              <li>{t('howItWorksModal.agreementBullet4')}</li>
              <li>{t('howItWorksModal.agreementBullet5')}</li>
              <li>{t('howItWorksModal.agreementBullet6')}</li>
            </ul>
          </div>

        </div>

        {/* Section 6: Perks & Benefits Marketplace */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-lg font-extrabold text-[#111827]">
            <Gift className="w-5 h-5 text-amber-600" />
            <h3>{t('howItWorksModal.perksTitle')}</h3>
          </div>

          <p className="text-xs text-[#4B5563]">
            {t('howItWorksModal.perksSubtitle')}
          </p>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3 text-xs">
            <div>
              <h4 className="font-bold text-[#111827] mb-2">{t('howItWorksModal.categoriesHeader')}</h4>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <span key={cat.key} className="px-2.5 py-1 rounded-md bg-white border border-[#DDE1E6] text-[11px] text-[#374151] font-medium shadow-2xs">
                    {t(cat.key)}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200 text-[11px]">
              <div>
                <strong>{t('howItWorksModal.perksSourceLabel')}</strong> {t('howItWorksModal.perksSourceDesc')}
              </div>
              <div>
                <strong>{t('howItWorksModal.perksEligibilityLabel')}</strong> {t('howItWorksModal.perksEligibilityDesc')}
              </div>
              <div>
                <strong>{t('howItWorksModal.perksRedeemLabel')}</strong> {t('howItWorksModal.perksRedeemDesc')}
              </div>
              <div>
                <strong>{t('howItWorksModal.perksNewRegularlyLabel')}</strong> {t('howItWorksModal.perksNewRegularlyDesc')}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-[#DDE1E6] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7280]">
          <span>{t('howItWorksModal.footerText')}</span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#005FB8] hover:bg-[#004C93] text-white font-bold rounded-xl transition-colors shadow-xs w-full sm:w-auto"
          >
            {t('howItWorksModal.understandBtn')}
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
  const { t } = useTranslation();
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
          aria-label={t('contactModal.close')}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <span className="text-xs font-mono font-bold text-[#005FB8] uppercase tracking-wider block">
              {t('contactModal.helpDeskBadge')}
            </span>
            <h3 className="text-xl font-bold text-[#111827]">
              {t('contactModal.title')}
            </h3>
          </div>
        </div>

        {submitted ? (
          <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center space-y-3 my-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h4 className="text-lg font-bold text-[#111827]">{t('contactModal.successTitle')}</h4>
            <p className="text-xs text-[#4B5563]">
              {t('contactModal.successDesc', { name: name || 'Driver', email: email || 'your email' })}
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setMessage('');
                onClose();
              }}
              className="px-4 py-2 bg-[#005FB8] text-white font-bold text-xs rounded-lg shadow-xs hover:bg-[#004C93] transition-colors"
            >
              {t('contactModal.doneBtn')}
            </button>
          </div>
        ) : (
          <>
            {/* Quick Contact Direct Lines */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#111827]">
                  <Phone className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>{t('contactModal.driverLineTitle')}</span>
                </div>
                <p className="text-[#6B7280] text-[11px] font-mono">{t('contactModal.driverLineNumber')}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#111827]">
                  <Mail className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>{t('contactModal.emailSupportTitle')}</span>
                </div>
                <p className="text-[#6B7280] text-[11px] font-mono">{t('contactModal.emailAddress')}</p>
              </div>
            </div>

            {/* Interactive Support Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  {t('contactModal.fullNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('contactModal.fullNamePlaceholder')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  {t('contactModal.emailLabel')}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('contactModal.emailPlaceholder')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  {t('contactModal.inquiryTopicLabel')}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                >
                  <option value="DRIVER_SUPPORT">{t('contactModal.topicDriverSupport')}</option>
                  <option value="PAYOUT_TREASURY">{t('contactModal.topicPayoutTreasury')}</option>
                  <option value="SWAP_REQUEST">{t('contactModal.topicSwapRequest')}</option>
                  <option value="FLEET_PERKS">{t('contactModal.topicFleetPerks')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1">
                  {t('contactModal.messageLabel')}
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('contactModal.messagePlaceholder')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{t('contactModal.submitBtn')}</span>
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
};

export { FaqModal } from './FaqModal';
