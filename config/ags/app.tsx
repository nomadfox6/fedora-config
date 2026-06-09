import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import Gio from "gi://Gio"
import Graphene from "gi://Graphene"
import AstalTray from "gi://AstalTray?version=0.1"
import AstalHyprland from "gi://AstalHyprland?version=0.1"
import AstalBattery from "gi://AstalBattery?version=0.1"
import { createPoll } from "ags/time"
import { createBinding, createComputed, For } from "ags"

// ── Clock + Date (top-left) ──────────────────────────────────────────────────

function Clock({ hide, showSettings }: { hide: () => void, showSettings: () => void }) {
    const time = createPoll("", 1000, () =>
        GLib.DateTime.new_now_local().format("%H:%M:%S")!
    )
    const date = createPoll("", 60000, () =>
        GLib.DateTime.new_now_local().format("%A, %B %e")!
    )

    const launch = (argv: string[]) => {
        hide()
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE)
    }

    const quickLaunchApps = [
        { icon: "\uF120", tooltip: "Terminal",      cmd: ["foot"] },
        { icon: "\uF07B", tooltip: "Files",         cmd: ["nautilus"] },
        { icon: "\uF269", tooltip: "Firefox",       cmd: ["firefox"] },
        { icon: "\uF121", tooltip: "VS Code",       cmd: ["code"] },
    ]

    const serviceApps = [
        {
            icon: "\uF0C2",
            tooltip: "Seafile",
            procName: "seafile-applet",
            startCmd: ["seafile-applet"],
            stopCmd: ["pkill", "seafile-applet"],
        },
        {
            icon: "\uF021",
            tooltip: "Syncthing",
            procName: "syncthing",
            startCmd: ["syncthing", "--no-browser"],
            stopCmd: ["pkill", "syncthing"],
        },
    ]

    return (
        <box cssClasses={["clock-box"]} orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.START} valign={Gtk.Align.START}>
            <label cssClasses={["time"]} label={time} halign={Gtk.Align.START} />
            <label cssClasses={["date"]} label={date} halign={Gtk.Align.START} />
            <button
                cssClasses={["run-menu-btn"]}
                hexpand={true}
                onClicked={() => {
                    hide()
                    Gio.Subprocess.new(["wofi", "--show", "drun"], Gio.SubprocessFlags.NONE)
                }}
            >
                <label label="Run Menu" />
            </button>
            <button
                cssClasses={["run-menu-btn"]}
                hexpand={true}
                onClicked={() => { hide(); showSettings() }}
            >
                <label label="Settings" />
            </button>
            <box cssClasses={["quick-launch"]} homogeneous={true}>
                {quickLaunchApps.map(({ icon, tooltip, cmd }) => (
                    <button
                        cssClasses={["quick-btn"]}
                        tooltipText={tooltip}
                        onClicked={() => launch(cmd)}
                    >
                        <label cssClasses={["quick-icon"]} label={icon} />
                    </button>
                ))}
            </box>
            <box cssClasses={["service-btns"]}>
                {serviceApps.map(({ icon, tooltip, procName, startCmd, stopCmd }) => {
                    const running = createPoll(false, 2000, () =>
                        runSync(["pgrep", "-x", procName]) !== ""
                    )
                    return (
                        <button
                            cssClasses={["ctrl-btn", "ctrl-off"]}
                            tooltipText={tooltip}
                            onClicked={() => {
                                if (running.get()) {
                                    Gio.Subprocess.new(stopCmd, Gio.SubprocessFlags.NONE)
                                } else {
                                    Gio.Subprocess.new(startCmd, Gio.SubprocessFlags.NONE)
                                }
                            }}
                            $={(self) => {
                                const update = () => {
                                    const on = running.get()
                                    self.cssClasses = on
                                        ? ["ctrl-btn", "ctrl-on"]
                                        : ["ctrl-btn", "ctrl-off"]
                                }
                                running.subscribe(update)
                                setTimeout(update, 100)
                            }}
                        >
                            <label cssClasses={["quick-icon"]} label={icon} />
                        </button>
                    )
                })}
            </box>
        </box>
    )
}

// ── System Tray (top-right) ──────────────────────────────────────────────────

function TrayItem({ item }: { item: AstalTray.TrayItem }) {
    const icon = createBinding(item, "gicon")

    const init = (btn: Gtk.MenuButton) => {
        btn.menuModel = item.menuModel
        btn.insert_action_group("dbusmenu", item.actionGroup)
        item.connect("notify::action-group", () => {
            btn.insert_action_group("dbusmenu", item.actionGroup)
        })
    }

    return (
        <menubutton cssClasses={["tray-item"]} $={(self) => init(self)}>
            <image gicon={icon} iconSize={Gtk.IconSize.NORMAL} />
        </menubutton>
    )
}

function Tray() {
    const tray = AstalTray.get_default()
    const items = createBinding(tray, "items")

    return (
        <box cssClasses={["tray"]} halign={Gtk.Align.END} valign={Gtk.Align.START}>
            <For each={items}>
                {(item: AstalTray.TrayItem) => <TrayItem item={item} />}
            </For>
        </box>
    )
}

