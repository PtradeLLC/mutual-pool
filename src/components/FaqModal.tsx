import React, { useState, useMemo } from 'react';
import { useTranslation } from '../i18n/LanguageContext';
import { Logo } from './Logo';
import { 
  X, Search, HelpCircle, ChevronDown, ChevronUp, Bot, Phone
} from 'lucide-react';
import { 
  FaqCategory, 
  FAQ_UI_TEXT, 
  FAQ_CATEGORIES, 
  getFaqItems, 
  LocalizedFaqItem 
} from '../data/faqContent';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenContact?: () => void;
  onOpenHowItWorks?: () => void;
  onOpenVoiceGuide?: () => void;
  initialCategory?: string;
}

export const FaqModal: React.FC<FaqModalProps> = ({
  isOpen,
  onClose,
  onOpenContact,
  onOpenHowItWorks,
  onOpenVoiceGuide,
  initialCategory = 'ALL'
}) => {
  const { t, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>(
    (initialCategory as FaqCategory) || 'ALL'
  );
  const [expandedId, setExpandedId] = useState<string | null>('faq_rosca_basics');

  const ui = FAQ_UI_TEXT[language] || FAQ_UI_TEXT.en;
  const categories = FAQ_CATEGORIES[language] || FAQ_CATEGORIES.en;
  const faqList = useMemo<LocalizedFaqItem[]>(() => getFaqItems(language), [language]);

  // Filter FAQ items based on selected category & search query
  const filteredFaqs = useMemo(() => {
    return faqList.filter(item => {
      // Category check
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      // Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuestion = item.question.toLowerCase().includes(query);
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
              <span>{ui.badge}</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            {ui.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#4B5563]">
            {ui.subtitle}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#005FB8] focus:ring-1 focus:ring-[#005FB8] transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
            >
              {ui.clear}
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
              <div className="font-bold text-sm text-slate-800">{ui.noResultsTitle}</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {ui.noResultsDesc}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
                className="mt-2 text-xs font-bold text-[#005FB8] hover:underline cursor-pointer"
              >
                {ui.resetFilters}
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
                        {faq.question}
                      </span>
                    </div>
                    <div className="shrink-0 text-slate-400 mt-0.5">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#005FB8]" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      {faq.answer}
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
            <div className="font-bold text-slate-900 flex items-center gap-1.5 justify-center sm:justify-start">
              <span>{ui.stillHaveQuestions}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold">{ui.aiSupportBadge}</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              {ui.askLainieBanner}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onOpenVoiceGuide && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenVoiceGuide(); }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{ui.askLainieBtn}</span>
              </button>
            )}
            {onOpenHowItWorks && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenHowItWorks(); }}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {ui.viewRulesBtn}
              </button>
            )}
            {onOpenContact && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenContact(); }}
                className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{ui.contactSupportBtn}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
