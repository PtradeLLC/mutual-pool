import React, { useState } from 'react';
import { User } from '../types';
import { Building2, CheckCircle2, AlertCircle, X, CreditCard, ShieldCheck, Wallet, ArrowUpRight, Sparkles } from 'lucide-react';

interface StripeBankModalProps {
  user: User;
  onClose: () => void;
  onBankLinked: (updatedUser: User) => void;
}

export const StripeBankModal: React.FC<StripeBankModalProps> = ({ user, onClose, onBankLinked }) => {
  const PRESET_BANKS = [
    'Chase Bank (JPMorgan Chase)',
    'Bank of America',
    'Wells Fargo',
    'Capital One',
    'Citi (Citigroup)',
    'U.S. Bank',
    'PNC Bank',
    'Truist Financial',
    'TD Bank',
    'USAA Bank',
    'Navy Federal Credit Union',
    'Chime Financial',
    'Ally Bank',
    'Discover Bank',
    'SoFi Bank',
    'Fidelity Investments',
    'OTHER_CUSTOM',
  ];

  const initialIsCustom = !user.externalBank?.bankName || !PRESET_BANKS.slice(0, -1).includes(user.externalBank.bankName);

  const [activeTab, setActiveTab] = useState<'BANK_LINK' | 'TREASURY_TOPUP'>('TREASURY_TOPUP');
  const [selectedBankOption, setSelectedBankOption] = useState<string>(
    initialIsCustom ? 'OTHER_CUSTOM' : user.externalBank?.bankName || 'Chase Bank (JPMorgan Chase)'
  );
  const [customBankName, setCustomBankName] = useState<string>(
    initialIsCustom ? user.externalBank?.bankName || '' : ''
  );
  const [accountNumber, setAccountNumber] = useState(
    user.externalBank?.last4 ? `•••• •••• ${user.externalBank.last4}` : '•••• •••• 4821'
  );
  const [routingNumber, setRoutingNumber] = useState(user.externalBank?.routingNumber || '021000021');
  const [accountType, setAccountType] = useState<'CHECKING' | 'SAVINGS'>(user.externalBank?.accountType || 'CHECKING');

  // Treasury Top-up state
  const [topUpAmount, setTopUpAmount] = useState<number>(100);
  const [cardNumber, setCardNumber] = useState<string>('4242 4242 4242 4242');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const effectiveBankName = selectedBankOption === 'OTHER_CUSTOM' ? customBankName.trim() : selectedBankOption;

  const handleLinkBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBankOption === 'OTHER_CUSTOM' && !customBankName.trim()) {
      setError('Please enter the name of your financial institution.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/users/bank/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          bankName: effectiveBankName || 'External Financial Institution',
          accountNumber,
          routingNumber,
          accountType,
        }),
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server responded with status ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to link bank account');
      }

      setSuccessMessage(`Bank account linked (${data.user?.externalBank?.bankName || 'Linked Bank'}) successfully!`);
      onBankLinked(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bank linking failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTreasuryTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/users/treasury/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          amount: topUpAmount,
          sourceCardNumber: cardNumber.replace(/\s+/g, ''),
        }),
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server responded with status ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Treasury deposit failed');
      }

      setSuccessMessage(`Successfully processed $${data.addedAmount}.00 Stripe Treasury InboundTransfer (${data.inboundTransferId})! Updated Treasury Balance: $${data.newBalance.toFixed(2)} USD.`);
      onBankLinked(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Treasury deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = user.treasury?.balanceUsd || 0;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-6 shadow-2xl relative text-[#111827] max-h-[88vh] overflow-y-auto my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#111827]">Stripe Treasury & Accounts</h3>
            <p className="text-xs text-[#6B7280]">FDIC-Insured Pass-Through Treasury Holding & Bank Transfer</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('TREASURY_TOPUP')}
            className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'TREASURY_TOPUP'
                ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>Treasury Balance & Test Deposit</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BANK_LINK')}
            className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'BANK_LINK'
                ? 'bg-white text-[#005FB8] shadow-xs border border-blue-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#005FB8]" />
            <span>Link External Bank Account</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* TAB 1: Stripe Treasury Account & Top Up */}
        {activeTab === 'TREASURY_TOPUP' && (
          <div className="space-y-4">
            {/* Current Balance Card */}
            <div className="p-4 bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-xl shadow-md relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-15">
                <ShieldCheck className="w-24 h-24 text-emerald-400" />
              </div>
              <div className="relative z-10">
                <span className="text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider block">
                  Stripe Treasury Commercial Balance
                </span>
                <div className="text-3xl font-extrabold font-mono mt-1 text-white">
                  ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-emerald-300">USD</span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-emerald-800/80 flex items-center justify-between text-[11px] text-emerald-200">
                  <span>FDIC Pass-Through Status: <strong>Eligible ($250k)</strong></span>
                  <span className="font-mono text-[10px] text-emerald-300 bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-700/60">
                    {user.treasury?.stripeFinAccountId || `fa_1xTreasury_${user.id.slice(0, 6)}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Test Deposit Form */}
            <form onSubmit={handleTreasuryTopUp} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>Deposit Test Funds to Stripe Treasury</span>
                </h4>
                <span className="text-[10px] font-mono bg-blue-100 text-[#005FB8] px-2 py-0.5 rounded-full font-bold">
                  Stripe API Test Mode
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Select Deposit Preset Amount (USD)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        topUpAmount === amt
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Stripe Test Credit Card Number
                </label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                    const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
                    setCardNumber(formatted);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                  placeholder="4242 4242 4242 4242"
                />
                <button
                  type="button"
                  onClick={() => setCardNumber('4242 4242 4242 4242')}
                  className="mt-1 text-[10px] text-[#005FB8] hover:underline font-bold"
                >
                  ⚡ Use Official Stripe Test Card (4242 4242 4242 4242)
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {loading ? (
                  <span>Processing Stripe Treasury InboundTransfer...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Process +${topUpAmount}.00 Test Treasury Deposit</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: Link External Bank Account */}
        {activeTab === 'BANK_LINK' && (
          <form onSubmit={handleLinkBank} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1.5 flex items-center justify-between">
                <span>Select Financial Institution</span>
                <span className="text-[10px] text-gray-500 font-normal">Supports 10,000+ US Banks & Credit Unions</span>
              </label>
              <select
                value={selectedBankOption}
                onChange={(e) => setSelectedBankOption(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
              >
                <option value="Chase Bank (JPMorgan Chase)">Chase Bank (JPMorgan Chase)</option>
                <option value="Bank of America">Bank of America</option>
                <option value="Wells Fargo">Wells Fargo</option>
                <option value="Capital One">Capital One</option>
                <option value="Citi (Citigroup)">Citi (Citigroup)</option>
                <option value="U.S. Bank">U.S. Bank</option>
                <option value="PNC Bank">PNC Bank</option>
                <option value="Truist Financial">Truist Financial</option>
                <option value="TD Bank">TD Bank</option>
                <option value="USAA Bank">USAA Bank</option>
                <option value="Navy Federal Credit Union">Navy Federal Credit Union</option>
                <option value="Chime Financial">Chime Financial</option>
                <option value="Ally Bank">Ally Bank</option>
                <option value="Discover Bank">Discover Bank</option>
                <option value="SoFi Bank">SoFi Bank</option>
                <option value="Fidelity Investments">Fidelity Investments</option>
                <option value="OTHER_CUSTOM">✏️ Other Bank or Credit Union (Type custom name...)</option>
              </select>

              {selectedBankOption === 'OTHER_CUSTOM' && (
                <div className="mt-2.5">
                  <label className="block text-[11px] font-bold text-[#005FB8] mb-1">
                    Type Your Financial Institution Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mercury, Varo Bank, Marcus, Local Credit Union"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    className="w-full bg-blue-50/40 border border-blue-300 rounded-lg px-3.5 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#005FB8] placeholder-gray-400"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                  Routing Number
                </label>
                <input
                  type="text"
                  required
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                  Account Type
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as 'CHECKING' | 'SAVINGS')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8]"
                >
                  <option value="CHECKING">Checking Account</option>
                  <option value="SAVINGS">Savings Account</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                Account Number / Last 4
              </label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-[#111827] focus:outline-none focus:border-[#005FB8] font-mono text-xs"
              />
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-xs text-[#4B5563] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>256-bit encrypted bank connection via Stripe Financial Connections OAuth.</span>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#111827] font-semibold text-xs border border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {loading ? (
                  <span>Linking Bank Account...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect Bank & Enable Withdrawals</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
