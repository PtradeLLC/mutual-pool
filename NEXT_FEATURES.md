# Next Features

Features we plan to build after a successful launch. The launch itself runs on
four Column products: Bank Accounts, Book Transfers, ACH and Realtime (see
DEPLOY.md). Column approves each new product separately, and each one expands
the compliance program we run in-house, so every item below lists the
compliance work it brings with it.

Listed in priority order.

## 1. Debit card on the member account

**Column product:** Card Issuing (ask Column how it differs from Card Programs,
and whether we need a separate card processor).

Give every member a debit card on their MutualPool account so they can spend
a payout directly instead of moving it to another bank first.

Why:
- Gig workers often need payout money right away.
- It makes MutualPool the member's main account. Premium perks already depend
  on earnings landing in the MutualPool account
  (`PREMIUM_EARNINGS_WINDOW_DAYS`); a card gives members a reason to point
  their Uber, DoorDash or Instacart payouts there.
- Interchange from card swipes is revenue that doesn't depend on pod fees.
- Partners in the perks marketplace can offer deals tied to card spending
  (gas, phone plans, gear).

Compliance work: card fraud monitoring, disputes and error resolution under
Reg E, card network rules, cardholder agreement and disclosures.

## 2. Direct deposit of gig earnings (built)

**Column product:** Bank Accounts (already live).

Built: the direct deposit screen (`src/components/DirectDepositModal.tsx`,
opened from the premium-perk buttons) shows the member's account and routing
numbers, tells them where to enter them for each gig app, and confirms once the
first payout arrives. Incoming credits are sorted in `src/server/earnings.ts`:
gig-platform payouts and paychecks count as earnings and unlock premium perks;
a member's own transfers only add balance.

Left to do: it only works once custody runs at Column
(`CUSTODY_PROVIDER=column`). Check the gig-platform name patterns against
real deposits during the pilot and add any that are missed. Monitoring rules
should expect regular payroll-style credits.

## 3. Credit building from pod payments

**Column product:** Loan Origination (if a credit-builder loan is the
structure), or none if we report pod payments directly.

Report members' on-time weekly pod payments to the credit bureaus, so taking
part in a savings circle builds a credit history. Many of our members have
thin credit files, and this is a proven model for savings-circle programs.

Compliance work: FCRA (accurate reporting, handling disputes) and bureau
onboarding. A loan-based structure also brings TILA, ECOA and UDAAP.

## 4. Advances against an upcoming payout

**Column product:** Loan Origination.

Let a member draw a small advance against the payout slot they're scheduled to
receive, for emergencies. Could eventually replace some Hardship Fund
requests, which today put platform money into the pot.

Compliance work: full consumer-lending program (TILA, ECOA, FCRA, UDAAP, state
lending rules). Only after the compliance program has a track record.

## 5. Markets outside the US

**Column product:** none (Column is US only). Each market has its own local
payment provider.

Markets: the UK (Stripe UK), Nigeria (Paystack), Mexico (Stripe Mexico: card,
OXXO, SPEI) and Kenya (Paystack Kenya: M-Pesa, card). The Netherlands was
dropped in favour of Mexico and Kenya, where tandas and chamas are widespread.
Country settings live in `src/config/countries/`; the payment providers in
`src/services/payments/` call the real Stripe and Paystack APIs with each
market's own keys (see `.env.example`). Production still returns "not open
yet" for every non-US deposit.

Left to do before any market launches:
- Pods and balances are kept in USD everywhere (`balanceUsd`, `potUsd` and
  the $1,000 / $2,500 / $5,000 join limits), so they need a currency per pod
  and per balance.
- Webhook routes that credit deposits and confirm payouts for each provider.
- The browser deposit flow has to follow the provider's checkout link
  (`redirectUrl`); today it only handles the US Stripe flow.
- A local entity, licence or partner, identity checks (Smile ID in Kenya and
  Nigeria) and a legal review in each country. The legal entity names in the
  country settings are placeholders.

## 6. Sending money abroad

**Column product:** Multicurrency, Global Banking or Stablecoins.

Many of our members support family in other countries. Letting them send a
payout abroad from the app fits the audience. Cross-border transfers carry the
heaviest compliance load on this list (sanctions screening across corridors,
remittance-transfer rules under Reg E), so it comes last.

## Engineering: run more than one server

Not a member-facing feature, but needed before the features above add load.
The server keeps working state in memory and must run as exactly one machine
(see `fly.toml` and DEPLOY.md). Moving that state into Postgres would allow
several machines, deploys without downtime and failover.
