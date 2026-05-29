# Download Shutdown Guard

A modern Windows desktop app that automatically shuts down, sleeps, hibernates, restarts, or signs out of your PC once all monitored downloads and installations have finished.

Pick the downloads you care about, walk away, and let your machine power down on its own when the work is done.

<p align="center">
  <em>Built with Electron, React, TypeScript, and Tailwind CSS</em>
</p>

---

## Recent fixes

- Steam monitoring now follows both download data and install or staging progress in real time.
- The app no longer marks a Steam task as done until the install phase is actually finished.
- The system tray icon now uses a cleaner non-blue status icon.
- Switching the UI language no longer clears the current watched task list.
- The minimize button icon is clearer, the Credits page shows your Discord avatar and handle, and inactive qBittorrent / Transmission monitors no longer spam the log.
- The app now includes an update checker in About that compares the installed build against the latest GitHub release.

---

## Features

- Manual watch list - the app detects active downloads and installs and lets you add the specific ones you want to wait on. Only watched tasks drive the shutdown.
- Multiple themes - Dark, Black (OLED), White, Blue, and Dark Blue, switchable instantly from Settings.
- Bilingual UI - full English and French translations.
- Smart cooldown - waits a configurable number of seconds after everything finishes before starting the countdown, so a brief gap between files will not trigger an early shutdown.
- Countdown popup - a clear cancel, snooze, and shutdown-now dialog before any action executes.
- Anti-false-shutdown logic - paused downloads, seeding-only torrents, and brief network drops do not trigger a shutdown.
- System tray - runs quietly in the background with a color-coded status icon.
- Live dashboard - progress bars, speeds, ETAs, and uptime at a glance.
- Flexible actions - Shut Down, Sign Out, Sleep, Hibernate, or Restart.
- Auto-start with Windows support.

## Supported Sources

| Source | Detection Method |
|--------|-----------------|
| Steam | Reads `.acf` manifests and the active staging folder under `steamapps/downloading` |
| qBittorrent | Web API (`/api/v2/torrents/info`) |
| Transmission | RPC API (`/transmission/rpc`) |
| Chrome / Edge / Opera GX | Watches the Downloads folder for `.crdownload` files |
| Firefox | Watches the Downloads folder for `.part` files |
| Installers & Updates | Detects running installers (`msiexec`, `setup.exe`, etc.), Windows Update workers, package managers (`winget`, `choco`, `pip`, `npm`), and game launchers |
| Generic | File-system watcher on configurable download folders |

## Quick Start

### Requirements

- Node.js 18 or newer
- npm 9+
- Windows 10 or 11

### Install

```bash
git clone https://github.com/SyroxXploits/Download-Shutdown-Guard.git
cd download-shutdown-guard
npm install
```

### Run in development

```bash
npm run dev
```

### Build a Windows release

```bash
npm run package:win
# Output lands in dist/
```

## Configuration

Settings are stored at `%AppData%\download-shutdown-guard\config.json` and can all be managed from the in-app Settings screen.

### qBittorrent Web API

1. In qBittorrent, open Tools > Options > Web UI
2. Enable the Web UI and note the port, usually `8080`
3. Enter the URL and credentials in Settings > Monitors

### Transmission RPC

RPC is enabled by default. If you changed the port or added authentication, update it under Settings > Monitors.

## Shutdown Actions

| Action | Command |
|--------|---------|
| Shut Down | `shutdown /s /t 0` |
| Restart | `shutdown /r /t 0` |
| Sign Out | `shutdown /l` |
| Sleep | `rundll32.exe powrprof.dll,SetSuspendState 0,1,0` |
| Hibernate | `shutdown /h` |

## Project Structure

```
src/
|-- main/                    # Electron main process
|   |-- index.ts             # App entry, window and lifecycle
|   |-- monitors/            # Download detection engines
|   |   |-- index.ts         # Coordinator and phase state machine
|   |   |-- steam.ts         # Steam .acf + staging-folder parser
|   |   |-- qbittorrent.ts   # qBittorrent Web API client
|   |   |-- transmission.ts  # Transmission RPC client
|   |   |-- browser.ts       # Partial-file watcher
|   |   `-- installer.ts     # Installer / Windows Update / package-manager detection
|   |-- shutdown.ts          # Windows power commands
|   |-- tray.ts              # System tray icon
|   |-- ipc.ts               # IPC handler registry
|   |-- store.ts             # Persistent settings (electron-store)
|   |-- autostart.ts         # Windows startup registration
|   `-- logger.ts            # File-based logger with rotation
|-- preload/
|   `-- index.ts             # Secure contextBridge API surface
|-- renderer/
|   |-- index.html
|   `-- src/
|       |-- App.tsx
|       |-- components/
|       |   |-- Dashboard.tsx        # Watch list + detected tasks
|       |   |-- CountdownDialog.tsx  # Shutdown countdown overlay
|       |   |-- Settings.tsx         # Settings incl. theme picker
|       |   |-- TitleBar.tsx         # Custom frameless title bar
|       |   |-- About.tsx
|       |   `-- Credits.tsx
|       |-- hooks/                   # IPC to React state bridges
|       `-- styles/globals.css       # Theme tokens and animations
`-- shared/
    |-- types.ts             # Shared TypeScript types and helpers
    `-- i18n.ts              # English and French translations
```

## Themes

Themes are driven entirely by CSS variables defined in `src/renderer/src/styles/globals.css` and exposed to Tailwind in `tailwind.config.js`. Adding a new theme is as simple as adding a `[data-theme="..."]` block of color channels and a new entry in the `AppTheme` type and the Settings picker.

## Safety Notes

- Always keep important work saved before enabling automatic shutdown.
- A new watched download starting during the countdown cancels the shutdown.
- Paused and seeding-only torrents never trigger a shutdown.
- All power commands are standard Windows commands.

## Credits

Created by [Syrox](https://github.com/Syrox) - design, direction, and development.

Built in collaboration with [Claude](https://claude.com/claude-code) (Anthropic).

## License

Released under the [MIT License](LICENSE).
