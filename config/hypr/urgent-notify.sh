#!/usr/bin/env bash
# Listens for Hyprland urgent window events and shows a persistent dunst notification

INSTANCE=$(ls /run/user/$(id -u)/hypr/)
SOCKET="/run/user/$(id -u)/hypr/$INSTANCE/.socket2.sock"

python3 - "$SOCKET" << 'EOF'
import socket, sys, subprocess, json

sock_path = sys.argv[1]
s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect(sock_path)

buf = ""
while True:
    data = s.recv(4096).decode("utf-8", errors="replace")
    if not data:
        break
    buf += data
    while "\n" in buf:
        line, buf = buf.split("\n", 1)
        if not line.startswith("urgent>>"):
            continue
        addr = line.split(">>", 1)[1].strip()
        try:
            clients = json.loads(subprocess.check_output(["hyprctl", "clients", "-j"]))
            win = next((c for c in clients if hex(c["address"]) == addr or c["address"] == addr), None)
            app   = win["class"] if win else "Unknown"
            title = win["title"] if win else addr
        except Exception:
            app, title = "Unknown", addr
        subprocess.run(["notify-send", "-u", "critical", "-t", "0",
                        "Window needs attention", f"{app} — {title}"])
EOF
