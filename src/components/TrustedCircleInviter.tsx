import React, { useState } from 'react';
import { InvitedContact, User } from '../types';
import { 
  Users, Lock, Plus, CheckCircle2, UserCheck, Mail, Phone, 
  Copy, Check, Sparkles, Smartphone, Share2, ShieldCheck,
  FileText, Search, Trash2, AlertCircle
} from 'lucide-react';

interface TrustedCircleInviterProps {
  invitedContacts: InvitedContact[];
  inviteCode: string;
  podName?: string;
  onAddContacts: (newContacts: { name: string; emailOrPhone: string }[]) => void;
  currentUser?: User;
}

// Helper to parse pasted text / CSV contacts
const parsePastedContacts = (text: string): { name: string; emailOrPhone: string }[] => {
  const results: { name: string; emailOrPhone: string }[] = [];
  
  if (text.includes('BEGIN:VCARD')) {
    const cards = text.split('END:VCARD');
    for (const card of cards) {
      let name = '';
      let emailOrPhone = '';
      const lines = card.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith('FN:') || line.startsWith('N:')) {
          name = line.replace(/^(FN|N):/, '').replace(/;/g, ' ').trim();
        } else if (line.startsWith('TEL')) {
          const val = line.split(':').pop()?.trim();
          if (val && !emailOrPhone) emailOrPhone = val;
        } else if (line.startsWith('EMAIL')) {
          const val = line.split(':').pop()?.trim();
          if (val && !emailOrPhone) emailOrPhone = val;
        }
      }
      if (emailOrPhone) {
        results.push({ name: name || emailOrPhone, emailOrPhone });
      }
    }
  } else {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim() || line.toLowerCase().startsWith('name') || line.toLowerCase().startsWith('email')) continue;
      const parts = line.split(/[,;\t]/);
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const contact = parts[1].trim();
        if (contact) results.push({ name: name || contact, emailOrPhone: contact });
      } else if (parts.length === 1 && (parts[0].includes('@') || parts[0].match(/\d+/))) {
        const contact = parts[0].trim();
        results.push({ name: contact, emailOrPhone: contact });
      }
    }
  }
  return results;
};