// ── Workspace + Window List (below tray, right side) ─────────────────────────

function WorkspaceInfo({ hide }: { hide: () => void }) {
    const hypr = AstalHyprland.get_default()

    const focusedWs = createBinding(hypr, "focused-workspace")
    const allClients = createBinding(hypr, "clients")

    const wsName = createComputed(
        [focusedWs],
        (ws: AstalHyprland.Workspace | null) => ws ? `Desktop ${ws.name}` : ""
    )

    const clientTitles = createComputed(
        [focusedWs, allClients],
        (ws: AstalHyprland.Workspace | null, _all: AstalHyprland.Client[]) =>
            ws
                ? ws.get_clients()
                    .map((c) => c.title)
                    .filter((t) => t && t.length > 0)
                : []
    )

    return (
        <button
            cssClasses={["workspace-info-btn"]}
            halign={Gtk.Align.END}
            onClicked={() => { hide() }}
        >
            <box cssClasses={["workspace-info"]} orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.END}>
                <label cssClasses={["ws-name"]} label={wsName} halign={Gtk.Align.END} />
                <box cssClasses={["window-list"]} orientation={Gtk.Orientation.VERTICAL}>
                    <For each={clientTitles}>
                        {(title: string) => (
                            <label
                                cssClasses={["window-title"]}
                                label={title}
                                halign={Gtk.Align.END}
                                ellipsize={3}
                                maxWidthChars={32}
                            />
                        )}
                    </For>
                </box>
            </box>
        </button>
    )
}

// ── Control buttons (wifi / bluetooth / wireguard) ───────────────────────────

function runSync(argv: string[]): string {
    try {
        const proc = Gio.Subprocess.new(argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE)
        const [, stdout] = proc.communicate_utf8(null, null)
        return (stdout ?? "").trim()
    } catch {
        return ""
    }
}

type DunstHistoryEntry = {
    id: number
    summary: string
    body: string
    appname: string
    urgency: string
    timestamp: number
    stackTag: string
}

function getDunstHistory(limit = 30): DunstHistoryEntry[] {
    const raw = runSync(["dunstctl", "history"])
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as {
            data?: Array<Array<Record<string, { data?: string | number }>>>
        }
        const rows = parsed.data?.[0] ?? []
        const entries = rows.map((row) => {
            const get = (key: string, fallback: string | number) =>
                row[key]?.data ?? fallback
            return {
                id: Number(get("id", 0)),
                summary: String(get("summary", "")),
                body: String(get("body", "")),
                appname: String(get("appname", "")),
                urgency: String(get("urgency", "NORMAL")),
                timestamp: Number(get("timestamp", 0)),
                stackTag: String(get("stack_tag", "")),
            }
        })
        const filtered = entries
            .filter((entry) => entry.stackTag !== "workspace")
            .sort((a, b) => (b.timestamp - a.timestamp) || (b.id - a.id))
        return filtered.slice(0, limit)
    } catch {
        return []
    }
}

function CtrlBtn({ icon, tooltip, poll, onToggle }: {
    icon: string,
    tooltip: string,
    poll: ReturnType<typeof createPoll>,
    onToggle: () => void,
}) {
    return (
        <button
            cssClasses={["ctrl-btn", "ctrl-off"]}
            tooltipText={tooltip}
            onClicked={onToggle}
            $={(self) => {
                const update = () => {
                    const on = poll.get()
                    self.cssClasses = on ? ["ctrl-btn", "ctrl-on"] : ["ctrl-btn", "ctrl-off"]
                }
                // Subscribe first (this starts the poll timer and schedules
                // an immediate compute via setTimeout), then also call update()
                // after a short delay to catch the first computed value
                poll.subscribe(update)
                setTimeout(update, 100)
            }}
        >
            <label cssClasses={["power-icon"]} label={icon} />
        </button>
    )
}

function ControlButtons() {
    const netOn = createPoll(false, 3000, () =>
        runSync(["nmcli", "networking"]) === "enabled"
    )
    const wifiOn = createPoll(false, 3000, () =>
        runSync(["nmcli", "radio", "wifi"]) === "enabled"
    )
    const btOn = createPoll(false, 3000, () =>
        runSync(["systemctl", "is-active", "bluetooth"]) === "active"
    )
    const vpnOn = createPoll(false, 3000, () =>
        runSync(["systemctl", "is-active", "wg-quick@home"]) === "active"
    )

    const run = (argv: string[]) =>
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE)

    return (
        <box cssClasses={["ctrl-buttons"]} halign={Gtk.Align.END}>
            <CtrlBtn
                icon={"\uF6FF"}
                tooltip="Toggle Networking"
                poll={netOn}
                onToggle={() => run(["nmcli", "networking",
                    runSync(["nmcli", "networking"]) === "enabled" ? "off" : "on"])}
            />
            <CtrlBtn
                icon={"\uF1EB"}
                tooltip="Toggle Wi-Fi"
                poll={wifiOn}
                onToggle={() => run(["nmcli", "radio", "wifi",
                    runSync(["nmcli", "radio", "wifi"]) === "enabled" ? "off" : "on"])}
            />
            <CtrlBtn
                icon={"\uF294"}
                tooltip="Toggle Bluetooth"
                poll={btOn}
                onToggle={() => run(runSync(["systemctl", "is-active", "bluetooth"]) === "active"
                    ? ["systemctl", "stop", "bluetooth"]
                    : ["systemctl", "start", "bluetooth"]
                )}
            />
            <CtrlBtn
                icon={"\uF023"}
                tooltip="Toggle VPN (wg-quick@home)"
                poll={vpnOn}
                onToggle={() => run(runSync(["systemctl", "is-active", "wg-quick@home"]) === "active"
                    ? ["systemctl", "stop", "wg-quick@home"]
                    : ["systemctl", "start", "wg-quick@home"]
                )}
            />
        </box>
    )
}

