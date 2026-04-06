# fedora-config

Hyprland desktop environment on Fedora 43 — minimal, Nord-themed.

## Stack

| Component | Package |
|---|---|
| WM | Hyprland (solopasha/hyprland COPR) |
| Display Manager | SDDM (custom Nord theme) |
| Terminal | foot |
| Launcher | wofi |
| Notifications | dunst |
| Panel | AGS v3 (built from source) |
| Audio | PipeWire + WirePlumber |
| Wallpaper | swww + waypaper |
| File Manager | Nautilus |
| Bluetooth | blueman |
| Clipboard | cursor-clip |
| Display Config | Monique |
| GTK Theme | Nordic |
| Icon Theme | Papirus-Dark |
| Cursor | Adwaita |
| Font | JetBrains Mono, FontAwesome 6 |

---

## Fresh system setup

Run these in order on a minimal Fedora 43 install.

**1. Clone this repo**
```bash
git clone git@gitea.internal-fish.com:nomadfox6/fedora-config.git ~/fedora-config
```

**2. Run the install script as root**

Installs all packages, builds AGS + Astal from source, enables services, and calls `install.sh` at the end to symlink configs.
```bash
sudo bash ~/fedora-config/fresh_install.sh
```

**3. Reboot**
```bash
reboot
```

SDDM will start. Log in to Hyprland.

---

## Config update workflow

All config files in `~/.config/` are symlinks into this repo. Edit them in place — changes are immediately reflected in the repo.

To commit and push an update:
```bash
cd ~/fedora-config
git add .
git commit -m "describe your change"
git push
```

---

## Repo layout

```
fedora-config/
├── fresh_install.sh        # Full system install (run as root)
├── fresh_install.sh.bak    # Backup of install script before last edit
├── build-ags.sh            # AGS/Astal build script (reference)
├── install.sh              # Symlinks configs, installs SDDM theme
├── sddm-nordic/
│   ├── Main.qml            # SDDM greeter UI
│   ├── metadata.desktop    # SDDM theme metadata
│   └── 10-nordic.conf      # Activates theme in /etc/sddm.conf.d/
└── config/
    ├── hypr/
    │   ├── hyprland.conf   # WM config, keybinds, autostart
    │   ├── hyprlock.conf   # Lock screen
    │   └── hypridle.conf   # Idle/sleep timeouts
    ├── ags/
    │   ├── app.tsx         # Panel (main, workspace switcher, settings)
    │   └── style.css       # Panel styles
    ├── foot/
    │   └── foot.ini        # Terminal — Nord theme
    ├── dunst/
    │   └── dunstrc         # Notifications — Nord theme
    ├── wofi/
    │   ├── config          # Launcher config
    │   └── style.css       # Launcher — Nord theme
    ├── gtk-3.0/
    │   └── settings.ini    # GTK3 theme settings
    └── gtk-4.0/
        └── settings.ini    # GTK4 theme settings
```

## Notes

- `~/.config/hypr/monitors.conf` is **not tracked** — it is machine-specific and written by Monique (display configurator). An empty file is created by `install.sh` if missing.
- AGS v3 and Astal are built from source — `build-ags.sh` documents the process and is called by `fresh_install.sh`.
- `fresh_install.sh` must be run as root (`sudo`). `install.sh` must be run as your regular user.
