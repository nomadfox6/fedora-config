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

function SliderRow({ icon, value, onDec, onInc, rightLabel, onIconClick, iconPoll }: {
    icon: string
    value: () => number          // 0–1
    onDec?: () => void
    onInc?: () => void
    rightLabel?: () => string    // if set, replaces +/- with a text label
    onIconClick?: () => void
    iconPoll?: () => string      // if set, polls for dynamic icon updates
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
                : <label cssClasses={["slider-icon"]} label={icon} />
            }
            <box cssClasses={["slider-track"]} hexpand={true} valign={Gtk.Align.CENTER}
                $={(self) => {
                    bar = new Gtk.ProgressBar({ cssClasses: ["slider-bar"], hexpand: true })
                    bar.fraction = value()
                    const poll = createPoll(0, 500, value)
                    poll.subscribe(() => { bar.fraction = poll.get() })
                    setTimeout(() => { bar.fraction = value() }, 100)
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
                value={getBatteryPct}
                rightLabel={getBatteryLabel}
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
                <button cssClasses={["power-btn"]} tooltipText="Lock screen"
                    onClicked={() => Gio.Subprocess.new(["hyprlock"], Gio.SubprocessFlags.NONE)}>
                    <label cssClasses={["power-icon"]} label={"\uF023"} />
                </button>
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
            <WorkspaceSwitcher hide={hide} />
            <WorkspaceInfo hide={hide} />
            <box vexpand={true} />
            <SystemSliders />
            <ControlButtons />
            <PowerButtons />
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

    return (
        <window
            $={(self) => (win = self)}
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
                orientation={Gtk.Orientation.HORIZONTAL}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
            >
                <Clock hide={hide} showSettings={showSettings} />
                <RightColumn hide={hide} />
            </box>
        </window>
    )
}

app.start({
    css: `${GLib.get_home_dir()}/.config/ags/style.css`,
    main() {
        Panel()
        SettingsPanel()
    },
})