export const TrustedCircleInviter: React.FC<TrustedCircleInviterProps> = ({
  invitedContacts,
  inviteCode,
  podName = 'My Trusted Savings Circle',
  onAddContacts,
}) => {
  const [customName, setCustomName] = useState('');
  const [customContact, setCustomContact] = useState('');
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [importedDeviceContacts, setImportedDeviceContacts] = useState<{ name: string; emailOrPhone: string }[]>([]);
  const [selectedDeviceContacts, setSelectedDeviceContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const isNativeContactsSupported = typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;

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

  const handleNativeContactPicker = async () => {
    setPermissionError(null);
    if (isNativeContactsSupported) {
      try {
        const props = ['name', 'email', 'tel'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: true });
        const formatted = contacts.map((c: any) => {
          const name = c.name?.[0] || 'Phone Contact';
          const contactVal = c.tel?.[0] || c.email?.[0] || '';
          return { name, emailOrPhone: contactVal };
        }).filter((c: any) => c.emailOrPhone);

        if (formatted.length > 0) {
          setImportedDeviceContacts(prev => {
            const existing = new Set(prev.map(item => item.emailOrPhone.toLowerCase()));
            const newOnes = formatted.filter((f: any) => !existing.has(f.emailOrPhone.toLowerCase()));
            return [...prev, ...newOnes];
          });
          // Auto select newly fetched
          const newKeys = formatted.map((f: any) => f.emailOrPhone);
          setSelectedDeviceContacts(prev => Array.from(new Set([...prev, ...newKeys])));
        }
      } catch (err: any) {
        console.log('Contact picker canceled or denied:', err);
        if (err?.name !== 'AbortError') {
          setPermissionError('Device contact permission was not granted or was dismissed by the browser.');
        }
      }
    } else {
      setPermissionError('Direct contact access is natively supported on mobile Android Chrome / Edge. For iOS or desktop, use the quick paste tool or enter phone numbers below.');
    }
  };

  const handlePasteImport = () => {
    if (!pasteInput.trim()) return;
    const parsed = parsePastedContacts(pasteInput);
    if (parsed.length > 0) {
      setImportedDeviceContacts(prev => {
        const existing = new Set(prev.map(item => item.emailOrPhone.toLowerCase()));
        const newOnes = parsed.filter(p => !existing.has(p.emailOrPhone.toLowerCase()));
        return [...prev, ...newOnes];
      });
      const newKeys = parsed.map(p => p.emailOrPhone);
      setSelectedDeviceContacts(prev => Array.from(new Set([...prev, ...newKeys])));
      setPasteInput('');
      setShowPasteArea(false);
    }
  };

  const handleToggleDeviceContact = (emailOrPhone: string) => {
    setSelectedDeviceContacts(prev => 
      prev.includes(emailOrPhone) 
        ? prev.filter(item => item !== emailOrPhone) 
        : [...prev, emailOrPhone]
    );
  };

  const handleSelectAll = () => {
    const available = filteredContacts
      .filter(c => !invitedContacts.some(ic => ic.emailOrPhone.toLowerCase() === c.emailOrPhone.toLowerCase()))
      .map(c => c.emailOrPhone);
    setSelectedDeviceContacts(available);
  };

  const handleDeselectAll = () => {
    setSelectedDeviceContacts([]);
  };

  const handleConfirmDeviceContacts = () => {
    setImporting(true);
    setTimeout(() => {
      const itemsToAdd = importedDeviceContacts.filter(c => selectedDeviceContacts.includes(c.emailOrPhone));
      onAddContacts(itemsToAdd);
      setShowDevicePicker(false);
      setSelectedDeviceContacts([]);
      setImporting(false);
    }, 600);
  };

  const filteredContacts = importedDeviceContacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.emailOrPhone.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {/* DEVICE CONTACTS PICKER MODAL */}
      {showDevicePicker && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE1E6] rounded-xl max-w-lg w-full p-5 shadow-2xl relative space-y-4 max-h-[90vh] flex flex-col">
            
            <div className="flex items-start justify-between border-b pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-1.5 text-[#005FB8] font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                  <span>Device Contacts Permissions</span>
                </div>
                <h4 className="font-extrabold text-sm text-[#111827]">Import Phone Contacts</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDevicePicker(false)}
                className="text-gray-400 hover:text-gray-600 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-[#6B7280] shrink-0">
              MutualPool uses contact matching to verify existing members in your fleet network. Tap below to grant permission and select contacts directly from your phone's address book:
            </p>

            {/* Native Mobile Permission Action Button */}
            <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-3 space-y-2 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                <button
                  type="button"
                  onClick={handleNativeContactPicker}
                  className="px-4 py-2.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Grant Permission & Select Contacts</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPasteArea(!showPasteArea)}
                  className="px-3 py-2 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-[#111827] font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#005FB8]" />
                  <span>{showPasteArea ? 'Hide Paste Tool' : 'Paste Phone / Email List'}</span>
                </button>
              </div>

              {permissionError && (
                <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-1.5 mt-1">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{permissionError}</span>
                </div>
              )}

              {/* Paste Text Area Expansion */}
              {showPasteArea && (
                <div className="mt-2 space-y-2 pt-2 border-t border-blue-200">
                  <label className="block text-[10px] font-bold text-[#005FB8] uppercase tracking-wider">
                    Paste Contacts (Phone numbers or Emails)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Paste numbers or emails separated by commas or lines... e.g. +14155550192, carlos@driver.com"
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-md p-2 text-[11px] text-[#111827] focus:outline-none focus:border-[#005FB8]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPasteArea(false)}
                      className="px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePasteImport}
                      className="px-3 py-1 bg-[#005FB8] text-white font-bold text-[11px] rounded-md hover:bg-[#004C93]"
                    >
                      Process & Add to List
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Contacts Container / Empty State */}
            {importedDeviceContacts.length === 0 ? (
              <div className="py-8 px-4 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-center space-y-2 my-auto">
                <Users className="w-8 h-8 text-gray-300 mx-auto" />
                <h5 className="font-bold text-xs text-[#111827]">No Contacts Selected Yet</h5>
                <p className="text-[11px] text-[#6B7280] max-w-xs mx-auto">
                  Your list is currently empty. Tap <span className="font-semibold text-[#005FB8]">Grant Permission & Select Contacts</span> above to pick driver contacts from your phone.
                </p>
              </div>
            ) : (
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                {/* Search & Bulk Select bar */}
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search contacts by name or phone/email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-3 py-1 text-[11px] text-[#111827] focus:outline-none focus:border-[#005FB8]"
                    />
                  </div>

                  <div className="flex gap-1.5 shrink-0 text-[10px]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded"
                    >
                      Deselect
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImportedDeviceContacts([]); setSelectedDeviceContacts([]); }}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded flex items-center gap-1"
                      title="Clear imported contacts"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                {/* Scrollable list */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-gray-50 flex-1">
                  {filteredContacts.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-[11px]">
                      No contacts matched "{searchQuery}"
                    </div>
                  ) : (
                    filteredContacts.map((c) => {
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
                    })
                  )}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t shrink-0">
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
                  className="px-4 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
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