function notify(summary: string, body: string, value: number, tag: string) {
    Gio.Subprocess.new([
        "notify-send",
        "-t", "1500",
        "-h", `string:x-dunst-stack-tag:${tag}`,
        "-h", `int:value:${value}`,
        summary, body,
    ], Gio.SubprocessFlags.NONE)
}

// ── System sliders (volume / brightness / battery) ───────────────────────────

function SliderRow({ icon, value, onDec, onInc, rightLabel, onIconClick, iconPoll, barClassPoll }: {
    icon: string
    value: () => number          // 0–1
    onDec?: () => void
    onInc?: () => void
    rightLabel?: () => string    // if set, replaces +/- with a text label
    onIconClick?: () => void
    iconPoll?: () => string      // if set, polls for dynamic icon updates
    barClassPoll?: () => string  // if set, polls for dynamic bar CSS class
}) {
    let bar: Gtk.ProgressBar

    return (
        <box cssClasses={["slider-row"]}>
            {onIconClick
                ? <button cssClasses={["slider-icon-btn"]} onClicked={() => onIconClick()}>
                    <label cssClasses={["slider-icon"]} label={icon} $={(self) => {
                        if (iconPoll) {
                            const poll = createPoll(icon, 500, iconPoll)
                            poll.subscribe(() => { self.label = poll.get() })
                            setTimeout(() => { self.label = iconPoll() }, 50)
                        }
                    }} />
                  </button>
                : <label cssClasses={["slider-icon"]} label={icon} $={(self) => {
                    if (iconPoll) {
                        const poll = createPoll(icon, 500, iconPoll)
                        poll.subscribe(() => { self.label = poll.get() })
                        setTimeout(() => { self.label = iconPoll() }, 50)
                    }
                  }} />
            }
            <box cssClasses={["slider-track"]} hexpand={true} valign={Gtk.Align.CENTER}
                $={(self) => {
                    bar = new Gtk.ProgressBar({ cssClasses: ["slider-bar"], hexpand: true })
                    bar.fraction = value()
                    const poll = createPoll(0, 500, value)
                    poll.subscribe(() => { bar.fraction = poll.get() })
                    setTimeout(() => { bar.fraction = value() }, 100)
                    if (barClassPoll) {
                        const classPoll = createPoll("", 500, barClassPoll)
                        const applyClass = (cls: string) => {
                            bar.cssClasses = ["slider-bar", cls].filter(Boolean)
                        }
                        classPoll.subscribe(() => applyClass(classPoll.get()))
                        setTimeout(() => applyClass(barClassPoll()), 100)
                    }
                    self.append(bar)
                }}
            />
            {rightLabel
                ? <label cssClasses={["slider-pct"]} $={(self) => {
                    const poll = createPoll("", 500, rightLabel)
                    poll.subscribe(() => { self.label = poll.get() })
                    setTimeout(() => { self.label = rightLabel() }, 50)
                }} />
                : <box cssClasses={["slider-btns"]}>
                    <button cssClasses={["slider-btn"]} onClicked={() => onDec?.()}>
                        <label cssClasses={["slider-btn-icon"]} label={"\uF068"} />
                    </button>
                    <button cssClasses={["slider-btn"]} onClicked={() => onInc?.()}>
                        <label cssClasses={["slider-btn-icon"]} label={"\uF067"} />
                    </button>
                  </box>
            }
        </box>
    )
}

