/**
 * Storyboard for the MutualPool ad that plays in the "Watch Video" modal.
 *
 * Scene types
 *  - avatar : the spokesperson talks straight to camera (Runway avatar video, lip-synced to the narration)
 *  - i2v    : b-roll animated from the main character photo (Runway image-to-video)
 *  - t2v    : b-roll generated from a text prompt with the character photos as references
 *
 * Chapters drive the buttons in WatchVideoModal. Narration is the text spoken in that scene.
 */

export type SceneType = 'avatar' | 'i2v' | 't2v';
export type AdLanguage = 'en' | 'es' | 'fr';
export const AD_LANGUAGES: AdLanguage[] = ['en', 'es', 'fr'];

export interface Scene {
  id: string;
  type: SceneType;
  chapter: number;
  /** Spoken line per language. Spanish and French were drafted in-house; have a native speaker review before a public launch. */
  narration: Record<AdLanguage, string>;
  /** Visual direction for i2v / t2v scenes. Ignored for avatar scenes. */
  prompt?: string;
  /** Which reference photos to send for t2v scenes. Defaults to ['main']. */
  references?: Array<'main' | 'crew'>;
}

export interface Chapter {
  id: number;
  /** English title, used in build logs only. The modal reads chapter copy from the i18n files (watchVideo.chapterN.*). */
  title: string;
}

export const CHAPTERS: Chapter[] = [
  { id: 1, title: 'The Problem & The Idea' },
  { id: 2, title: 'How a Pod Works' },
  { id: 3, title: 'Money, Fees & Rules' },
  { id: 4, title: 'Perks & Paid Campaigns' },
];

const MAIN = 'the young Black man in the black MutualPool hoodie with the yellow ADVERTISE WITH US sleeve print';
const CREW = 'the bearded Black man in the black zip-up hoodie with a camouflage backpack';
const STYLE = 'Photorealistic, cinematic 35mm look, natural light, shallow depth of field, steady handheld camera, no on-screen text, no captions.';

