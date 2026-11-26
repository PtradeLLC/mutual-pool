import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// An in-app replacement for window.confirm / window.prompt: same look as the
// rest of the app, keyboard friendly (Escape cancels, focus stays inside), and
// optionally asks for a short note.
export interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  // danger: red confirm button and a warning icon.
  tone?: 'primary' | 'danger';
  // Shows a text box; its value is returned as `note`.
  noteLabel?: string;
  notePlaceholder?: string;
}
export interface ConfirmResult {
  confirmed: boolean;
  note: string;
}

interface DialogState extends ConfirmOptions {
  resolve: (r: ConfirmResult) => void;
}

// const { confirm, dialog } = useConfirm();
// const r = await confirm({ title, confirmLabel }); if (!r.confirmed) return;
// ...and render {dialog} once in the component.
export function useConfirm(): { confirm: (o: ConfirmOptions) => Promise<ConfirmResult>; dialog: React.ReactNode } {
  const [state, setState] = useState<DialogState | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<ConfirmResult>(resolve => setState({ ...o, resolve })), []);
  const close = (r: ConfirmResult) => {
    state?.resolve(r);
    setState(null);
  };
  const dialog = state ? <ConfirmDialog {...state} onClose={close} /> : null;
  return { confirm, dialog };
}

const ConfirmDialog: React.FC<ConfirmOptions & { onClose: (r: ConfirmResult) => void }> = ({
  title, body, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', noteLabel, notePlaceholder, onClose,
}) => {
  const [note, setNote] = useState('');
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLTextAreaElement | HTMLButtonElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose({ confirmed: false, note: '' }); return; }
    if (e.key !== 'Tab' || !boxRef.current) return;
    // Keep focus inside the dialog.
    const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>('button, textarea, [href], input, select'));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const confirmCls = tone === 'danger' ? 'bg-rose-700 hover:bg-rose-800 text-white' : 'bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-900';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" onMouseDown={e => { if (e.target === e.currentTarget) onClose({ confirmed: false, note: '' }); }}>
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-md bg-white rounded-2xl border border-[#DDE1E6] shadow-2xl p-5 relative"
      >
        <button type="button" onClick={() => onClose({ confirmed: false, note: '' })} aria-label="Close" className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          {tone === 'danger' && (
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-extrabold text-[#111827]">{title}</h2>
            {body && <div className="mt-1.5 text-sm text-[#4B5563] space-y-2">{body}</div>}
          </div>
        </div>
        {noteLabel && (
          <label className="block mt-4 text-xs font-bold text-slate-700">
            {noteLabel}
            <textarea
              ref={el => { firstRef.current = el; }}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={notePlaceholder}
              rows={3}
              maxLength={300}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-[#DDE1E6] text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#005FB8]"
            />
          </label>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            ref={el => { if (!noteLabel) firstRef.current = el; }}
            onClick={() => onClose({ confirmed: false, note: '' })}
            className="px-4 py-2 rounded-xl border border-[#DDE1E6] hover:bg-slate-50 text-sm font-bold text-slate-700 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button type="button" onClick={() => onClose({ confirmed: true, note: note.trim() })} className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer ${confirmCls}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