function SystemSliders() {
    // ── Volume (via wpctl) ──
    const getVolume = () => {
        const out = runSync(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
        // output: "Volume: 0.75" or "Volume: 0.75 [MUTED]"
        const m = out.match(/Volume:\s*([\d.]+)/)
        return m ? Math.min(1, parseFloat(m[1])) : 0
    }
    const adjustVolume = (delta: number) => {
        const arg = delta > 0 ? `${Math.round(delta * 100)}%+` : `${Math.round(-delta * 100)}%-`
        Gio.Subprocess.new(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", arg], Gio.SubprocessFlags.NONE)
        setTimeout(() => {
            const pct = Math.round(getVolume() * 100)
            notify("Volume", `${pct}%`, pct, "osd-volume")
        }, 80)
    }
    const isMuted = () => {
        const out = runSync(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
        return out.includes("MUTED")
    }
    const toggleMute = () => {
        Gio.Subprocess.new(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"], Gio.SubprocessFlags.NONE)
        setTimeout(() => {
            notify("Volume", isMuted() ? "Muted" : "Unmuted", 0, "osd-volume")
        }, 80)
    }
    const volumeIcon = () => isMuted() ? "\uF6A9" : "\uF028"

    // ── Brightness (via brightnessctl) ──
    const getBrightness = () => {
        const cur = parseInt(runSync(["brightnessctl", "get"]))
        const max = parseInt(runSync(["brightnessctl", "max"]))
        return (max > 0) ? cur / max : 0
    }
    const adjustBrightness = (delta: number) => {
        const arg = delta >= 0 ? `${Math.round(delta * 100)}%+` : `${Math.round(-delta * 100)}%-`
        Gio.Subprocess.new(["brightnessctl", "set", arg], Gio.SubprocessFlags.NONE)
        setTimeout(() => {
            const pct = Math.round(getBrightness() * 100)
            notify("Brightness", `${pct}%`, pct, "osd-brightness")
        }, 80)
    }

    // ── Battery (via UPower through AstalBattery) ──
    let battery: AstalBattery.Device | null = null
    try { battery = AstalBattery.get_default() } catch (_) {}
    const getBatteryPct = () => {
        try { return battery ? battery.percentage : 0 } catch (_) { return 0 }
    }
    const getBatteryLabel = () => {
        try {
            if (!battery) return "N/A"
            return `${Math.round(battery.percentage * 100)}%`
        } catch (_) { return "N/A" }
    }

    const getBatteryIcon = () => {
        try {
            if (!battery) return "\uF244"
            if (battery.charging) return "\uF0E7"
            const pct = battery.percentage * 100
            if (pct >= 75) return "\uF240"
            if (pct >= 50) return "\uF241"
            if (pct >= 25) return "\uF242"
            if (pct >= 10) return "\uF243"
            return "\uF244"
        } catch (_) { return "\uF244" }
    }

    const getBatteryBarClass = () => {
        try {
            if (!battery) return "battery-normal"
            if (battery.charging) return "battery-charging"
            const pct = battery.percentage * 100
            if (pct <= 10) return "battery-critical"
            if (pct <= 20) return "battery-low"
            return "battery-normal"
        } catch (_) { return "battery-normal" }
    }

    return (
        <box cssClasses={["system-sliders"]} orientation={Gtk.Orientation.VERTICAL}>
            <SliderRow
                icon={"\uF028"}
                value={getVolume}
                onDec={() => adjustVolume(-0.05)}
                onInc={() => adjustVolume(0.05)}
                onIconClick={toggleMute}
                iconPoll={volumeIcon}
            />
            <SliderRow
                icon={"\uF185"}
                value={getBrightness}
                onDec={() => adjustBrightness(-0.05)}
                onInc={() => adjustBrightness(0.05)}
            />
            <SliderRow
                icon={"\uF240"}
                iconPoll={getBatteryIcon}
                value={getBatteryPct}
                rightLabel={getBatteryLabel}
                barClassPoll={getBatteryBarClass}
            />
        </box>
    )
}

// ── Power buttons (bottom-right) ─────────────────────────────────────────────

function PowerButtons() {
    const run = (argv: string[]) =>
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE)

    // pending holds the action to confirm, or null when idle
    let pending: (() => void) | null = null
    let buttonsBox: Gtk.Box
    let confirmBox: Gtk.Box

    const ask = (action: () => void) => {
        pending = action
        buttonsBox.visible = false
        confirmBox.visible = true
    }

    const confirm = () => {
        if (pending) pending()
        pending = null
        buttonsBox.visible = true
        confirmBox.visible = false
    }

    const cancel = () => {
        pending = null
        buttonsBox.visible = true
        confirmBox.visible = false
    }

    return (
        <box cssClasses={["power-area"]} orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.END}>
            {/* Normal state: four power buttons */}
            <box $={(self) => (buttonsBox = self)} cssClasses={["power-buttons"]} halign={Gtk.Align.END}>
                <button cssClasses={["power-btn"]} tooltipText="Shut down"
                    onClicked={() => ask(() => run(["systemctl", "poweroff"]))}>
                    <label cssClasses={["power-icon"]} label={"\uF011"} />
                </button>
                <button cssClasses={["power-btn"]} tooltipText="Restart"
                    onClicked={() => ask(() => run(["systemctl", "reboot"]))}>
                    <label cssClasses={["power-icon"]} label={"\uF01E"} />
                </button>
                <button cssClasses={["power-btn"]} tooltipText="Log out"
                    onClicked={() => ask(() => run(["hyprctl", "dispatch", "exit"]))}>
                    <label cssClasses={["power-icon"]} label={"\uF08B"} />
                </button>
                <button cssClasses={["power-btn"]} tooltipText="Lock screen"
                    onClicked={() => Gio.Subprocess.new(["hyprlock"], Gio.SubprocessFlags.NONE)}>
                    <label cssClasses={["power-icon"]} label={"\uF023"} />
                </button>
            </box>
            {/* Confirmation state */}
            <box $={(self) => (confirmBox = self)} cssClasses={["confirm-box"]} halign={Gtk.Align.END} visible={false}>
                <label cssClasses={["confirm-label"]} label="Are you sure?" />
                <button cssClasses={["confirm-btn", "confirm-yes"]} onClicked={confirm}>
                    <label label="Yes" />
                </button>
                <button cssClasses={["confirm-btn", "confirm-no"]} onClicked={cancel}>
                    <label label="No" />
                </button>
            </box>
        </box>
    )
}

// ── Workspace Switcher (between tray and workspace info) ──────────────────────

function WorkspaceSwitcher({ hide }: { hide: () => void }) {
    const hypr = AstalHyprland.get_default()
    const workspaces = createBinding(hypr, "workspaces").as(
        (ws: AstalHyprland.Workspace[]) => [...ws].sort((a, b) => a.id - b.id)
    )
    const focusedWs = createBinding(hypr, "focused-workspace")

    return (
        <box cssClasses={["ws-switcher"]} halign={Gtk.Align.END} margin_bottom={8}>
            <For each={workspaces}>
                {(ws: AstalHyprland.Workspace) => {
                    const btn = (
                        <button
                            cssClasses={["ws-btn"]}
                            tooltipText={`Workspace ${ws.name}`}
                            onClicked={() => {
                                hypr.dispatch("workspace", ws.id.toString())
                                hide()
                            }}
                            $={(self) => {
                                const update = () => {
                                    const focused = focusedWs.get()
                                    const isActive = focused && focused.id === ws.id
                                    self.cssClasses = isActive
                                        ? ["ws-btn", "ws-btn-active"]
                                        : ["ws-btn"]
                                }
                                focusedWs.subscribe(update)
                                setTimeout(update, 50)
                            }}
                        >
                            <label cssClasses={["ws-btn-label"]} label={ws.id.toString()} />
                        </button>
                    ) as Gtk.Button
                    return btn
                }}
            </For>
        </box>
    )
}

// ── Right column: Tray, workspace switcher, window list, then control/power ───

function RightColumn({ hide }: { hide: () => void }) {
    return (
        <box cssClasses={["right-col"]} orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.END}>
            <Tray />
            <box vexpand={true} />
            <SystemSliders />
            <ControlButtons />
            <PowerButtons />
        </box>
    )
}

function NotificationHistoryColumn({ panelVisible }: { panelVisible: () => boolean }) {
    let last: DunstHistoryEntry[] = []
    const items = createPoll([] as DunstHistoryEntry[], 1500, () => {
        if (!panelVisible()) return last
        last = getDunstHistory(30)
        return last
    })

    const run = (argv: string[]) =>
        Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE)

    const urgencyClass = (urgency: string) => {
        if (urgency === "CRITICAL") return "notif-critical"
        if (urgency === "LOW") return "notif-low"
        return "notif-normal"
    }

    return (
        <box cssClasses={["notif-col"]} orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.FILL} vexpand={true}>
            <label cssClasses={["notif-title"]} label="Notifications" halign={Gtk.Align.START} />
            <Gtk.ScrolledWindow
                cssClasses={["notif-scroll"]}
                hscrollbarPolicy={Gtk.PolicyType.NEVER}
                vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
                hexpand={true}
                vexpand={true}
                $={(self) => {
                    self.set_propagate_natural_height(false)
                    self.set_min_content_height(0)
                }}
            >
                <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["notif-list"]}>
                    <label
                        cssClasses={["notif-empty"]}
                        label="No notifications"
                        halign={Gtk.Align.START}
                        visible={items.as((arr) => arr.length === 0)}
                    />
                    <For each={items.as((arr) => arr.slice(0, 12))}>
                        {(item: DunstHistoryEntry) => (
                            <box cssClasses={["notif-row", urgencyClass(item.urgency)]}>
                                <button
                                    cssClasses={["notif-item-btn"]}
                                    hexpand={true}
                                    onClicked={() => run(["dunstctl", "history-pop", item.id.toString()])}
                                >
                                    <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["notif-text"]}>
                                        <label
                                            cssClasses={["notif-summary"]}
                                            halign={Gtk.Align.START}
                                            xalign={0}
                                            label={item.summary || "(no title)"}
                                            ellipsize={3}
                                            maxWidthChars={36}
                                        />
                                        <label
                                            cssClasses={["notif-body"]}
                                            halign={Gtk.Align.START}
                                            xalign={0}
                                            label={item.body || item.appname}
                                            ellipsize={3}
                                            maxWidthChars={42}
                                        />
                                    </box>
                                </button>
                                <button
                                    cssClasses={["notif-rm-btn"]}
                                    tooltipText="Remove from history"
                                    onClicked={() => run(["dunstctl", "history-rm", item.id.toString()])}
                                >
                                    <label cssClasses={["notif-rm-icon"]} label={"\uF00D"} />
                                </button>
                            </box>
                        )}
                    </For>
                </box>
            </Gtk.ScrolledWindow>
        </box>
    )
}