export const SCENES: Scene[] = [
  {
    id: 's01',
    type: 'i2v',
    chapter: 1,
    narration: {
      en: "Every week, you work hard for your money. And every week, it seems to disappear before you can save any of it.",
      es: 'Cada semana trabajas duro por tu dinero. Y cada semana, parece que desaparece antes de que puedas ahorrar algo.',
      fr: 'Chaque semaine, tu travailles dur pour ton argent. Et chaque semaine, il semble disparaître avant que tu puisses en mettre de côté.',
    },
    prompt:
      `${MAIN} walks toward the camera along a busy city sidewalk at golden hour carrying a small cardboard package. His smile fades into a tired, thoughtful look as he glances at his phone. A yellow taxi passes behind him. ${STYLE}`,
  },
  {
    id: 's02',
    type: 'avatar',
    chapter: 1,
    narration: {
      en: "MutualPool changes that. It's a savings pod for gig and trade workers, built on an idea communities have trusted for generations. You may know it as a tanda, a susu, a chama, or a chit fund.",
      es: 'MutualPool cambia eso. Es un grupo de ahorro para trabajadores independientes y de oficios, basado en una idea en la que las comunidades han confiado por generaciones. Quizás la conoces como tanda, susu, chama o fondo rotativo.',
      fr: 'MutualPool change ça. C\'est un pod d\'épargne pour les travailleurs indépendants et les artisans, fondé sur une idée à laquelle les communautés font confiance depuis des générations. Tu la connais peut-être sous le nom de tontine, de susu, de chama ou de chit fund.',
    },
  },
  {
    id: 's03',
    type: 't2v',
    chapter: 2,
    references: ['main', 'crew'],
    narration: {
      en: "Here's how it works. You and your crew each put in the same amount every week. Twenty dollars, fifty, whatever your pod agrees on.",
      es: 'Así funciona. Tú y tu equipo aportan la misma cantidad cada semana. Veinte dólares, cincuenta, lo que acuerde tu grupo.',
      fr: 'Voilà comment ça marche. Toi et ton équipe versez le même montant chaque semaine. Vingt dollars, cinquante, ce que ton pod décide.',
    },
    prompt:
      `Five gig workers in delivery jackets and work hoodies, including ${MAIN} and ${CREW}, gathered around a small cafe table. Each one places a folded twenty dollar bill into the center of the table, laughing together. Warm afternoon light through the window. ${STYLE}`,
  },
  {
    id: 's04',
    type: 'avatar',
    chapter: 2,
    narration: {
      en: "Each week, one member receives the whole pot. The order is set when the pod locks, so everyone knows exactly when their turn is coming.",
      es: 'Cada semana, un miembro recibe el pozo completo. El orden se fija cuando el grupo se cierra, así que todos saben exactamente cuándo llega su turno.',
      fr: 'Chaque semaine, un membre reçoit la cagnotte entière. L\'ordre est fixé quand le pod se verrouille, donc chacun sait exactement quand vient son tour.',
    },
  },
  {
    id: 's05',
    type: 'avatar',
    chapter: 2,
    narration: {
      en: "No interest. No credit check. No loan. It's your own money, pooled with people you trust, paid out in full when it's your turn.",
      es: 'Sin intereses. Sin revisión de crédito. Sin préstamos. Es tu propio dinero, reunido con gente en la que confías, y pagado completo cuando es tu turno.',
      fr: 'Pas d\'intérêts. Pas de vérification de crédit. Pas de prêt. C\'est ton propre argent, mis en commun avec des gens de confiance, et versé en totalité quand c\'est ton tour.',
    },
  },
  {
    id: 's06',
    type: 't2v',
    chapter: 2,
    references: ['main', 'crew'],
    narration: {
      en: "Start a Trusted Circle with friends or your delivery crew, or join an Open Pod with verified members across the network. Your identity is verified, and so is everyone else's.",
      es: 'Crea un Círculo de Confianza con amigos o con tu equipo de reparto, o únete a un Grupo Abierto con miembros verificados de toda la red. Tu identidad está verificada, y la de los demás también.',
      fr: 'Crée un Cercle de Confiance avec tes amis ou ton équipe de livraison, ou rejoins un Pod Ouvert avec des membres vérifiés de tout le réseau. Ton identité est vérifiée, et celle des autres aussi.',
    },
    prompt:
      `${MAIN} and ${CREW} fist-bump beside two parked electric delivery bikes on a bright city street, then one of them holds up his phone showing a clean mobile app screen with a large green verified check mark badge. Bright daylight, upbeat mood. ${STYLE}`,
  },
  {
    id: 's07',
    type: 't2v',
    chapter: 3,
    references: ['main'],
    narration: {
      en: "Deposits come out of your MutualPool balance every Thursday. Payouts land every Friday. Fund your balance from your bank, or have your earnings deposited straight into it.",
      es: 'Los depósitos salen de tu saldo de MutualPool cada jueves. Los pagos llegan cada viernes. Recarga tu saldo desde tu banco, o recibe tus ganancias directamente en él.',
      fr: 'Les dépôts sont prélevés sur ton solde MutualPool chaque jeudi. Les versements arrivent chaque vendredi. Alimente ton solde depuis ta banque, ou fais-y déposer directement tes gains.',
    },
    prompt:
      `Close-up of ${MAIN} sitting in the driver's seat of a parked car at dusk, glancing down at his phone and breaking into a relieved smile as a payment notification arrives. Soft evening light through the windshield, city bokeh in the background. ${STYLE}`,
  },
  {
    id: 's08',
    type: 'avatar',
    chapter: 3,
    narration: {
      en: "The fees are simple and there are no surprises. Ten percent on each payout, and three of that goes to the member hosting the pod. Five percent of each deposit goes into your pod's own safety buffer, and if it's never needed, it comes back to you. That's it.",
      es: 'Las comisiones son simples y sin sorpresas. Diez por ciento por cada pago, y tres de esos van al miembro que organiza el grupo. El cinco por ciento de cada depósito va al fondo de reserva de tu propio grupo, y si nunca se necesita, vuelve a ti. Eso es todo.',
      fr: 'Les frais sont simples et sans surprise. Dix pour cent sur chaque versement, dont trois reviennent au membre qui anime le pod. Cinq pour cent de chaque dépôt vont dans la réserve de ton propre pod, et s\'ils ne servent jamais, ils te reviennent. C\'est tout.',
    },
  },
  {
    id: 's09',
    type: 't2v',
    chapter: 3,
    references: ['main', 'crew'],
    narration: {
      en: "If someone misses a deposit, the whole pod knows right away, and the rules protect the people who keep paying. Your pod decides together what happens next.",
      es: 'Si alguien no hace su depósito, todo el grupo lo sabe de inmediato, y las reglas protegen a quienes siguen pagando. Tu grupo decide en conjunto qué pasa después.',
      fr: 'Si quelqu\'un manque un dépôt, tout le pod le sait immédiatement, et les règles protègent ceux qui continuent de payer. Ton pod décide ensemble de la suite.',
    },
    prompt:
      `A small group of gig workers including ${MAIN} and ${CREW} stand together under a storefront awning at dusk, looking at their phones and nodding to each other as they make a group decision. Serious but supportive mood, soft neon reflections on the wet pavement. ${STYLE}`,
  },
  {
    id: 's10',
    type: 't2v',
    chapter: 4,
    references: ['main'],
    narration: {
      en: "Beyond saving, MutualPool brings you road perks from partners who get gig life: meals, repairs, phone plans, and more. Benefits that are not provided by your current employer.",
      es: 'Más allá del ahorro, MutualPool te trae beneficios en la calle de socios que entienden la vida del repartidor: comidas, reparaciones, planes de teléfono y más. Beneficios que tu empleador actual no te ofrece.',
      fr: 'Au-delà de l\'épargne, MutualPool t\'apporte des avantages sur la route grâce à des partenaires qui comprennent la vie de livreur : repas, réparations, forfaits téléphone et plus encore. Des avantages que ton employeur actuel ne te donne pas.',
    },
    prompt:
      `${MAIN} grabs a hot meal from a food truck window and nods thanks, then a mechanic at a small tire shop hands him a freshly repaired tire, then he picks up a phone from a repair counter and checks the screen with a grin. Bright, upbeat, quick cuts. ${STYLE}`,
  },
  {
    id: 's11',
    type: 'i2v',
    chapter: 4,
    narration: {
      en: "And brand campaigns that pay you for the miles you already drive. Yes, we partnered with local businesses to sponsor you as you make your deliveries. Wear hoodies or shirt with their message on it, and get paid by the day.",
      es: 'Y campañas de marcas que te pagan por las millas que ya recorres. Sí, nos asociamos con negocios locales para patrocinarte mientras haces tus entregas. Usa sudaderas o camisetas con su mensaje, y cobra por día.',
      fr: 'Et des campagnes de marques qui te paient pour les kilomètres que tu fais déjà. Oui, nous nous associons à des commerces locaux pour te sponsoriser pendant tes livraisons. Porte un sweat ou un t-shirt avec leur message, et sois payé à la journée.',
    },
    prompt:
      `${MAIN} walks confidently toward the camera on a busy city sidewalk carrying a package, turns slightly to show the yellow sleeve print on his hoodie, and grins. Slow push-in, golden hour, pedestrians and a yellow taxi softly blurred behind him. ${STYLE}`,
  },
  {
    id: 's12',
    type: 'avatar',
    chapter: 4,
    narration: {
      en: "Have a question? Ask Lainie, your built-in guide, any time.",
      es: '¿Tienes una pregunta? Pregúntale a Lainie, tu guía integrada, en cualquier momento.',
      fr: 'Une question ? Demande à Lainie, ton guide intégré, à tout moment.',
    },
  },
  {
    id: 's13',
    type: 'avatar',
    chapter: 4,
    narration: {
      en: "Pool together. Grow together. Deliver together. That's MutualPool.",
      es: 'Ahorramos juntos. Crecemos juntos. Entregamos juntos. Eso es MutualPool.',
      fr: 'On épargne ensemble. On grandit ensemble. On livre ensemble. C\'est ça, MutualPool.',
    },
  },
];

/**
 * System prompt for the Runway avatar. Only used if the avatar is ever put in a live session;
 * the ad clips are lip-synced to pre-generated narration. Runway moderates this text, so keep it
 * short and plain (the full character brief lives in the storyboard comments above).
 */
export const AVATAR_PERSONALITY =
  'A friendly, upbeat gig worker who hosts MutualPool savings pods. He explains how pods work in plain, honest language, keeps his word, and believes people get further when they support each other.';
