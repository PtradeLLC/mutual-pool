# Deploying MutualPool to Fly.io

The server runs as **one** Fly machine with **Fly Postgres** as its database.
Sign-in stays on Firebase Auth; Stripe handles identity, bank accounts,
deposits, withdrawals and ACH debits.

Why one machine: the server keeps working state in memory and writes it to
Postgres behind the scenes. Two copies running at once (even briefly during a
deploy) can overwrite each other, so `fly.toml` pins one machine and uses the
`immediate` deploy strategy, which stops the old machine before starting the
new one. Expect a few seconds of downtime per deploy. Do not scale past one
machine or change the strategy without first moving state out of memory.

## One-time setup

1. Install flyctl and sign in: `fly auth login`.
2. Create the app without deploying (keep the existing `fly.toml`):

       fly launch --no-deploy --copy-config --name mutual-pool --region iad

3. Create the database and attach it. Attaching sets the `DATABASE_URL`
   secret on the app automatically (internal network, no TLS needed):

       fly postgres create --name mutual-pool-db --region iad --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 10
       fly postgres attach mutual-pool-db --app mutual-pool

   The server creates its single table (`app_documents`) on first boot.

   This is Fly's unmanaged ("Legacy") Postgres: cheap and fine for testing,
   but Fly does not support it and we own failover, upgrades and recovery.
   See "Before launch" below for the planned move to Managed Postgres.

4. Set the runtime secrets from your `.env` (everything except `VITE_*`,
   `NODE_ENV`, `PORT`, `TZ`, `APP_URL`, `STORAGE_BACKEND`, which live in
   `fly.toml`):

       fly secrets set \
         STRIPE_SECRET_KEY=sk_live_... \
         STRIPE_WEBHOOK_SECRET=whsec_... \
         STRIPE_CONNECT_WEBHOOK_SECRET=whsec_... \
         FIREBASE_PROJECT_ID=... \
         FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
         CRON_SECRET=... \
         RESEND_API_KEY=re_... \
         EMAIL_FROM='MutualPool <no-reply@themutualpool.com>' \
         ALERT_WEBHOOK_URL=https://hooks.slack.com/... \
         GEMINI_API_KEY=... GROQ_API_KEY=... \
         FOURTHWALL_API_KEY=... FOURTHWALL_SHOP_ID=... FOURTHWALL_WEBHOOK_SECRET=...

   `FIREBASE_SERVICE_ACCOUNT` is optional for the server itself (token
   verification works without it) but needed by `scripts/set-admin-claim.ts`.

5. Point the domain at the app and get a certificate:

       fly certs add themutualpool.com
       fly certs add www.themutualpool.com

   Add the A/AAAA (or CNAME) records flyctl prints at your registrar. Then in
   Firebase Auth → Settings → Authorized domains add `themutualpool.com`, and
   make sure both Stripe webhook destinations point at
   `https://themutualpool.com/api/webhooks/stripe`.

6. First deploy, passing the public Firebase web settings as build args
   (they are inlined into the browser bundle):

       fly deploy --remote-only --ha=false \
         --build-arg VITE_FIREBASE_API_KEY=... \
         --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
         --build-arg VITE_FIREBASE_PROJECT_ID=... \
         --build-arg VITE_FIREBASE_STORAGE_BUCKET=... \
         --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID=... \
         --build-arg VITE_FIREBASE_APP_ID=...

7. Confirm: `fly status` shows one machine; `https://themutualpool.com/api/health`
   returns `{"status":"ok"}`; signed in as an admin, the same URL also reports
   `persistence.backend: "postgres"`, the mailer status and the last sweeps.

## Every later deploy

Push to `main`. The GitHub Action in `.github/workflows/fly-deploy.yml` runs
the test suite and then `fly deploy`. It needs the repository secrets listed at
the top of that file (`FLY_API_TOKEN` plus the six `VITE_FIREBASE_*` values).

## Weekly sweeps

The server schedules the Thursday deposit and Friday payout sweeps itself,
records each run by settlement week, and catches up after downtime. An
external trigger is optional belt-and-braces: any scheduler can call

    POST https://themutualpool.com/api/platform/schedule/sweep
    x-cron-secret: <CRON_SECRET>
    {"sweepType":"THURSDAY_DEPOSITS"}   (Thu 00:05 America/New_York)
    {"sweepType":"FRIDAY_PAYOUTS"}      (Fri 00:05 America/New_York)

## Useful commands

    fly logs                      # live server logs (incidents are JSON lines)
    fly ssh console               # shell on the machine
    fly postgres connect -a mutual-pool-db     # psql
    fly secrets list              # names only
    fly scale show                # must stay at count 1

## Backups

Fly Postgres takes daily volume snapshots (retained 5 days by default). For a
manual dump:

    fly postgres connect -a mutual-pool-db -c "\\copy (select * from app_documents) to 'backup.csv' csv header"

or `pg_dump` through `fly proxy 15432:5432 -a mutual-pool-db`.

## Before launch: move to Managed Postgres

Do this before real members deposit money. Managed Postgres (`fly mpg`) gives
automatic failover, backups with point-in-time restore, connection pooling
and Fly support; Basic plan (shared CPU, 1 GB) is enough for one server
machine. Managed clusters offer Postgres 16/17 and cannot be upgraded across
major versions in place.

1. Create the cluster and note the cluster ID it prints:

       fly mpg create --name mutual-pool-pg --org chris-bitoye-ventures-llc --region iad --plan Basic --pg-major-version 17 --volume-size 10

2. If the old database has data worth keeping, dump it first (see Backups).
   Attaching below replaces `DATABASE_URL`, and the server loads whatever the
   new database holds; restore the dump into the new cluster via
   `fly mpg proxy <CLUSTER_ID>` and `psql` before step 4.
3. Swap the attachment (the app restarts twice; a short outage):

       fly postgres detach mutual-pool-db --app mutual-pool
       fly mpg attach <CLUSTER_ID> --app mutual-pool

   If the logs show a TLS/SSL error on boot, add
   `fly secrets set DATABASE_SSL=true`; the server then connects with TLS.
4. Verify `fly logs` shows collections loaded from postgres and
   `/api/health` is ok. Then destroy the old cluster:

       fly apps destroy mutual-pool-db --yes

5. Update the psql and backup commands above to their `fly mpg` equivalents
   (`fly mpg connect`, `fly mpg backup list`, `fly mpg restore`).
