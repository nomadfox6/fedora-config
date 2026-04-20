#!/usr/bin/env bash
# update.sh — pull latest changes and refresh symlinks + running services
# Run as your regular user (not root). Safe to re-run.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }

# ── Pull latest changes ───────────────────────────────────────────────────────

echo ""
echo "==> Pulling latest changes..."
git -C "$REPO" pull
echo ""

# ── Re-run install.sh to refresh symlinks ─────────────────────────────────────

echo "==> Refreshing symlinks..."
bash "$REPO/install.sh"

# ── Reload Hyprland config ────────────────────────────────────────────────────

echo "==> Reloading Hyprland..."
if hyprctl reload 2>/dev/null; then
    green "  Hyprland reloaded"
else
    yellow "  Hyprland not running, skipping reload"
fi

# ── Restart AGS panel ─────────────────────────────────────────────────────────

echo "==> Restarting AGS panel..."
if ags quit 2>/dev/null; then
    sleep 1
fi
if ags run "$HOME/.config/ags/app.tsx" &>/dev/null & disown; then
    green "  AGS restarted"
else
    yellow "  AGS failed to start"
fi

# ── Restart urgent-notify daemon ──────────────────────────────────────────────

echo "==> Restarting urgent-notify daemon..."
pkill -f urgent-notify 2>/dev/null || true
sleep 0.5
bash "$HOME/.config/hypr/urgent-notify.sh" &>/dev/null & disown
green "  urgent-notify restarted"

# ── Restart dunst ─────────────────────────────────────────────────────────────

echo "==> Restarting dunst..."
if pkill dunst 2>/dev/null; then
    sleep 0.5
fi
dunst &>/dev/null & disown
green "  dunst restarted"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
green "Update complete."
echo ""
