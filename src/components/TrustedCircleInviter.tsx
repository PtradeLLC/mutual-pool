import React, { useState } from 'react';
import { InvitedContact, User } from '../types';
import { 
  Users, Lock, Plus, CheckCircle2, UserCheck, Mail, Phone, 
  Copy, Check, Sparkles, Smartphone, Share2, ShieldCheck 
} from 'lucide-react';

interface TrustedCircleInviterProps {
  invitedContacts: InvitedContact[];
  inviteCode: string;
  podName?: string;
  onAddContacts: (newContacts: { name: string; emailOrPhone: string }[]) => void;
  currentUser?: User;
}

const SAMPLE_DEVICE_CONTACTS = [
  { name: 'Carlos Rivera (DoorDash SF)', emailOrPhone: 'carlos.rivera@ubereats.com' },
  { name: 'Sonia Patel (Uber Eats Hub)', emailOrPhone: 'sonia.patel@lyft.com' },
  { name: 'David Miller (Flex Fleet)', emailOrPhone: '+1 (415) 555-0192' },
  { name: 'Maria Garcia (Instacart Shopper)', emailOrPhone: 'maria.garcia@instacart.com' },
  { name: 'Jason Todd (Spark Delivery)', emailOrPhone: 'jason.todd@spark.com' },
  { name: 'Aisha Patel (Gig Member)', emailOrPhone: 'aisha.shopper@gigmutual.app' },
  { name: 'Devon Miller (Gig Member)', emailOrPhone: 'devon.dash@gigmutual.app' },
];

