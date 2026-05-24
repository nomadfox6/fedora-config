#!/usr/bin/env bash
# Sends persistent critical dunst notifications at 20%, 10%, 5% battery.
# Only fires once per threshold per discharge cycle. No-op if no battery present.

BAT=$(ls /sys/class/power_supply/BAT* 2>/dev/null | head -1)
[[ -z "$BAT" ]] && exit 0

NOTIFIED=""

while true; do
    STATUS=$(cat "$BAT/status" 2>/dev/null)
    LEVEL=$(cat "$BAT/capacity" 2>/dev/null)

    if [[ "$STATUS" == "Discharging" && -n "$LEVEL" ]]; then
        for THRESHOLD in 20 10 5; do
            if (( LEVEL <= THRESHOLD )) && [[ "$NOTIFIED" != *"|$THRESHOLD|"* ]]; then
                notify-send -u critical -t 0 "Low Battery" "Battery at ${LEVEL}%"
                NOTIFIED="$NOTIFIED|$THRESHOLD|"
            fi
        done
    else
        NOTIFIED=""
    fi

    sleep 60
done
