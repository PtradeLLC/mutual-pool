#!/usr/bin/env bash
# Deploy MutualPool to Fly.io from a developer machine.
#
#   npm run deploy
#
# Reads the public VITE_FIREBASE_* web-app settings from .env (they are inlined
# into the browser bundle at build time, so they must be passed as build args),
# builds the image on Fly's builders, deploys exactly one machine, and checks
# the result. Runtime secrets (Stripe, DATABASE_URL, ...) are NOT touched here;
# they live in `fly secrets` (see DEPLOY.md).
#
# Set DEPLOY_DRY_RUN=1 to print the command (values masked) without deploying.
set -euo pipefail

cd "$(dirname "$0")/.."

APP="${FLY_APP:-mutual-pool}"
ENV_FILE="${ENV_FILE:-.env}"

# Prefer `fly` on PATH; fall back to the default installer location.
if command -v fly >/dev/null 2>&1; then FLY=fly
elif [ -x "$HOME/.fly/bin/fly" ]; then FLY="$HOME/.fly/bin/fly"
else echo "flyctl not found. Install: curl -L https://fly.io/install.sh | sh" >&2; exit 1
fi

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE not found; copy .env.example and fill it in." >&2; exit 1; }

# Read one KEY from the env file without sourcing it (no code execution,
# surrounding quotes stripped). Prints nothing if the key is absent/empty.
env_value() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | sed -E 's/^[A-Z_]+=//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

REQUIRED=(VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_APP_ID)
OPTIONAL=(VITE_FIREBASE_MESSAGING_SENDER_ID)

args=()
missing=()
for key in "${REQUIRED[@]}"; do
  v="$(env_value "$key")"
  if [ -z "$v" ]; then missing+=("$key"); else args+=(--build-arg "$key=$v"); fi
done
for key in "${OPTIONAL[@]}"; do
  v="$(env_value "$key")"
  [ -n "$v" ] && args+=(--build-arg "$key=$v")
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing in $ENV_FILE: ${missing[*]}" >&2
  exit 1
fi

# --ha=false: this server keeps state in memory and must run as ONE machine.
cmd=("$FLY" deploy --remote-only --ha=false --app "$APP" "${args[@]}")

if [ "${DEPLOY_DRY_RUN:-}" = "1" ]; then
  printf '%s' "${cmd[0]}"
  for a in "${cmd[@]:1}"; do
    case "$a" in
      VITE_*=*) printf ' %s=***' "${a%%=*}" ;;
      *) printf ' %s' "$a" ;;
    esac
  done
  echo
  exit 0
fi

"${cmd[@]}"

echo
echo "== Post-deploy checks =="
count="$("$FLY" machines list --app "$APP" --json 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))' 2>/dev/null || true)"
if [ "${count:-0}" != "1" ]; then
  echo "WARNING: expected 1 machine, found ${count:-?}. Run: $FLY scale count 1 --app $APP --yes" >&2
else
  echo "machines: 1 (ok)"
fi
printf 'health: '
curl -fsS -m 10 "https://$APP.fly.dev/api/health" || echo "(no response)"
echo