// ── Workspace Switcher Panel ──────────────────────────────────────────────────

// ── Idle Preset ───────────────────────────────────────────────────────────────

const IDLE_PRESETS = [
    {
        label: "1 MIN",
        description: "30s dim  /  1min lock  /  5min off",
        conf: `general {
    lock_cmd         = pidof hyprlock || hyprlock
    before_sleep_cmd = loginctl lock-session
    after_sleep_cmd  = hyprctl dispatch dpms on
}

listener {
    timeout    = 30
    on-timeout = brightnessctl -s set 20%
    on-resume  = brightnessctl -r
}

listener {
    timeout    = 60
    on-timeout = loginctl lock-session
}

listener {
    timeout    = 300
    on-timeout = hyprctl dispatch dpms off
    on-resume  = hyprctl dispatch dpms on
}
`,
    },
    {
        label: "10 MIN",
        description: "5min dim  /  10min lock  /  20min off",
        conf: `general {
    lock_cmd         = pidof hyprlock || hyprlock
    before_sleep_cmd = loginctl lock-session
    after_sleep_cmd  = hyprctl dispatch dpms on
}

listener {
    timeout    = 300
    on-timeout = brightnessctl -s set 20%
    on-resume  = brightnessctl -r
}

listener {
    timeout    = 600
    on-timeout = loginctl lock-session
}

listener {
    timeout    = 1200
    on-timeout = hyprctl dispatch dpms off
    on-resume  = hyprctl dispatch dpms on
}
`,
    },
    {
        label: "Never",
        description: "No dim, no lock, no display off",
        conf: `general {
    lock_cmd         = pidof hyprlock || hyprlock
    before_sleep_cmd = loginctl lock-session
    after_sleep_cmd  = hyprctl dispatch dpms on
}
`,
    },
]

