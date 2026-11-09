// What Lainie (the voice assistant) says about Creator Pools. Shared by the
// server's quick answers and the app's offline fallback so both stay in step
// with CREATOR_POOLS_SPEC.md.

export interface LainieAnswer {
  spokenText: string;
  displayText: string;
  suggestedActions: Array<{ label: string; action: 'OPEN_MODAL' | 'NAVIGATE_TAB' | 'SPEAK_EXPLANATION'; modal?: string; tab?: string; prompt?: string }>;
  navigationAction: { type: string; target?: string } | null;
}

// Questions about content creators and their followers (not the 3% reward of
// an ordinary pod's creator, which has its own answer).
const CREATOR_POOL_TERMS = [
  'creator pool', 'creators pool', 'content creator', 'influencer', 'follower', 'my audience', 'creator dashboard', 'creator link', 'creators page',
  'tiktok', 'instagram', 'youtube', 'youtuber',
  'creador de contenido', 'creadores de contenido', 'seguidores', 'pool de creador', 'panel de creador',
  'créateur de contenu', 'créateurs de contenu', 'abonnés', 'influenceur', 'pool de créateur', 'tableau de bord créateur',
];

export function isCreatorPoolsQuestion(text: string): boolean {
  const q = (text || '').toLowerCase();
  return CREATOR_POOL_TERMS.some(term => q.includes(term));
}

export function creatorPoolsAnswer(language: string): LainieAnswer {
  if (language === 'es') {
    return {
      spokenText: 'Con los Creator Pools, un creador de contenido invita a sus seguidores con un solo enlace. Ellos ahorran en grupos de 20 que empiezan solos al llenarse, y el creador gana el 3% de cada bote semanal por organizarlos.',
      displayText: '🎥 Creator Pools: ahorro con tu audiencia\n\n• Un solo enlace: themutualpool.com/c/tu-nombre. Los seguidores se unen en grupos de 20; cuando uno se llena empieza solo y se abre otro.\n• Para creadores: conecta Instagram, TikTok o YouTube (1,000+ seguidores en total), verifica tu identidad, vincula tu banco y acepta los términos. La aprobación es automática.\n• Ganancias: el 3% de cada bote semanal (sale de la comisión del 10%), cada semana. Necesitas un W-9 para retirarlas.\n• Depósitos: de $10 a $60 por semana en tu primer pool; de $70 a $100 después, solo para quien ya completó un grupo.\n• Seguidores: primero un grupo; tras completarlo, hasta 3 a la vez. Solo en EE. UU.\n• Orden de pago sorteado al empezar: primero quien completó un grupo, luego quien recibe ingresos por depósito directo, luego 90+ días, luego los demás.\n• Inscripción: 8 semanas o 5,000 seguidores durante el piloto.\n• Seguridad: MutualPool y los creadores nunca piden pagar fuera de la app.',
      suggestedActions: [
        { label: 'Ver la página para creadores', action: 'OPEN_MODAL', modal: 'CREATORS' },
        { label: 'Abrir el panel de creador', action: 'OPEN_MODAL', modal: 'CREATOR_DASHBOARD' },
      ],
      navigationAction: { type: 'OPEN_MODAL', target: 'CREATORS' },
    };
  }
  if (language === 'fr') {
    return {
      spokenText: 'Avec les Creator Pools, un créateur de contenu invite ses abonnés avec un seul lien. Ils épargnent dans des pods de 20 qui démarrent dès qu’ils sont complets, et le créateur gagne 3 % de chaque cagnotte hebdomadaire pour les animer.',
      displayText: '🎥 Creator Pools : épargner avec votre audience\n\n• Un seul lien : themutualpool.com/c/votre-nom. Les abonnés rejoignent des pods de 20 ; quand l’un est complet, il démarre et un nouveau s’ouvre.\n• Pour les créateurs : connectez Instagram, TikTok ou YouTube (1 000+ abonnés au total), vérifiez votre identité, liez votre banque et acceptez les conditions. L’approbation est automatique.\n• Gains : 3 % de chaque cagnotte hebdomadaire (pris sur les frais de 10 %), chaque semaine. Un W-9 est requis pour les retirer.\n• Versements : de 10 $ à 60 $ par semaine pour un premier pool ; de 70 $ à 100 $ ensuite, réservés à ceux qui ont terminé un pod.\n• Abonnés : un pod d’abord ; après l’avoir terminé, jusqu’à 3 à la fois. États-Unis uniquement.\n• Ordre de versement tiré au démarrage : d’abord ceux qui ont terminé un pod, puis ceux dont les revenus arrivent par virement direct, puis 90+ jours, puis les autres.\n• Inscriptions : 8 semaines ou 5 000 abonnés pendant le pilote.\n• Sécurité : MutualPool et les créateurs ne demandent jamais de payer hors de l’application.',
      suggestedActions: [
        { label: 'Voir la page créateurs', action: 'OPEN_MODAL', modal: 'CREATORS' },
        { label: 'Ouvrir le tableau de bord créateur', action: 'OPEN_MODAL', modal: 'CREATOR_DASHBOARD' },
      ],
      navigationAction: { type: 'OPEN_MODAL', target: 'CREATORS' },
    };
  }
  return {
    spokenText: 'With Creator Pools, a content creator invites followers with one link. They save together in pods of 20 that start on their own when full, and the creator earns 3% of every weekly pot for hosting.',
    displayText: '🎥 Creator Pools: saving with your audience\n\n• One link: themutualpool.com/c/your-name. Followers join pods of 20; when one fills it starts on its own and a new one opens.\n• For creators: connect Instagram, TikTok or YouTube (1,000+ followers combined), verify your identity, link your bank and accept the creator terms. Approval is automatic.\n• Earnings: 3% of every weekly pot (out of the 10% payout fee), paid each week. Add a W-9 to withdraw them.\n• Deposits: $10 to $60 a week for a first pool; $70 to $100 later, only for followers who have completed a pod.\n• Followers: one creator pod at first; after completing a pod, up to 3 at a time. US only.\n• Payout order is drawn when a pod starts: completed-pod members first, then members with gig earnings by direct deposit, then 90+ days, then everyone else.\n• Enrollment: 8 weeks or 5,000 followers during the pilot.\n• Safety: MutualPool and creators never ask you to pay outside the app.',
    suggestedActions: [
      { label: 'See the Creators page', action: 'OPEN_MODAL', modal: 'CREATORS' },
      { label: 'Open the Creator dashboard', action: 'OPEN_MODAL', modal: 'CREATOR_DASHBOARD' },
    ],
    navigationAction: { type: 'OPEN_MODAL', target: 'CREATORS' },
  };
}

