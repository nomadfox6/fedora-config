#!/usr/bin/env bash
# Dynamically sizes hyprexpo columns based on active workspace count, then toggles

count=$(hyprctl -j workspaces | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

# columns = ceil(sqrt(count)), minimum 2
columns=$(python3 -c "import math; print(max(2, math.ceil(math.sqrt($count))))")

hyprctl keyword plugin:hyprexpo:columns "$columns" -q
hyprctl dispatch hyprexpo:expo toggle
