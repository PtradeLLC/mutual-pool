import React from 'react';
import { LegalDocument, parseInline } from '../content/legalDocuments';

// Renders a legal document (from src/content/legalDocuments.ts) inside the app.
// The server renders the same content as standalone pages at /privacy and /terms.
const Inline: React.FC<{ text: string; onNavigate?: (href: string) => boolean }> = ({ text, onNavigate }) => (
  <>
    {parseInline(text).map((tok, i) => {
      if (tok.type === 'bold') return <strong key={i}>{tok.text}</strong>;
      if (tok.type === 'link') {
        return (
          <a
            key={i}
            href={tok.href}
            className="text-[#005FB8] underline"
            onClick={(e) => { if (onNavigate && onNavigate(tok.href)) e.preventDefault(); }}
            target={tok.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noreferrer"
          >
            {tok.text}
          </a>
        );
      }
      return <React.Fragment key={i}>{tok.text}</React.Fragment>;
    })}
  </>
);

interface LegalDocumentViewProps {
  doc: LegalDocument;
  // Return true to handle an in-document link (e.g. open the other document in a modal).
  onNavigate?: (href: string) => boolean;
}

export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({ doc, onNavigate }) => (
  <div className="space-y-6">
    <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs text-[#374151] leading-relaxed">
      <Inline text={doc.intro} onNavigate={onNavigate} />
    </div>
    {doc.sections.map((s, i) => (
      <section key={s.title} className="space-y-2">
        <h4 className="font-bold text-[#111827] text-sm">{i + 1}. {s.title}</h4>
        <div className="text-xs text-[#374151] leading-relaxed space-y-2">
          {s.paragraphs?.map((p, j) => <p key={j}><Inline text={p} onNavigate={onNavigate} /></p>)}
          {s.bullets && (
            <ul className="list-disc pl-5 space-y-1">
              {s.bullets.map((b, j) => <li key={j}><Inline text={b} onNavigate={onNavigate} /></li>)}
            </ul>
          )}
          {s.after && <p><Inline text={s.after} onNavigate={onNavigate} /></p>}
        </div>
      </section>
    ))}
    <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#374151]">
      <Inline text={doc.contact} onNavigate={onNavigate} />
    </div>
  </div>
);