function IdlePreset() {
    const detectPreset = (): number => {
        try {
            const [ok, contents] = GLib.file_get_contents(
                GLib.get_home_dir() + "/.config/hypr/hypridle.conf"
            )
            if (!ok) return 0
            const text = new TextDecoder().decode(contents)
            if (!text.includes("listener")) return 2
            if (text.match(/timeout\s*=\s*300/)) return 1
            return 0
        } catch { return 0 }
    }

    let activeIndex = detectPreset()
    let buttons: Gtk.Button[] = []
    let descLabel: Gtk.Label

    const applyPreset = (index: number) => {
        activeIndex = index
        const confPath = GLib.get_home_dir() + "/.config/hypr/hypridle.conf"
        GLib.file_set_contents(confPath, IDLE_PRESETS[index].conf)
        Gio.Subprocess.new(["bash", "-c", "pkill hypridle; hypridle &"], Gio.SubprocessFlags.NONE)
        buttons.forEach((btn, i) => {
            btn.cssClasses = i === activeIndex
                ? ["idle-preset-btn", "idle-preset-active"]
                : ["idle-preset-btn"]
        })
        descLabel.label = IDLE_PRESETS[index].description
    }

    return (
        <box cssClasses={["idle-preset-section"]} orientation={Gtk.Orientation.VERTICAL}>
            <label cssClasses={["settings-section-title"]} label="Idle &amp; Lock" halign={Gtk.Align.START} />
            <box cssClasses={["idle-preset-row"]}>
                {IDLE_PRESETS.map((preset, i) => (
                    <button
                        cssClasses={i === activeIndex
                            ? ["idle-preset-btn", "idle-preset-active"]
                            : ["idle-preset-btn"]}
                        $={(self) => { buttons[i] = self }}
                        onClicked={() => applyPreset(i)}
                        tooltipText={preset.description}
                    >
                        <label label={preset.label} />
                    </button>
                ))}
            </box>
            <label
                cssClasses={["idle-preset-desc"]}
                label={IDLE_PRESETS[activeIndex].description}
                $={(self) => { descLabel = self }}
                halign={Gtk.Align.START}
            />
        </box>
    )
}

// ── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel() {
    let win: Astal.Window
    let content: Gtk.Box

    const hide = () => { win.visible = false }

    return (
        <window
            $={(self) => (win = self)}
            name="settings-panel"
            namespace="settings-panel"
            application={app}
            visible={false}
            exclusivity={Astal.Exclusivity.IGNORE}
            layer={Astal.Layer.OVERLAY}
            keymode={Astal.Keymode.ON_DEMAND}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
        >
            <Gtk.EventControllerKey
                onKeyPressed={(_e, keyval) => {
                    if (keyval === Gdk.KEY_Escape) hide()
                }}
            />
            <Gtk.GestureClick
                onPressed={(_e, _n, x, y) => {
                    const [, rect] = content.compute_bounds(win)
                    const point = new Graphene.Point({ x, y })
                    if (!rect.contains_point(point)) hide()
                }}
            />
            <box
                $={(self) => (content = self)}
                cssClasses={["settings-panel"]}
                orientation={Gtk.Orientation.VERTICAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
            >
                <label cssClasses={["settings-title"]} label="Settings" halign={Gtk.Align.START} />
                <IdlePreset />
                <label cssClasses={["settings-section-title"]} label="Displays" halign={Gtk.Align.START} />
                <button
                    cssClasses={["run-menu-btn"]}
                    hexpand={true}
                    onClicked={() => {
                        hide()
                        Gio.Subprocess.new(["monique"], Gio.SubprocessFlags.NONE)
                    }}
                >
                    <label label="Open Display Settings" />
                </button>
                <label cssClasses={["settings-section-title"]} label="Wallpaper" halign={Gtk.Align.START} />
                <button
                    cssClasses={["run-menu-btn"]}
                    hexpand={true}
                    onClicked={() => {
                        hide()
                        Gio.Subprocess.new(["waypaper"], Gio.SubprocessFlags.NONE)
                    }}
                >
                    <label label="Change Wallpaper" />
                </button>
            </box>
        </window>
    )
}

// ── Panel ────────────────────────────────────────────────────────────────────