// The Creator Pools section of Lainie's AI knowledge brief.
export const CREATOR_POOLS_BRIEF = `8. CATEGORY: CREATOR POOLS (CONTENT CREATORS AND THEIR FOLLOWERS)
- Not the same as an ordinary pod's creator. Creator Pools let a social media content creator host savings pods for their followers. Info page: /creators ("For Content Creators" button on the home page). Creator dashboard: /creator (user menu → Creator dashboard). Each creator has ONE permanent link: themutualpool.com/c/<handle>.
- Becoming a creator: choose a link name, connect Instagram, TikTok or YouTube (signing in to the platform proves ownership and reads the follower count; we keep the count, never the login), at least 1,000 followers combined, verify identity, link a bank and authorize debits, accept the creator terms. Approval is automatic once all are done. If a platform connection is unavailable, an admin can verify the account by hand.
- Pools: the creator picks the weekly deposit: $10 to $60 for a first pool; $70 to $100 for later pools, which only accept followers with a completed pod. One pool open for enrollment at a time. Enrollment closes after 8 weeks, at 5,000 seated followers during the pilot, or whenever the creator closes it; the creator can then open the next pool while existing pods keep running. A "Notify me" waiting list collects followers for the next pool.
- Pods in a pool always have 20 members. A follower takes a seat only after: being in the US, verifying identity, authorizing bank debits, having the first deposit plus the 5% buffer in their balance, and signing the creator pool agreement. The first deposit is taken when they take the seat. When a pod fills, it starts on its own and a new pod opens. During a rush a waiting line holds each follower's place.
- Payout order is drawn when a pod starts: members with a completed pod first, then members with gig earnings arriving by direct deposit, then 90+ days on MutualPool, then everyone else, random within each group. Joining first gives no advantage. Nobody is blocked from an early slot. Swaps need the other member's agreement ("request a swap to get paid sooner").
- Follower limits (creator pods only; ordinary pods unaffected): one creator pod until the follower completes a pod having made every deposit, then up to 3 creator pods at a time. Members can leave a creator pod before it starts and get their deposit back.
- A pod that gets no new member for 14 days, or is still filling when enrollment closes: its members move into open slots of running pods; the rest start together if there are 2 or more; a single remaining member's seat is refunded.
- Money: the 10% payout fee splits 3% of the pot to the creator (every week, while their creator account is in good standing) and 7% to MutualPool. The creator appears in each pod as Member 21 with a "Last · Host" badge and takes no payout slot unless they chose to save in Pod 1 (its last slot). The 5% buffer works as in every pod. Creator earnings land in their MutualPool balance weekly; they need a W-9 on file to withdraw them; MutualPool files a 1099-NEC above $2,000 a year. Tax IDs are stored encrypted.
- Missed deposits: 24 hours to pay, then removal, account restriction and bank collection as in every pod. A member removed BEFORE being paid leaves a held slot that the next follower to join takes (paying only the remaining weeks); if nobody takes it by the week before its payout, the slot is removed and everyone after moves up a week. A member removed AFTER being paid leaves an empty slot that the buffer covers each week; a pause-or-cover vote opens only when the buffer can't cover a week, and if nobody votes the pod pauses. Inside each pod, members and the creator can see who missed a deposit.
- Protections for followers: a first payout is held 3 business days if the member has no completed pod and no direct deposit (it still arrives on time in the balance); withdrawals go only to the bank account authorized for debits; a newly changed withdrawal bank waits 72 hours; if the bank account holder name doesn't match the verified name, an admin reviews it first.
- Creator rules: disclose the commission in every promotional post (for example #ad), never promise returns or call it an investment, never ask members for money outside the app, never name members publicly. A suspended creator's pods keep running and the 3% goes to MutualPool.
- US only at launch. Never quote earnings as guaranteed: they depend on how many followers join and keep paying.
- Navigation: send people to the Creators page with {"type":"OPEN_MODAL","target":"CREATORS"} and to the creator dashboard with {"type":"OPEN_MODAL","target":"CREATOR_DASHBOARD"}.`;
