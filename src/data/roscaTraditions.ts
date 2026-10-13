// Rotating savings circles exist in most cultures under their own names. Members
// can pick the name their community uses; the app then uses it in labels and
// invitations ("Join my Tanda"). Names are proper nouns and are not translated.
//
// Shared by the browser and the server (keep it free of browser/Node-only APIs).

export interface RoscaTradition {
  id: string;
  name: string;
  // Alternative spellings or names, shown alongside the main name.
  aliases?: string[];
  region: string;
}

export const ROSCA_TRADITIONS: RoscaTradition[] = [
  { id: 'tanda', name: 'Tanda', region: 'Mexico' },
  { id: 'cundina', name: 'Cundina', region: 'Northern Mexico' },
  { id: 'susu', name: 'Susu', region: 'Ghana' },
  { id: 'ajo', name: 'Ajo', aliases: ['Esusu'], region: 'Nigeria' },
  { id: 'pardner', name: 'Pardner', aliases: ['Partner'], region: 'Jamaica' },
  { id: 'sou-sou', name: 'Sou-sou', region: 'Trinidad and Tobago' },
  { id: 'san', name: 'San', region: 'Dominican Republic' },
  { id: 'cuchubal', name: 'Cuchubal', region: 'Guatemala' },
  { id: 'pasanaku', name: 'Pasanaku', region: 'Bolivia' },
  { id: 'chit-fund', name: 'Chit fund', region: 'India' },
  { id: 'seettu', name: 'Seettu', aliases: ['Chit'], region: 'Sri Lanka' },
  { id: 'kameti', name: 'Kameti', aliases: ['Committee'], region: 'Pakistan' },
  { id: 'hui', name: 'Hui', region: 'China' },
  { id: 'hui-vn', name: 'Hụi', aliases: ['Hội'], region: 'Vietnam' },
  { id: 'gye', name: 'Gye', aliases: ['Kye'], region: 'South Korea' },
  { id: 'tanomoshi', name: 'Tanomoshi-kō', region: 'Japan' },
  { id: 'arisan', name: 'Arisan', region: 'Indonesia' },
  { id: 'paluwagan', name: 'Paluwagan', region: 'Philippines' },
  { id: 'equb', name: 'Equb', aliases: ['Iqub'], region: 'Ethiopia' },
  { id: 'ayuuto', name: 'Ayuuto', aliases: ['Hagbad'], region: 'Somalia' },
  { id: 'chama', name: 'Chama', region: 'Kenya' },
  { id: 'upatu', name: 'Upatu', region: 'Tanzania' },
  { id: 'stokvel', name: 'Stokvel', region: 'South Africa' },
  { id: 'njangi', name: 'Njangi', region: 'Cameroon' },
  { id: 'tontine', name: 'Tontine', region: 'Senegal & francophone West Africa' },
  { id: 'xitique', name: 'Xitique', region: 'Mozambique' },
  { id: 'dhukuti', name: 'Dhukuti', region: 'Nepal' },
  { id: 'pia-huey', name: 'Pia huey', aliases: ['Len share'], region: 'Thailand' },
  { id: 'gameya', name: "Gam'eya", aliases: ["Gam'iya"], region: 'Egypt' },
  { id: 'consorcio', name: 'Consórcio', region: 'Brazil' },
];

export function getTradition(id?: string | null): RoscaTradition | undefined {
  if (!id) return undefined;
  return ROSCA_TRADITIONS.find(t => t.id === id);
}

export function isTraditionId(id: unknown): id is string {
  return typeof id === 'string' && ROSCA_TRADITIONS.some(t => t.id === id);
}

// The member's own word for a savings circle, or undefined if they haven't chosen one.
export function getTraditionName(user?: { traditionId?: string } | null): string | undefined {
  return getTradition(user?.traditionId)?.name;
}

// Short, well-known selection for marketing copy ("known as Tanda, Susu, ...").
export const FEATURED_TRADITION_IDS = ['tanda', 'susu', 'pardner', 'chama', 'stokvel', 'hui', 'arisan', 'paluwagan', 'kameti', 'equb', 'tontine', 'chit-fund'];
