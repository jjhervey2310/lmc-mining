#!/usr/bin/env bash
# Run ON THE DROPLET as root, from inside /root/lmc-desk after cloning/copying this directory there.
set -euo pipefail
cd /root/lmc-desk
[ -f .env ] || { echo "Create /root/lmc-desk/.env first (copy .env.example and fill it IN THIS TERMINAL). Aborting."; exit 1; }
timedatectl set-timezone America/Denver
apt-get update -qq && apt-get install -y -qq python3 curl jq ca-certificates gnupg >/dev/null
if ! command -v node >/dev/null; then curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null && apt-get install -y -qq nodejs >/dev/null; fi
command -v claude >/dev/null || npm install -g @anthropic-ai/claude-code >/dev/null
chmod 600 .env; chmod +x wake.sh price_check.py heartbeat.py context.py
mkdir -p state
cp systemd/*.service systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now lmc-price-check.timer lmc-wake.timer lmc-heartbeat.timer
echo "--- smoke test: price check ---"; python3 price_check.py
echo "--- timers ---"; systemctl list-timers 'lmc-*' --no-pager
echo "Installed. First hourly wake fires at :07. Kill switch: desk_config.loop_enabled (toggle on the ROBINHOOD tab)."
