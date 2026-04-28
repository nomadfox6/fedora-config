#!/usr/bin/env bash
# ws-thumbs.sh - Capture workspace thumbnails using hyprland_toplevel_export protocol.
# Outputs scaled PNGs to /tmp/ws-overview-<id>.png (one per populated workspace).
# No workspace switching needed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$HOME/.local/bin/ws_capture"
MONITOR_W=1280
MONITOR_H=800
THUMB_W=220
THUMB_H=138

# ── Ensure binary is built ────────────────────────────────────────────────────
if [[ ! -x "$BINARY" ]]; then
    bash "$SCRIPT_DIR/ws-capture/build.sh" || { echo "ws-thumbs: build failed" >&2; exit 1; }
fi

# ── Get monitor geometry from hyprctl ────────────────────────────────────────
MONITOR_JSON=$(hyprctl monitors -j 2>/dev/null | python3 -c "
import json, sys
m = json.load(sys.stdin)
if m:
    print(m[0]['width'], m[0]['height'])
" 2>/dev/null || echo "$MONITOR_W $MONITOR_H")
MONITOR_W=$(echo "$MONITOR_JSON" | cut -d' ' -f1)
MONITOR_H=$(echo "$MONITOR_JSON" | cut -d' ' -f2)

# ── Build input data from hyprctl clients ────────────────────────────────────
CLIENT_DATA=$(hyprctl clients -j 2>/dev/null | python3 -c "
import json, sys
clients = json.load(sys.stdin)
for c in clients:
    ws   = c.get('workspace', {}).get('id', 0)
    at   = c.get('at', [0, 0])
    sz   = c.get('size', [100, 100])
    # Clamp to monitor bounds
    x = max(0, at[0])
    y = max(0, at[1])
    w = max(1, sz[0])
    h = max(1, sz[1])
    title = c.get('title', '').replace('\t', ' ') or 'untitled'
    print(f'{title}\t{ws}\t{x}\t{y}\t{w}\t{h}')
" 2>/dev/null)

# ── Run capture binary ────────────────────────────────────────────────────────
WS_IDS=$(echo "$CLIENT_DATA" | "$BINARY")

if [[ -z "$WS_IDS" ]]; then
    echo "ws-thumbs: no workspaces captured" >&2
    exit 1
fi

# ── Composite per-workspace thumbnails ───────────────────────────────────────
for WS_ID in $WS_IDS; do
    OUT="/tmp/ws-overview-${WS_ID}.png"

    # Start with a dark Nord background
    ARGS=(-size "${MONITOR_W}x${MONITOR_H}" xc:'#2E3440')

    # Add each captured window for this workspace
    for META in /tmp/ws-win-${WS_ID}-*.meta; do
        [[ -f "$META" ]] || continue
        RAW="${META%.meta}.raw"
        [[ -f "$RAW" ]] || continue

        read -r FMT BUF_W BUF_H _STRIDE _WS WX WY _WW _WH _TITLE < "$META"

        # Clamp geometry to monitor bounds
        WX=$(( WX < 0 ? 0 : WX ))
        WY=$(( WY < 0 ? 0 : WY ))

        ARGS+=(
            \(
                -size "${BUF_W}x${BUF_H}"
                -depth 8
                "BGRA:${RAW}"
            \)
            -geometry "+${WX}+${WY}"
            -composite
        )
    done

    # Composite and scale to thumbnail size
    magick "${ARGS[@]}" \
        -resize "${THUMB_W}x${THUMB_H}!" \
        "$OUT" 2>/dev/null || true
done

echo "ws-thumbs: done"
