import React, { useState } from 'react';
import { ShieldCheck, Info, X, ExternalLink } from 'lucide-react';

export const FDICNoticeBanner: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 shadow-xs flex items-center justify-between gap-3 text-xs text-blue-950">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-blue-100 text-[#005FB8] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="font-bold text-[#005FB8]">FDIC Pass-Through Insured</span>
            <span className="hidden sm:inline text-slate-600"> — Deposits are held in Stripe Treasury Financial Accounts backed by partner banks.</span>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-2.5 py-1 rounded-md bg-white hover:bg-gray-50 text-slate-800 border border-slate-300 font-semibold shrink-0 transition-colors flex items-center gap-1 shadow-xs text-xs"
        >
          <Info className="w-3.5 h-3.5 text-[#005FB8]" />
          <span>Disclosure</span>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-blue-50 text-[#005FB8]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111827]">Stripe Treasury FDIC Pass-Through Notice</h3>
                <p className="text-xs text-[#6B7280]">Official Mandatory Banking Disclosure</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-[#111827] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
              <p>
                <strong>FDIC Pass-Through Coverage:</strong> Funds deposited into member and pod mutual accounts are held in Stripe Treasury Financial Accounts provided by Stripe’s banking partners (Evolve Bank & Trust or Fifth Third Bank, N.A., Members FDIC).
              </p>
              <p>
                Pass-through FDIC insurance covers up to <strong>$250,000 per user</strong> against partner bank failure once funds are deposited into the Financial Account and customer ownership records are established.
              </p>
              <p className="text-xs text-[#6B7280] pt-2 border-t border-[#E2E8F0]">
                <em>Note: Mutual pool rotation payouts and deposits are processed exclusively through licensed financial rails operated by Stripe. Gig Worker Mutual Pool operates as a technology platform layer on top of Stripe Treasury.</em>
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-semibold text-sm transition-colors shadow-xs"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
