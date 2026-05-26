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
| WebSocket (`ws`) | 8080 | Receives print jobs from the web panel |
| HTTP (`http`) | 8081 | Local settings UI to pick the printer |

Both bind to `127.0.0.1` only — no external exposure.

### Print flow

1. The panel (browser) opens a WebSocket to `ws://127.0.0.1:8080`.
2. It sends `{ type: "print", version: 1, thermalPrint: ThermalPrintPayload }`.
3. `index.ts` validates and enqueues the job via `p-queue` (concurrency = 1).
4. `format-ticket.ts` builds the ESC/POS ticket using `node-thermal-printer` (EPSON driver, `printer:<name>` interface) and calls `printer.execute()`.
5. The socket receives `{ ok: true }` or `{ ok: false, error: "..." }`.

### Printer resolution (`index.ts → resolvePrinterName`)

Priority: saved config → Windows default → throws. Config is read fresh on every job, so changing it via the UI takes effect immediately without a restart.

### Settings UI (`settings-server.ts`)

Pure Node `http` server. Three endpoints: `GET /` (HTML page, inlined in the source), `GET /api/config`, `POST /api/config`. The page uses `fetch` to list printers and save the selection.

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
