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

export interface Scene {
  id: string;
  type: SceneType;
  chapter: number;
  narration: string;
  /** Visual direction for i2v / t2v scenes. Ignored for avatar scenes. */
  prompt?: string;
  /** Which reference photos to send for t2v scenes. Defaults to ['main']. */
  references?: Array<'main' | 'crew'>;
}

export interface Chapter {
  id: number;
  title: string;
  description: string;
  highlight: string;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'The Problem & The Idea',
    description: 'Money disappears before you can save it. MutualPool puts a tradition communities have trusted for generations to work for gig and trade workers.',
    highlight: 'Tanda • Susu • Chama • Chit fund',
  },
  {
    id: 2,
    title: 'How a Pod Works',
    description: 'Everyone puts in the same amount each week. One member receives the whole pot. The order is set when the pod locks.',
    highlight: 'No interest • No credit check • No loan',
  },
  {
    id: 3,
    title: 'Money, Fees & Rules',
    description: 'Deposits every Thursday, payouts every Friday, simple fees, and rules that protect the members who keep paying.',
    highlight: '5% per deposit • 10% per payout, 3% to the host',
  },
  {
    id: 4,
    title: 'Perks & Paid Campaigns',
    description: 'Road perks from partners who get gig life, brand campaigns that pay you by the day, and Lainie to answer questions any time.',
    highlight: 'Meals • Repairs • Phone plans • Sponsored hoodies',
  },
];

const MAIN = 'the young Black man in the black MutualPool hoodie with the yellow ADVERTISE WITH US sleeve print';
const CREW = 'the bearded Black man in the black zip-up hoodie with a camouflage backpack';
const STYLE = 'Photorealistic, cinematic 35mm look, natural light, shallow depth of field, steady handheld camera, no on-screen text, no captions.';

export const SCENES: Scene[] = [
  {
    id: 's01',
    type: 'i2v',
    chapter: 1,
    narration:
      "Every week, you work hard for your money. And every week, it seems to disappear before you can save any of it.",
    prompt:
      `${MAIN} walks toward the camera along a busy city sidewalk at golden hour carrying a small cardboard package. His smile fades into a tired, thoughtful look as he glances at his phone. A yellow taxi passes behind him. ${STYLE}`,
  },
  {
    id: 's02',
    type: 'avatar',
    chapter: 1,
    narration:
      "MutualPool changes that. It's a savings pod for gig and trade workers, built on an idea communities have trusted for generations. You may know it as a tanda, a susu, a chama, or a chit fund.",
  },
  {
    id: 's03',
    type: 't2v',
    chapter: 2,
    references: ['main', 'crew'],
    narration:
      "Here's how it works. You and your crew each put in the same amount every week. Twenty dollars, fifty, whatever your pod agrees on.",
    prompt:
      `Five gig workers in delivery jackets and work hoodies, including ${MAIN} and ${CREW}, gathered around a small cafe table. Each one places a folded twenty dollar bill into the center of the table, laughing together. Warm afternoon light through the window. ${STYLE}`,
  },
  {
    id: 's04',
    type: 'avatar',
    chapter: 2,
    narration:
      "Each week, one member receives the whole pot. The order is set when the pod locks, so everyone knows exactly when their turn is coming.",
  },
  {
    id: 's05',
    type: 'avatar',
    chapter: 2,
    narration:
      "No interest. No credit check. No loan. It's your own money, pooled with people you trust, paid out in full when it's your turn.",
  },
  {
    id: 's06',
    type: 't2v',
    chapter: 2,
    references: ['main', 'crew'],
    narration:
      "Start a Trusted Circle with friends or your delivery crew, or join an Open Pod with verified members across the network. Your identity is verified, and so is everyone else's.",
    prompt:
      `${MAIN} and ${CREW} fist-bump beside two parked electric delivery bikes on a bright city street, then one of them holds up his phone showing a clean mobile app screen with a large green verified check mark badge. Bright daylight, upbeat mood. ${STYLE}`,
  },
  {
    id: 's07',
    type: 't2v',
    chapter: 3,
    references: ['main'],
    narration:
      "Deposits come out of your MutualPool balance every Thursday. Payouts land every Friday. Fund your balance from your bank, or have your earnings deposited straight into it.",
    prompt:
      `Close-up of ${MAIN} sitting in the driver's seat of a parked car at dusk, glancing down at his phone and breaking into a relieved smile as a payment notification arrives. Soft evening light through the windshield, city bokeh in the background. ${STYLE}`,
  },
  {
    id: 's08',
    type: 'avatar',
    chapter: 3,
    narration:
      "The fees are simple and there are no surprises. Five percent on each weekly deposit. Ten percent on each payout, and three of that goes to the member hosting the pod. That's it.",
  },
  {
    id: 's09',
    type: 't2v',
    chapter: 3,
    references: ['main', 'crew'],
    narration:
      "If someone misses a deposit, the whole pod knows right away, and the rules protect the people who keep paying. Your pod decides together what happens next.",
    prompt:
      `A small group of gig workers including ${MAIN} and ${CREW} stand together under a storefront awning at dusk, looking at their phones and nodding to each other as they make a group decision. Serious but supportive mood, soft neon reflections on the wet pavement. ${STYLE}`,
  },
  {
    id: 's10',
    type: 't2v',
    chapter: 4,
    references: ['main'],
    narration:
      "Beyond saving, MutualPool brings you road perks from partners who get gig life: meals, repairs, phone plans, and more. Benefits that are not provided by your current employer.",
    prompt:
      `${MAIN} grabs a hot meal from a food truck window and nods thanks, then a mechanic at a small tire shop hands him a freshly repaired tire, then he picks up a phone from a repair counter and checks the screen with a grin. Bright, upbeat, quick cuts. ${STYLE}`,
  },
  {
    id: 's11',
    type: 'i2v',
    chapter: 4,
    narration:
      "And brand campaigns that pay you for the miles you already drive. Yes, we partnered with local businesses to sponsor you as you make your deliveries. Wear hoodies or shirt with their message on it, and get paid by the day.",
    prompt:
      `${MAIN} walks confidently toward the camera on a busy city sidewalk carrying a package, turns slightly to show the yellow sleeve print on his hoodie, and grins. Slow push-in, golden hour, pedestrians and a yellow taxi softly blurred behind him. ${STYLE}`,
  },
  {
    id: 's12',
    type: 'avatar',
    chapter: 4,
    narration: "Have a question? Ask Lainie, your built-in guide, any time.",
  },
  {
    id: 's13',
    type: 'avatar',
    chapter: 4,
    narration: "Pool together. Grow together. Deliver together. That's MutualPool.",
  },
];

/**
 * System prompt for the Runway avatar. Only used if the avatar is ever put in a live session;
 * the ad clips are lip-synced to pre-generated narration. Runway moderates this text, so keep it
 * short and plain (the full character brief lives in the storyboard comments above).
 */
export const AVATAR_PERSONALITY =
  'A friendly, upbeat gig worker who hosts MutualPool savings pods. He explains how pods work in plain, honest language, keeps his word, and believes people get further when they support each other.';
