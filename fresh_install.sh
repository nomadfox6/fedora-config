#!/usr/bin/env bash
set -euo pipefail

# ── COPR ─────────────────────────────────────
dnf5 copr enable solopasha/hyprland -y

# ── Packages ─────────────────────────────────
dnf5 install -y \
    `# Hyprland & Wayland core` \
    hyprland \
    hyprland-devel \
    qt5-qtwayland \
    qt6-qtwayland \
    `# XDG portals` \
    xdg-desktop-portal \
    xdg-desktop-portal-hyprland \
    `# Keyring` \
    gnome-keyring \
    `# Display manager` \
    sddm \
    `# Printing` \
    cups \
    system-config-printer \
    `# Terminal` \
    foot \
    `# Launcher` \
    wofi \
    `# Notifications` \
    dunst \
    libnotify \
    `# Audio` \
    pipewire \
    pipewire-pulseaudio \
    wireplumber \
    `# Screenshots` \
    grim \
    slurp \
    `# Clipboard` \
    wl-clipboard \
    `# Polkit agent` \
    hyprpolkitagent \
    `# Screen lock` \
    hyprlock \
    hypridle \
    `# Network` \
    network-manager-applet \
    wireguard-tools \
    `# Browser` \
    firefox \
    `# File manager` \
    nautilus \
    gvfs \
    gvfs-mtp \
    file-roller \
    loupe \
    `# Bluetooth` \
    blueman \
    `# Calculator` \
    gnome-calculator \
    `# Sync` \
    seafile-client \
    syncthing \
    `# User directories` \
    xdg-user-dirs \
    `# Fonts` \
    jetbrains-mono-fonts \
    fontawesome-6-free-fonts \
    fontawesome-6-brands-fonts \
    google-noto-color-emoji-fonts \
    `# GTK theme & icons` \
    papirus-icon-theme \
    adwaita-cursor-theme \
    `# Wallpaper` \
    swww \
    waypaper \
    python3-imageio \
    python3-screeninfo \
    python3-platformdirs \
    `# Python (Monique and pip tools)` \
    python3 \
    python3-pip \
    python3-gobject \
    gtk4 \
    libadwaita \
    `# cursor-clip build dependencies` \
    rust \
    cargo \
    dbus-devel \
    libadwaita-devel \
    `# AGS / hyprview build dependencies` \
    meson ninja-build vala valadoc golang npm \
    cmake gcc-c++ \
    gjs gjs-devel \
    gobject-introspection-devel \
    gtk4-devel gtk4-layer-shell-devel \
    glib2-devel json-glib-devel \
    wayland-protocols-devel \
    wayland-devel \
    wayland-scanner \
    ImageMagick \
    appmenu-glib-translator appmenu-glib-translator-devel \
    `# Flatpak` \
    flatpak

# ── Astal ─────────────────────────────────────
USER_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"

echo "==> Cloning and building Astal..."
git clone https://github.com/aylur/astal.git "$USER_HOME/astal"
chown -R "$SUDO_USER:$SUDO_USER" "$USER_HOME/astal"

cd "$USER_HOME/astal/lib/astal/io"
meson setup build && meson install -C build

cd "$USER_HOME/astal/lib/astal/gtk4"
meson setup build && meson install -C build

cd "$USER_HOME/astal/lib/tray"
meson setup build && meson install -C build

cd "$USER_HOME/astal/lib/hyprland"
meson setup build && meson install -C build

cd "$USER_HOME/astal/lib/battery"
meson setup build && meson install -C build

# ── AGS ───────────────────────────────────────
echo "==> Cloning and building AGS..."
git clone https://github.com/aylur/ags.git "$USER_HOME/ags"
chown -R "$SUDO_USER:$SUDO_USER" "$USER_HOME/ags"

cd "$USER_HOME/ags"
sudo -u "$SUDO_USER" npm install
meson setup build && meson install -C build

# ── Flatpak ───────────────────────────────────
echo "==> Adding Flathub remote..."
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

