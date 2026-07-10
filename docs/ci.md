# CI (GitHub Actions)

Workflow: [`.github/workflows/print-bridge-release.yml`](../.github/workflows/print-bridge-release.yml)

| Plataforma | Build | Evento release → adjunta |
|------------|-------|--------------------------|
| Windows | `electron-builder` (Electron, NSIS + portable) | `maxy-print-bridge-setup.exe` + `maxy-print-bridge-win.exe` |
| macOS Intel | `electron-builder` (Electron, `.dmg`) | `maxy-print-bridge-mac-x64.dmg` |
| macOS ARM | `electron-builder` (Electron, `.dmg`) | `maxy-print-bridge-mac-arm64.dmg` |
| Linux x64 | `electron-builder` (Electron, AppImage) | `maxy-print-bridge-linux-x64.AppImage` |

> Los `.dmg` de macOS **no están firmados ni notarizados** (sin costo de Apple Developer Program) — Gatekeeper los bloquea al descargarlos con el mensaje "está dañado". Ver [docs/deploy/pc-cliente.md#macos](./deploy/pc-cliente.md#macos) para el workaround.

`workflow_dispatch` → artifacts descargables sin publicar release. No hace falta configurar secretos extra.

Cómo se usa este workflow al publicar una versión: [Desplegar y mostrar el descargable en el panel](./despliegue-panel.md), [Publicar artefactos Windows](./deploy/publicar-artefactos.md).