function Panel() {
    let win: Astal.Window
    let content: Gtk.Box

    const hide = () => { win.visible = false }
    const showSettings = () => { app.get_window("settings-panel")!.visible = true }
    const isVisible = () => !!win && win.visible

    const refreshListeners: (() => void)[] = []
    const refreshSignal = {
        subscribe: (cb: () => void) => { refreshListeners.push(cb) },
    }
    const fireRefresh = () => refreshListeners.forEach(cb => cb())

    return (
        <window
            $={(self) => {
                win = self
                self.connect("notify::visible", () => {
                    if (self.visible) fireRefresh()
                })
            }}
            name="my-panel"
            namespace="my-panel"
            application={app}
            visible={false}
            exclusivity={Astal.Exclusivity.IGNORE}
            layer={Astal.Layer.OVERLAY}
            keymode={Astal.Keymode.ON_DEMAND}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
        >
            <Gtk.EventControllerKey
                onKeyPressed={(_e, keyval) => {
                    if (keyval === Gdk.KEY_Escape) hide()
                }}
            />
            <Gtk.GestureClick
                onPressed={(_e, _n, x, y) => {
                    const [, rect] = content.compute_bounds(win)
                    const point = new Graphene.Point({ x, y })
                    if (!rect.contains_point(point)) hide()
                }}
            />
            {/* Centered card */}
            <box
                $={(self) => (content = self)}
                cssClasses={["panel"]}
                orientation={Gtk.Orientation.VERTICAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
            >
                <box cssClasses={["panel-top-row"]} orientation={Gtk.Orientation.HORIZONTAL} halign={Gtk.Align.CENTER} valign={Gtk.Align.FILL}>
                    <Clock hide={hide} showSettings={showSettings} />
                    <RightColumn hide={hide} />
                    <NotificationHistoryColumn panelVisible={isVisible} />
                </box>
                <Gtk.Separator cssClasses={["panel-separator"]} orientation={Gtk.Orientation.HORIZONTAL} />
                <label
                    cssClasses={["ws-overview-title"]}
                    label="Workspaces"
                    halign={Gtk.Align.CENTER}
                />
                <WorkspaceOverview hide={hide} refreshSignal={refreshSignal} />
            </box>
        </window>
    )
}

// ── Workspace Overview Panel ─────────────────────────────────────────────────

const MINIMAP_W = 220
const MINIMAP_H = 138

// AstalHyprland does not reliably populate monitor x/y offsets, so we read
// them directly from hyprctl and cache the result. We do this async so we
// never block the UI thread, and refresh only when monitors change.
type MonitorGeom = { x: number; y: number; width: number; height: number }
const monitorGeomCache = new Map<string, MonitorGeom>()

function refreshMonitorGeomAsync() {
    try {
        const proc = Gio.Subprocess.new(
            ["hyprctl", "monitors", "-j"],
            Gio.SubprocessFlags.STDOUT_PIPE
        )
        proc.communicate_utf8_async(null, null, (_p, res) => {
            try {
                const [, out] = proc.communicate_utf8_finish(res)
                const monitors = JSON.parse(out ?? "[]") as Array<{
                    name: string; x: number; y: number; width: number; height: number
                }>
                for (const m of monitors) {
                    monitorGeomCache.set(m.name, { x: m.x, y: m.y, width: m.width, height: m.height })
                }
            } catch (_) {}
        })
    } catch (_) {}
}
refreshMonitorGeomAsync()

function getMonitorGeom(name: string): MonitorGeom {
    return monitorGeomCache.get(name) ?? { x: 0, y: 0, width: 1920, height: 1080 }
}

function WorkspaceCard({ ws, focusedWs, hide }: {
    ws: AstalHyprland.Workspace,
    focusedWs: AstalHyprland.Workspace | null,
    hide: () => void,
}) {
    const hypr = AstalHyprland.get_default()
    const wsId = ws.id
    const isActive = focusedWs && focusedWs.id === wsId

    let minimap: Gtk.Fixed

    const refreshMinimap = () => {
        if (!minimap) return

        // Clear existing children
        let child = minimap.get_first_child()
        while (child) {
            const next = child.get_next_sibling()
            minimap.remove(child)
            child = next
        }

        const monName = ws.monitor
        const mon = getMonitorGeom(monName)
        const [monW, monH] = [mon.width, mon.height]
        const monOffX = mon.x
        const monOffY = mon.y
        const scaleX = MINIMAP_W / monW
        const scaleY = MINIMAP_H / monH

        const clients = ws.get_clients()
        const focusedAddr = hypr.focusedClient?.address

        for (const client of clients) {
            const x = Math.round((client.x - monOffX) * scaleX)
            const y = Math.round((client.y - monOffY) * scaleY)
            const w = Math.max(4, Math.round(client.width * scaleX))
            const h = Math.max(4, Math.round(client.height * scaleY))

            const isFocused = isActive && client.address === focusedAddr

            // Truncate title to fit width (~1 char per 6px at 8px font)
            const maxChars = Math.max(4, Math.floor(w / 6))
            const title = client.title.length > maxChars
                ? client.title.substring(0, maxChars - 1) + "…"
                : client.title

            const winBox = new Gtk.Box({
                cssClasses: isFocused
                    ? ["ws-minimap-window", "ws-minimap-window-active"]
                    : ["ws-minimap-window"],
                widthRequest: w,
                heightRequest: h,
                halign: Gtk.Align.START,
                valign: Gtk.Align.START,
                overflow: Gtk.Overflow.HIDDEN,
            })

            const lbl = new Gtk.Label({
                cssClasses: ["ws-minimap-window-title"],
                label: title,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                ellipsize: 3,
                maxWidthChars: maxChars,
                hexpand: true,
            })
            winBox.append(lbl)
            minimap.put(winBox, x, y)
        }
    }

    return (
        <button
            cssClasses={isActive ? ["ws-card", "ws-card-active"] : ["ws-card"]}
            widthRequest={MINIMAP_W + 16}
            hexpand={false}
            halign={Gtk.Align.START}
            onClicked={() => {
                hypr.dispatch("workspace", wsId.toString())
                hide()
            }}
            $={(self) => {
                const updActive = () => {
                    const fws = hypr.focusedWorkspace
                    self.cssClasses = (fws && fws.id === wsId)
                        ? ["ws-card", "ws-card-active"]
                        : ["ws-card"]
                }
                hypr.connect("notify::focused-workspace", updActive)
                hypr.connect("notify::clients", refreshMinimap)
                hypr.connect("notify::focused-client", refreshMinimap)
            }}
        >
            <box orientation={Gtk.Orientation.VERTICAL} cssClasses={["ws-card-inner"]}>
                <label
                    cssClasses={["ws-card-title"]}
                    label={`Desktop ${wsId}`}
                    halign={Gtk.Align.CENTER}
                />
                <Gtk.Fixed
                    cssClasses={["ws-minimap"]}
                    widthRequest={MINIMAP_W}
                    heightRequest={MINIMAP_H}
                    $={(self) => {
                        minimap = self
                        refreshMinimap()
                    }}
                />
            </box>
        </button>
    )
}

function WorkspaceOverview({ hide, refreshSignal }: {
    hide: () => void,
    refreshSignal: { subscribe: (cb: () => void) => void },
}) {
    const hypr = AstalHyprland.get_default()

    const getPopulatedWs = () =>
        [...hypr.workspaces]
            .filter(ws => ws.get_clients().length > 0)
            .sort((a, b) => a.id - b.id)

    let grid: Gtk.Box

    const rebuild = () => {
        if (!grid) return
        // Clear
        let child = grid.get_first_child()
        while (child) {
            const next = child.get_next_sibling()
            grid.remove(child)
            child = next
        }

        const wsList = getPopulatedWs()
        const focusedWs = hypr.focusedWorkspace
        const rows: AstalHyprland.Workspace[][] = []
        for (let i = 0; i < wsList.length; i += 5) {
            rows.push(wsList.slice(i, i + 5))
        }

        for (const row of rows) {
            const rowBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                cssClasses: ["ws-overview-row"],
                spacing: 12,
                halign: Gtk.Align.CENTER,
            })
            for (const ws of row) {
                const card = WorkspaceCard({ ws, focusedWs, hide }) as Gtk.Widget
                rowBox.append(card)
            }
            grid.append(rowBox)
        }
    }

    refreshSignal.subscribe(rebuild)
    hypr.connect("notify::monitors", () => { refreshMonitorGeomAsync(); rebuild() })
    hypr.connect("notify::workspaces", rebuild)
    hypr.connect("notify::clients", rebuild)

    return (
        <box
            orientation={Gtk.Orientation.VERTICAL}
            cssClasses={["ws-overview-grid"]}
            $={(self) => {
                grid = self
                rebuild()
            }}
        />
    )
}

app.start({
    css: `${GLib.get_home_dir()}/.config/ags/style.css`,
    main() {
        Panel()
        SettingsPanel()
    },
})
