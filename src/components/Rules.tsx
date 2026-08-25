import React, { useState } from 'react';

const Rules: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);


    return (
        <>
         <div>
            # Rules

Everything you need to know about how pools work, how payouts are decided, and how your money is protected.

## The two kinds of pods

Every pod is one of two types. You choose which one when you create it.

### 🔒 Trusted Circle (default)

A Trusted Circle is built from people you already know — contacts from your phone, email, or social invites. When you create a pod, we check which of your contacts are already members and invite the rest to join.

- Only people you invite can join.
- If your circle doesn't fill the pod within your set invite window, you can choose to open the remaining spots to verified members outside your circle, or keep waiting.
- Best for: friends, family, coworkers, people from your delivery hub or driver group — anyone you'd trust to show up every week.

### 🌐 Open Pod

An Open Pod is open to any verified member on the platform looking for a pod at that size and deposit tier.

- Matching is automatic — we fill your pod with verified members based on availability.
- Every member you're matched with has completed identity verification, and you can see their track record (cycles completed, on-time payment history) before the pod locks.
- To keep Open Pods safe for everyone, joining one requires having completed at least one full Trusted Circle cycle first, with no missed payments.
- Best for: members who don't have 20+ people in their network yet, or who want a pod to fill faster.

## How pods work

- **Pool Creation** — Any member can create a pod.
- **Starting size** — New accounts can create pods at the 20-member or 50-member size to start.
- **Starting deposit tiers** — New pods can be created at the $5, $10, or $20 deposit tier to start.
- **Growing your limits** — Larger pod sizes (100, 500, 1,000, 5,000, 10,000 members) and higher deposit tiers ($50, $100) unlock after you've completed a full pod cycle successfully, with no missed payments, over at least 3 months.
- **One tier per pod** — Every member in a pod deposits the same amount, on the same schedule. You can't mix deposit tiers within a single pod.
- **Invitations** — Pod creators invite members via contacts, shareable links, or social media (Trusted Circle), or the pod fills automatically (Open Pod).

## How your money is held

- **Every member has their own account** — Your deposits sit in your own individually held account, not in one shared pot controlled by another person. No single member ever holds or controls anyone else's money.
- **FDIC pass-through insurance** — Funds held in your account are eligible for FDIC pass-through insurance up to the applicable coverage limit, through our banking partner. *[Insert current Stripe-approved disclosure language and coverage limit here before publishing.]*
- **Locked once deposited** — Once you deposit into a cycle, that deposit can't be withdrawn or canceled. It's released automatically to that week's recipient.
- **No interest** — Deposits don't earn interest. Every dollar you put in comes back to you as your full payout when it's your turn — no more, no less.

## How payout order works

We know "who gets picked" is the most important part of this — here's exactly how it works, with no randomness involved once your pod is locked in.

- **Order is set once, when your pod locks** (i.e., when it reaches full membership). We randomize the order one time, and that becomes the fixed schedule for the entire cycle.
- **Every week, the full pool goes to whoever is next in that fixed order.** There's no re-drawing, no weekly lottery, and no chance involved after your pod locks — you'll always know roughly when your turn is coming.
- **Once you've received your payout, you're not eligible again** until every other member of your pod has had their turn.
- **Need your turn moved up?** You can request early payout for a documented emergency. Requests go through a review process — either a pod-wide vote or an admin review, depending on your pod's settings — and every decision is logged and visible to the pod.
- **Want to trade spots?** Two members can agree to swap their positions in the order at any time, no review needed — just mutual consent.

## If a payment is missed

- A missed weekly deposit is flagged immediately and the member is marked delinquent.
- Upon wage payment or delinquency resolution, the full deposit amount is deducted directly from the member's account balance.
- If the account balance is not enough to cover the full deposit, the **Welcome Match Credited / First-Cycle Contingency Reserve** kicks in to cover the remainder.
- Once the Welcome Match covers the difference due to insufficient balance, the member is removed from the Pod due to missed payment default, and the Pod is publicly listed as an Open Pod to allow a verified replacement driver to join.

## The pod agreement

Before any pod locks and its first cycle begins, every member reviews and signs a plain-language agreement covering:

- The fixed payout order and how it was set
- No guaranteed return and no interest
- How reprioritization requests and slot swaps work
- What happens if someone misses a payment
- A link to the current insurance disclosure

If we ever update this agreement, you'll be asked to review and re-sign before your next cycle.

## Perks & Benefits

Being a member gets you more than access to your pod — it also unlocks a marketplace of real-world benefits built for delivery riders and drivers.

- **What's available** — Browse and search benefits across these categories:
  - Healthcare
  - Dental
  - Vision
  - Retirement plans
  - Training opportunities
  - Legal assistance
  - Mental health resources
  - Financial services
  - Discounts
  - Entertainment offers
  - Restaurants
  - Hotels
  - Retail savings
  - Insurance programs
  - Scholarships
  - Family benefits
  - Emergency assistance

- **Where they come from** — Some perks are added directly by our team; others are submitted by outside partners and reviewed before they go live, so you can trust that everything listed is legitimate.
- **Eligibility** — Most perks are open to all verified members. Some may require a bit more — like having completed a full pod cycle — and we'll always show you exactly what's needed before you try to redeem.
- **How to redeem** — Find a perk, tap redeem, and depending on the offer you'll get a promo code, a direct link, or a voucher. Your redemption history is saved so you can find it again anytime.
- **New perks added regularly** — We're always adding new categories and partners. If there's a benefit you wish was on here, let us know — member requests directly shape what we add next.

---

*Have questions about a specific pod? Every pod has its own transparency dashboard showing the live rotation order, deposit ledger, and payout schedule — accessible any time from the pod page.*
         </div>
        </>
    );
}