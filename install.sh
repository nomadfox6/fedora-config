#!/usr/bin/env bash
# install.sh — symlink configs from this repo into ~/.config
# Run as your regular user (not root). Safe to re-run.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$HOME/.config"

# ── Helpers ───────────────────────────────────────────────────────────────────

green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
red()    { echo -e "\e[31m$*\e[0m"; }

link() {
    local src="$1"   # path in repo
    local dest="$2"  # path in ~/.config

    mkdir -p "$(dirname "$dest")"

    if [ -L "$dest" ]; then
        # Already a symlink — update it
        ln -sf "$src" "$dest"
        green "  updated  $dest"
    elif [ -e "$dest" ]; then
        # Real file exists — back it up then replace
        mv "$dest" "${dest}.bak"
        yellow "  backed up $dest -> ${dest}.bak"
        ln -s "$src" "$dest"
        green "  linked   $dest"
    else
        ln -s "$src" "$dest"
        green "  linked   $dest"
    fi
}

# ── Symlinks ──────────────────────────────────────────────────────────────────

echo ""
echo "==> Linking config files..."

link "$REPO/config/hypr/hyprland.conf"      "$CONFIG/hypr/hyprland.conf"
link "$REPO/config/hypr/hyprlock.conf"      "$CONFIG/hypr/hyprlock.conf"
link "$REPO/config/hypr/hypridle.conf"      "$CONFIG/hypr/hypridle.conf"
link "$REPO/config/ags/app.tsx"             "$CONFIG/ags/app.tsx"
link "$REPO/config/ags/style.css"           "$CONFIG/ags/style.css"
link "$REPO/config/foot/foot.ini"           "$CONFIG/foot/foot.ini"
link "$REPO/config/dunst/dunstrc"           "$CONFIG/dunst/dunstrc"
link "$REPO/config/wofi/config"             "$CONFIG/wofi/config"
link "$REPO/config/wofi/style.css"          "$CONFIG/wofi/style.css"
link "$REPO/config/gtk-3.0/settings.ini"    "$CONFIG/gtk-3.0/settings.ini"
link "$REPO/config/gtk-4.0/settings.ini"    "$CONFIG/gtk-4.0/settings.ini"

# ── monitors.conf — create empty if missing (Hyprland errors without it) ──────

if [ ! -e "$CONFIG/hypr/monitors.conf" ]; then
    touch "$CONFIG/hypr/monitors.conf"
    green "  created  $CONFIG/hypr/monitors.conf (empty)"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
green "All done. You may need to log out and back in for all changes to take effect."
echo ""