echo "==> Installing Flatpak apps..."
flatpak install -y flathub be.alexandervanhee.gradia

# ── cursor-clip (clipboard manager) ──────────
echo "==> Building cursor-clip..."
sudo -u "$SUDO_USER" git clone https://github.com/Sirulex/cursor-clip "$USER_HOME/cursor-clip"
sudo -u "$SUDO_USER" bash -c "cd '$USER_HOME/cursor-clip' && cargo build --release"
sudo -u "$SUDO_USER" mkdir -p "$USER_HOME/.local/bin"
sudo -u "$SUDO_USER" cp "$USER_HOME/cursor-clip/target/release/cursor-clip" "$USER_HOME/.local/bin/"

# ── ws-capture (workspace thumbnail capture binary) ──
echo "==> Building ws_capture..."
sudo -u "$SUDO_USER" bash "$USER_HOME/.config/hypr/ws-capture/build.sh"

# ── Remove unwanted COPR packages ────────────
echo "==> Removing unwanted packages..."
dnf5 remove -y nwg-panel 2>/dev/null || true
rm -rf "$USER_HOME/.config/nwg-panel"

# ── GTK theme (Nordic) ───────────────────────
echo "==> Installing Nordic GTK theme..."
sudo -u "$SUDO_USER" mkdir -p "$USER_HOME/.local/share/themes"
curl -sL "https://github.com/EliverLara/Nordic/releases/latest/download/Nordic.tar.xz" \
    -o /tmp/Nordic.tar.xz
tar -xf /tmp/Nordic.tar.xz -C "$USER_HOME/.local/share/themes/"
chown -R "$SUDO_USER:$SUDO_USER" "$USER_HOME/.local/share/themes/Nordic"

# ── GTK settings (gsettings only — files managed by install.sh) ──────────────
echo "==> Applying GTK settings..."
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface gtk-theme 'Nordic'
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface icon-theme 'Papirus-Dark'
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface cursor-theme 'Adwaita'
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface font-name 'JetBrains Mono 11'
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface document-font-name 'JetBrains Mono 11'
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface monospace-font-name 'JetBrains Mono 11'
sudo -u "$SUDO_USER" gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'

# ── Monique (display configurator) ───────────
echo "==> Installing Monique..."
sudo -u "$SUDO_USER" pip3 install --user monique

# ── SDDM Nordic theme ────────────────────────
echo "==> Installing SDDM Nordic theme..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p /usr/share/sddm/themes/nordic
cp "$SCRIPT_DIR/sddm-nordic/metadata.desktop" /usr/share/sddm/themes/nordic/
cp "$SCRIPT_DIR/sddm-nordic/Main.qml"         /usr/share/sddm/themes/nordic/
mkdir -p /etc/sddm.conf.d
cp "$SCRIPT_DIR/sddm-nordic/10-nordic.conf"   /etc/sddm.conf.d/

# ── Groups ───────────────────────────────────
usermod -aG video "$SUDO_USER"

# ── Services ─────────────────────────────────
systemctl set-default graphical.target
systemctl enable sddm
systemctl enable bluetooth
systemctl enable cups

# ── User directories ─────────────────────────
sudo -u "$SUDO_USER" xdg-user-dirs-update

# ── SDDM theme ───────────────────────────────
echo "==> Installing SDDM Nordic theme..."
mkdir -p /usr/share/sddm/themes/nordic
cp "$SCRIPT_DIR/sddm-nordic/Main.qml"         /usr/share/sddm/themes/nordic/
cp "$SCRIPT_DIR/sddm-nordic/metadata.desktop" /usr/share/sddm/themes/nordic/
mkdir -p /etc/sddm.conf.d
cp "$SCRIPT_DIR/sddm-nordic/10-nordic.conf"   /etc/sddm.conf.d/

# ── Symlink configs from repo ─────────────────
echo "==> Linking config files via install.sh..."
sudo -u "$SUDO_USER" bash "$SCRIPT_DIR/install.sh"

echo ""
echo "Done. Reboot to start into SDDM / Hyprland."
