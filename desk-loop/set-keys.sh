#!/usr/bin/env bash
# Prompts for the two secrets and writes them into .env (chmod 600).
# Input IS shown as you paste so you can see it worked. Run: bash /root/lmc-desk/set-keys.sh
set -euo pipefail
ENV=/root/lmc-desk/.env
touch "$ENV"; chmod 600 "$ENV"
set_key() {
  local name="$1" prompt="$2" val=""
  printf '%s\n' "$prompt"
  read -r val
  if [ -z "$val" ]; then echo "  (skipped $name — left unchanged)"; return; fi
  # strip accidental surrounding quotes/spaces
  val="$(printf '%s' "$val" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^['\"]//" -e "s/['\"]$//")"
  grep -v "^${name}=" "$ENV" > "$ENV.tmp" 2>/dev/null || true
  printf '%s=%s\n' "$name" "$val" >> "$ENV.tmp"
  mv "$ENV.tmp" "$ENV"; chmod 600 "$ENV"
  echo "  ✓ $name saved (${#val} characters)"
}
grep -q '^SUPABASE_URL=' "$ENV" || echo 'SUPABASE_URL=https://bngwwalucfirmcymqall.supabase.co' >> "$ENV"
grep -q '^MONTHLY_CAP_USD=' "$ENV" || echo 'MONTHLY_CAP_USD=30' >> "$ENV"
echo "=== LMC desk — set secrets ===\nPaste each key with Cmd+V (Mac Terminal) or Ctrl+Shift+V, then press Enter.\nPress Enter alone to skip a key."
set_key SUPABASE_SERVICE_KEY "1) Paste the Supabase SERVICE_ROLE key, then press Enter:"
set_key ANTHROPIC_API_KEY    "2) Paste your NEW Anthropic API key, then press Enter:"
echo
echo "Done. Current .env keys (values hidden):"
sed 's/=.*/=<set>/' "$ENV" | sed 's/=<set>$/=<EMPTY>/;t;s/$//' >/dev/null 2>&1 || true
awk -F= '{ if ($2 == "") print "  " $1 "=<EMPTY>"; else print "  " $1 "=<set, " length($2) " chars>" }' "$ENV"