export const TrustedCircleInviter: React.FC<TrustedCircleInviterProps> = ({
  invitedContacts,
  inviteCode,
  podName = 'My Trusted Savings Circle',
  onAddContacts,
}) => {
  const [customName, setCustomName] = useState('');
  const [customContact, setCustomContact] = useState('');
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [selectedDeviceContacts, setSelectedDeviceContacts] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);

  const inviteLink = `https://mutualpool.org/join?code=${inviteCode}`;

  const handleCopy = () => {
    const text = `Hey! Join my private Trusted Circle savings pod "${podName}" on MutualPool. Use my invite code: ${inviteCode} or tap: ${inviteLink}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customContact.trim()) return;
    onAddContacts([{ name: customName.trim() || customContact.trim(), emailOrPhone: customContact.trim() }]);
    setCustomName('');
    setCustomContact('');
  };

  const handleToggleDeviceContact = (emailOrPhone: string) => {
    setSelectedDeviceContacts(prev => 
      prev.includes(emailOrPhone) 
        ? prev.filter(item => item !== emailOrPhone) 
        : [...prev, emailOrPhone]
    );
  };

  const handleConfirmDeviceContacts = () => {
    setImporting(true);
    setTimeout(() => {
      const itemsToAdd = SAMPLE_DEVICE_CONTACTS.filter(c => selectedDeviceContacts.includes(c.emailOrPhone));
      onAddContacts(itemsToAdd);
      setShowDevicePicker(false);
      setSelectedDeviceContacts([]);
      setImporting(false);
    }, 600);
  };

  return (
    <div className="bg-[#F8FAFC] border border-[#DDE1E6] rounded-xl p-4 sm:p-5 space-y-4 text-xs text-[#111827]">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-[#005FB8] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Trusted Circle Governance</span>
            </span>
            <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Only Invited Contacts Can Join
            </span>
          </div>
          <h4 className="font-bold text-sm text-[#111827]">Invite & Manage Trusted Contacts</h4>
          <p className="text-[11px] text-[#6B7280]">
            Add contacts from your phone or email. We automatically check who is already a member and send invites to the rest.
          </p>
        </div>

        {/* Invite Code Box */}
        <div className="p-2.5 rounded-lg bg-white border border-[#005FB8] text-center shrink-0 shadow-2xs">
          <span className="text-[9px] uppercase font-bold text-[#6B7280] block">Private Invite Code</span>
          <span className="font-mono font-black text-base text-[#005FB8] tracking-widest block">{inviteCode}</span>
        </div>
      </div>

      {/* Share Link & Action Controls */}
      <div className="bg-white p-3 rounded-lg border border-[#DDE1E6] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[#111827] text-[11px] flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-[#005FB8]" />
            <span>Shareable Trusted Circle Invite Link</span>
          </span>
          <span className="text-[10px] text-[#6B7280]">Valid for pod capacity</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-mono text-[11px] text-[#374151] select-all focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Invite Text</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add / Import Contacts Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        
        {/* Device Import Button */}
        <div className="bg-white p-3 rounded-lg border border-[#DDE1E6] flex flex-col justify-between space-y-2">
          <div>
            <span className="font-bold text-[#111827] block text-[11px] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#005FB8]" />
              <span>Import Device Contacts</span>
            </span>
            <p className="text-[10px] text-[#6B7280]">
              Access phone contacts or driver hub groups to invite multiple trusted peers at once.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDevicePicker(true)}
            className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#005FB8] border border-blue-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Select Phone / Email Contacts</span>
          </button>
        </div>

        {/* Manual Add Form */}
        <form onSubmit={handleAddSingle} className="bg-white p-3 rounded-lg border border-[#DDE1E6] space-y-2">
          <span className="font-bold text-[#111827] block text-[11px] flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Add Individual Contact</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Name (e.g. Carlos)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="bg-white border border-gray-300 rounded-md px-2.5 py-1 text-[11px] focus:outline-none focus:border-[#005FB8]"
            />
            <input
              type="text"
              required
              placeholder="Email or Phone #"
              value={customContact}
              onChange={(e) => setCustomContact(e.target.value)}
              className="bg-white border border-gray-300 rounded-md px-2.5 py-1 text-[11px] focus:outline-none focus:border-[#005FB8]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors flex items-center justify-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add & Cross-Reference Contact</span>
          </button>
        </form>

      </div>

      {/* DEVICE CONTACTS PICKER MODAL SIMULATOR */}
      {showDevicePicker && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-md w-full p-5 shadow-2xl relative space-y-4">
            
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[#005FB8] font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                  <span>Device Contacts Permissions Request</span>
                </div>
                <h4 className="font-extrabold text-sm text-[#111827]">Import Trusted Driver Contacts</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDevicePicker(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#6B7280]">
              MutualPool uses contact matching to verify existing members in your fleet network. Select who you'd like to invite to this Trusted Circle:
            </p>

            {/* Contacts list */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-gray-50">
              {SAMPLE_DEVICE_CONTACTS.map((c) => {
                const isSelected = selectedDeviceContacts.includes(c.emailOrPhone);
                const isAlreadyInvited = invitedContacts.some(ic => ic.emailOrPhone.toLowerCase() === c.emailOrPhone.toLowerCase());

                return (
                  <div
                    key={c.emailOrPhone}
                    onClick={() => !isAlreadyInvited && handleToggleDeviceContact(c.emailOrPhone)}
                    className={`p-2 rounded-md border text-xs flex items-center justify-between transition-all cursor-pointer ${
                      isAlreadyInvited
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                        : isSelected
                        ? 'bg-blue-50 border-[#005FB8] text-[#111827]'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected || isAlreadyInvited}
                        disabled={isAlreadyInvited}
                        readOnly
                        className="rounded text-[#005FB8]"
                      />
                      <div>
                        <span className="font-bold block text-[11px]">{c.name}</span>
                        <span className="text-[10px] text-[#6B7280] font-mono">{c.emailOrPhone}</span>
                      </div>
                    </div>

                    {isAlreadyInvited ? (
                      <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">Already Added</span>
                    ) : c.emailOrPhone.includes('gigmutual.app') ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Member Found
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-[#005FB8] bg-blue-100 px-1.5 py-0.5 rounded">SMS/Email</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#6B7280]">
                {selectedDeviceContacts.length} contacts selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDevicePicker(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedDeviceContacts.length === 0 || importing}
                  onClick={handleConfirmDeviceContacts}
                  className="px-4 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  {importing ? (
                    <span>Importing & Checking...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Import & Cross-Reference ({selectedDeviceContacts.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Invited Contacts Ledger List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-bold text-xs text-[#111827]">
            Trusted Circle Invited Contacts ({invitedContacts.length})
          </h5>
          <span className="text-[10px] text-[#6B7280]">
            Instant cross-reference active
          </span>
        </div>

        {invitedContacts.length === 0 ? (
          <div className="p-4 bg-white border border-[#DDE1E6] rounded-lg text-center text-[11px] text-[#6B7280] space-y-1">
            <Users className="w-6 h-6 text-gray-300 mx-auto" />
            <p className="font-semibold text-[#111827]">No circle invites sent yet</p>
            <p>Import phone contacts or share the private invite link above to fill your pod.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {invitedContacts.map((contact) => (
              <div
                key={contact.id}
                className="p-2.5 rounded-lg bg-white border border-[#DDE1E6] flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-full ${
                    contact.status === 'JOINED' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : contact.isExistingMember 
                      ? 'bg-blue-100 text-[#005FB8]' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {contact.status === 'JOINED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : contact.isExistingMember ? (
                      <UserCheck className="w-3.5 h-3.5" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div>
                    <span className="font-bold block text-xs text-[#111827]">{contact.name}</span>
                    <span className="text-[10px] text-[#6B7280] font-mono">{contact.emailOrPhone}</span>
                  </div>
                </div>

                <div className="text-right">
                  {contact.status === 'JOINED' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Joined Pod
                    </span>
                  ) : contact.isExistingMember ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#005FB8] border border-blue-200">
                      Member Auto-Invited
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      SMS/Email Sent
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
