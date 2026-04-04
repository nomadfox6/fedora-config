#!/usr/bin/env bash
set -euo pipefail

# ── Phase 1: Build dependencies ──────────────
echo "==> Installing build dependencies..."
dnf5 install -y \
    meson ninja-build vala valadoc golang npm \
    gjs gjs-devel \
    gobject-introspection-devel \
    gtk4-devel gtk4-layer-shell-devel \
    glib2-devel json-glib-devel \
    wayland-protocols-devel \
    appmenu-glib-translator appmenu-glib-translator-devel

# ── Phase 2: Astal ───────────────────────────
echo "==> Cloning Astal..."
BUILD_DIR="$(getent passwd "$SUDO_USER" | cut -d: -f6)/astal"
if [ ! -d "$BUILD_DIR" ]; then
    sudo -u "$SUDO_USER" git clone https://github.com/aylur/astal.git "$BUILD_DIR"
fi
chown -R "$SUDO_USER:$SUDO_USER" "$BUILD_DIR"

echo "==> Building astal-io..."
cd "$BUILD_DIR/lib/astal/io"
meson setup build --wipe
meson install -C build

echo "==> Building astal4 (GTK4)..."
cd "$BUILD_DIR/lib/astal/gtk4"
meson setup build --wipe
meson install -C build

echo "==> Building astal-tray..."
cd "$BUILD_DIR/lib/tray"
meson setup build --wipe
meson install -C build

echo "==> Building astal-hyprland..."
cd "$BUILD_DIR/lib/hyprland"
meson setup build --wipe
meson install -C build

# ── Phase 3: AGS ─────────────────────────────
echo "==> Cloning AGS..."
AGS_DIR="$(getent passwd "$SUDO_USER" | cut -d: -f6)/ags"
if [ ! -d "$AGS_DIR" ]; then
    sudo -u "$SUDO_USER" git clone https://github.com/aylur/ags.git "$AGS_DIR"
fi
chown -R "$SUDO_USER:$SUDO_USER" "$AGS_DIR"

echo "==> Building AGS..."
cd "$AGS_DIR"
sudo -u "$SUDO_USER" npm install
meson setup build --wipe
meson install -C build

echo ""
echo "Done. AGS is installed. Run 'ags --version' to verify."
