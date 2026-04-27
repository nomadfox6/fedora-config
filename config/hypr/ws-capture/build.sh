#!/usr/bin/env bash
# build.sh - Build the ws_capture Wayland thumbnail capture binary.
# Protocol XMLs are bundled in this directory.
# Output: ~/.local/bin/ws_capture

set -euo pipefail

BUILD_DIR="$(mktemp -d /tmp/ws-capture-build-XXXXXX)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HOME/.local/bin/ws_capture"

echo "ws-capture: building in $BUILD_DIR"

WLR_TOPLEVEL_XML="$SCRIPT_DIR/wlr-foreign-toplevel-management-unstable-v1.xml"
HYPR_EXPORT_XML="$SCRIPT_DIR/hyprland-toplevel-export-v1.xml"

for f in "$WLR_TOPLEVEL_XML" "$HYPR_EXPORT_XML"; do
    [[ -f "$f" ]] || { echo "ws-capture: missing $f" >&2; exit 1; }
done

# ── Generate Wayland bindings ──────────────────────────────────────────────
wayland-scanner client-header "$WLR_TOPLEVEL_XML" "$BUILD_DIR/wlr-foreign-toplevel-management-v1-client.h"
wayland-scanner private-code   "$WLR_TOPLEVEL_XML" "$BUILD_DIR/wlr-foreign-toplevel-management-v1.c"

wayland-scanner client-header "$HYPR_EXPORT_XML" "$BUILD_DIR/hyprland-toplevel-export-v1-client.h"
wayland-scanner private-code   "$HYPR_EXPORT_XML" "$BUILD_DIR/hyprland-toplevel-export-v1.c"

# ── Compile ────────────────────────────────────────────────────────────────
cp "$SCRIPT_DIR/ws_capture.c" "$BUILD_DIR/"

gcc -o "$BUILD_DIR/ws_capture" \
    "$BUILD_DIR/ws_capture.c" \
    "$BUILD_DIR/wlr-foreign-toplevel-management-v1.c" \
    "$BUILD_DIR/hyprland-toplevel-export-v1.c" \
    $(pkg-config --cflags --libs wayland-client) \
    -lrt

mkdir -p "$HOME/.local/bin"
cp "$BUILD_DIR/ws_capture" "$OUT"
chmod +x "$OUT"

rm -rf "$BUILD_DIR"
echo "ws-capture: built successfully → $OUT"
