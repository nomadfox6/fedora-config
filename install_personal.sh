#!/usr/bin/env bash
set -euo pipefail

# ── RPM Fusion (required for VLC and Steam) ───
echo "==> Enabling RPM Fusion..."
dnf5 install -y \
    "https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm" \
    "https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm"

# ── VS Code (Microsoft repo) ──────────────────
echo "==> Adding VS Code repo..."
rpm --import https://packages.microsoft.com/keys/microsoft.asc
cat > /etc/yum.repos.d/vscode.repo << 'EOF'
[code]
name=Visual Studio Code
baseurl=https://packages.microsoft.com/yumrepos/vscode
enabled=1
gpgcheck=1
gpgkey=https://packages.microsoft.com/keys/microsoft.asc
EOF

# ── DNF packages ──────────────────────────────
echo "==> Installing DNF packages..."
dnf5 install -y \
    code \
    vlc \
    steam \
    virt-manager

# ── Flatpak apps ──────────────────────────────
echo "==> Installing Flatpak apps..."
flatpak install -y flathub \
    org.signal.Signal \
    com.brave.Browser \
    md.obsidian.Obsidian \
    com.parsecgaming.parsec \
    us.zoom.Zoom

echo ""
echo "Done."
