# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (ts-node, no build step)
npm run dev

# Compile TypeScript → dist/
npm run build

# Run compiled output
npm start

# Build Windows .exe (requires npm run build first, outputs to release/)
npm run pkg:win
```

There are no tests and no linter configured. TypeScript strict mode (`"strict": true`) is the main correctness check — run `npm run build` to catch type errors.

## Architecture

Two servers start concurrently from `src/index.ts`:

| Server | Port | Purpose |
|--------|------|---------|
| WebSocket (`ws`) | 17880 | Receives print jobs from the web panel |
| HTTP (`http`) | 17881 | Local settings UI to pick the printer |

Both bind to `127.0.0.1` only — no external exposure. Both also validate the browser's `Origin` header (`src/allowed-origins.ts`) and a shared token (`src/bridge-token.ts`) before accepting print jobs or config changes — see "Security" below.

### Print flow

1. The panel (browser) opens a WebSocket to `ws://127.0.0.1:17880`.
2. It sends `{ type: "print", version: 1, token: "...", thermalPrint: ThermalPrintPayload }`.
3. `bridge.ts` validates the origin (handshake), the token, and enqueues the job via `SerialPrintQueue` (concurrency = 1).
4. `format-ticket.ts` builds the ESC/POS ticket using `node-thermal-printer` (EPSON driver, `printer:<name>` interface) and calls `printer.execute()`.
5. The socket receives `{ ok: true }` or `{ ok: false, error: "..." }`.

### Security (`allowed-origins.ts`, `bridge-token.ts`)

Both local servers reject connections whose `Origin` isn't in `ALLOWED_ORIGINS` (production panel domain + `localhost:8080` dev). No-`Origin` requests (e.g. `wscat`) are only allowed when not packaged (`npm run dev`). `PrintJobMessage.token` (WS `print`) and `POST /api/config` (settings) must match `PRINT_BRIDGE_SHARED_TOKEN`, which must be kept in sync with `VITE_PRINT_BRIDGE_TOKEN` baked into the panel build (`panel-admin-ag360ai/PRPs/169--print-bridge-ws-origin-token.md`). The settings page itself gets the token injected server-side when served (`SETTINGS_PAGE.replace('__BRIDGE_TOKEN__', ...)`) — the cashier never sees or copies it.

`src/bridge-token.ts` is **generated, not hand-written** — it's gitignored. `scripts/generate-bridge-token.mjs` reads `PRINT_BRIDGE_TOKEN` from `.env` (also gitignored) and writes it before every `dev`/`build`/`build:electron` (via `predev`/`prebuild`/`prebuild:electron` npm hooks). Fails loudly (exit 1) if `PRINT_BRIDGE_TOKEN` is missing from `.env`. To change the token: edit `.env`, rerun the npm script — never edit `bridge-token.ts` directly, it gets overwritten.

### Printer resolution (`index.ts → resolvePrinterName`)

Priority: saved config → Windows default → throws. Config is read fresh on every job, so changing it via the UI takes effect immediately without a restart.

### Settings UI (`settings-server.ts`)

Pure Node `http` server. Endpoints: `GET /` (HTML page, inlined in the source, token injected server-side), `GET /api/config`, `GET /api/printers`, `POST /api/config` (requires `token` in body). The page uses `fetch` to list printers and save the selection. CORS reflects only allowlisted origins (`isSettingsOriginAllowed`) — never `*`.

### Config persistence (`config-store.ts`)

Saved to `%APPDATA%\MaxyPrintBridge\config.json` on Windows, `~/.maxy-print-bridge/config.json` elsewhere. Structure: `{ printerName: string | null }`.

### Windows printer enumeration (`windows-printers.ts`)

Calls `powershell -NoProfile -Command "Get-CimInstance Win32_Printer ..."` via `execSync`. Returns an empty array on non-Windows platforms (graceful degradation for dev on macOS/Linux).

## Types (`src/types.ts`)

`ThermalPrintPayload` is the canonical shape for a print job. It is produced by the backend (`ssgg`) and consumed here — keep both in sync if fields change.

## Release / CI

The workflow at `.github/workflows/print-bridge-release.yml` builds the `.exe` on `windows-latest` using `pkg`. It runs on:
- A published release whose tag starts with `print-bridge-` → attaches `maxy-print-bridge-win.exe` to the release.
- `workflow_dispatch` → uploads it as an artifact (useful for testing without a release).

After publishing, copy the asset URL to `VITE_PRINT_BRIDGE_DOWNLOAD_URL` in the panel's build environment.
