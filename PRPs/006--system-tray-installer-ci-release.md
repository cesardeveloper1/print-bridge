# PRP: Maxy Print Bridge — instalador, CI y release (Electron)

> **Version:** 1.0
> **Created:** 2026-06-05
> **Status:** Ready
> **Repo:** `print-bridge`

**Dependencia:** Ejecutar después de `PRPs/005--system-tray-electron-core.md`.

**PRPs relacionados:**
- Tray core: `PRPs/005--system-tray-electron-core.md`
- Windows legacy pkg: `PRPs/001--impresion-termica-bridge-windows.md`
- Panel descargas: `panel-admin-ag360ai/PRPs/083--print-bridge-tray-instructions-panel.md`

---

## Goal

Empaquetar el bridge Electron como **artefactos de distribución profesionales** y actualizar CI para publicarlos en GitHub Releases:

| Artefacto | Uso |
|-----------|-----|
| `maxy-print-bridge-setup.exe` | Instalador NSIS (recomendado para restaurantes) |
| `maxy-print-bridge-win.exe` | Portable (sin instalación; reemplaza build `pkg` actual) |

Incluir: icono de aplicación, desinstalador, opciones de instalador (“Iniciar con Windows”, “Ejecutar al terminar”), comprobador manual de actualizaciones y documentación alineada.

---

## Why

- PRP 005 entrega la app tray en desarrollo; los restaurantes necesitan un **`.exe` descargable** como hoy, pero sin consola.
- El instalador mejora percepción (Programas y características, acceso directo, desinstalar).
- El workflow actual (`.github/workflows/print-bridge-release.yml`) usa `pkg:win`; hay que migrarlo a `electron-builder`.
- El panel consume URLs fijas (`VITE_PRINT_BRIDGE_DOWNLOAD_URL`); conviene documentar qué URL apunta al setup vs portable.

---

## What

### `electron-builder.yml` (NUEVO)

```yaml
appId: com.maxy.print-bridge
productName: Maxy Print Bridge
copyright: Copyright © Maxy Food

directories:
  output: release
  buildResources: assets

files:
  - dist/**/*
  - assets/**/*
  - package.json

win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
  icon: assets/icon.ico
  artifactName: maxy-print-bridge-setup.${ext}   # nsis

portable:
  artifactName: maxy-print-bridge-win.${ext}

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: Maxy Print Bridge
  installerIcon: assets/icon.ico
  uninstallerIcon: assets/icon.ico
  installerHeaderIcon: assets/icon.ico
  include: build/installer.nsh    # hooks opcionales

extraMetadata:
  main: dist/electron/main.js
```

### Hooks instalador: `build/installer.nsh` (NUEVO, opcional)

- Página custom o checkbox post-install:
  - ☑ Iniciar Maxy Print Bridge al terminar
  - ☑ Iniciar con Windows (escribe `openAtLogin: true` en config vía registro o deja al usuario marcarlo en tray)

Si NSIS custom es complejo, basta con **“Ejecutar al terminar”** vía `electron-builder` `runAfterFinish: true`.

### Scripts `package.json`

**MODIFY:**

```json
{
  "scripts": {
    "dist:win": "npm run build:electron && electron-builder --win --x64",
    "dist:win:portable": "npm run build:electron && electron-builder --win portable --x64",
    "dist:win:setup": "npm run build:electron && electron-builder --win nsis --x64"
  },
  "devDependencies": {
    "electron-builder": "^25.0.0"
  },
  "build": "./electron-builder.yml"
}
```

**Deprecar (no eliminar de golpe):**

```json
"pkg:win": "..."   // marcar deprecated en README; quitar de CI tras validar dist:win
```

### Comprobador de actualizaciones: `electron/update-check.ts` (NUEVO)

Menú tray → **“Buscar actualizaciones…”**:

1. `GET https://api.github.com/repos/{owner}/{repo}/releases/latest`
2. Comparar tag `print-bridge-X.Y.Z` con `app.getVersion()`.
3. Si hay versión mayor → `Notification` + `shell.openExternal(release.html_url)`.
4. **No** auto-update silencioso en v1 (SmartScreen, control del restaurante).

Configurar owner/repo desde `package.json` `repository` o constante.

### Versión de app

**MODIFY:** `package.json`

- `"version": "1.3.0"` (o bump acorde al release).
- Sincronizar con menú “Acerca de” y texto de soporte.

Tag GitHub: `print-bridge-1.3.0` (convención existente).

### CI: `.github/workflows/print-bridge-release.yml`

**MODIFY** job `build-and-attach` (Windows):

```yaml
- name: Install dependencies and build Electron artifacts
  run: |
    npm ci
    npm run dist:win

- name: Verify artifacts
  shell: pwsh
  run: |
    @(
      "release/maxy-print-bridge-setup.exe",
      "release/maxy-print-bridge-win.exe"
    ) | ForEach-Object {
      if (-not (Test-Path $_)) { throw "Missing $_" }
      Get-Item $_ | Select-Object Name, Length
    }

- name: Upload assets to release
  if: github.event_name == 'release'
  uses: softprops/action-gh-release@v2
  with:
    files: |
      release/maxy-print-bridge-setup.exe
      release/maxy-print-bridge-win.exe
```

**Decisión macOS/Linux (v1 tray):**

- Jobs `build-mac-*` y `build-linux-*` **siguen con `pkg`** hasta PRP futuro de tray multiplataforma.
- Documentar en README: bandeja del sistema = **Windows only** en v1.3.

### Assets requeridos

| Archivo | Uso |
|---------|-----|
| `assets/icon.ico` | App, instalador, acceso directo |
| `assets/icon-tray-ready.png` | Bandeja OK |
| `assets/icon-tray-warn.png` | Sin impresora |
| `assets/icon-tray-error.png` | Error |
| `assets/icon-tray-printing.png` | Imprimiendo |

Tamaño tray recomendado: 16×16 y 32×32 embebidos en `.ico`.

### Documentación

**MODIFY:** `README.md`

- Sección “Uso en caja”: buscar icono en bandeja (↑ junto al reloj), no ventana de consola.
- Dos descargas: instalador (recomendado) vs portable.
- SmartScreen: “Más información → Ejecutar de todas formas”.

**MODIFY:** `PRINT_BRIDGE_DEPLOY.md`

- Tabla URLs:
  - `VITE_PRINT_BRIDGE_DOWNLOAD_URL` → **setup.exe** (recomendado) o portable (documentar cuál usa prod).
  - Opcional nueva variable panel: `VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE` (PRP 083).

**MODIFY:** `PRPs/001--impresion-termica-bridge-windows.md`

- Nota al pie: Task 5 (instalador / autostart) cubierto por PRPs 005–006.

---

## Tareas

### Task 1 — electron-builder local

1. Añadir `electron-builder.yml` y scripts.
2. `npm run dist:win` genera setup + portable en `release/`.
3. Probar instalación en VM o PC limpia.

### Task 2 — CI Release

1. Actualizar workflow Windows.
2. Release de prueba `print-bridge-1.3.0-rc1` (pre-release) con ambos assets.
3. Verificar descarga HTTPS directa.

### Task 3 — Update check

1. Implementar `update-check.ts`.
2. Entrada en menú tray.
3. Manejar rate limit GitHub API (User-Agent, token opcional no requerido para público).

### Task 4 — Deprecar pkg Windows

1. Quitar `pkg:win` del workflow tras validación.
2. Mantener script local para emergencias 1 release cycle.
3. Actualizar `scripts/publish-win-exe.mjs` → obsoleto o redirigir a electron-builder.

### Task 5 — Documentación cross-repo

1. README + PRINT_BRIDGE_DEPLOY.
2. Coordinar con panel PRP 083 URLs y textos.

---

## Success Criteria

- [ ] Tag `print-bridge-*` adjunta **setup.exe** y **portable .exe** al Release.
- [ ] Instalador crea acceso directo y entrada en “Agregar o quitar programas”.
- [ ] App instalada arranca en bandeja sin consola.
- [ ] Portable funciona igual sin instalación.
- [ ] Puertos 17880/17881 operativos tras install y tras portable.
- [ ] Panel existente conecta sin cambios de código (solo URL de descarga si cambia a setup).
- [ ] “Buscar actualizaciones” detecta release más nuevo y abre página GitHub.
- [ ] macOS/Linux releases siguen publicándose (pkg) sin regresión.
- [ ] `workflow_dispatch` sube artifacts de prueba descargables.

---

## Out Of Scope

- Firma Authenticode / certificado EV (recomendado futuro; documentar workaround SmartScreen).
- Auto-update in-app (electron-updater).
- Tray en macOS/Linux.
- Microsoft Store / Winget.
- Cambios backend o panel obligatorios (panel PRP 083 es complementario).

---

## All Needed Context

```yaml
LEER:
  - PRPs/005--system-tray-electron-core.md
  - .github/workflows/print-bridge-release.yml
  - package.json
  - scripts/publish-win-exe.mjs
  - README.md
  - PRINT_BRIDGE_DEPLOY.md

PANEL:
  - panel-admin: src/config/env.ts (VITE_PRINT_BRIDGE_DOWNLOAD_URL)
  - panel-admin: PRPs/083--print-bridge-tray-instructions-panel.md
```

---

## Gotchas

```text
GOTCHA 1: electron-builder empaqueta node_modules completos; revisar files/extraFiles
  para no inflar el instalador (excluir devDependencies).

GOTCHA 2: native modules (si algún día se añaden) requieren rebuild para Electron;
  hoy ws y node-thermal-printer son JS puro — OK.

GOTCHA 3: El portable de electron-builder NO es el mismo formato que pkg;
  validar send-raw-print.ps1 warmup sigue funcionando empaquetado.

GOTCHA 4: NSIS puede requerir admin para Program Files; usar perUser install
  (electron-builder default recent) para evitar UAC en cajas limitadas.

GOTCHA 5: Cambiar URL en VITE_PRINT_BRIDGE_DOWNLOAD_URL requiere redeploy panel;
  coordinar release bridge + panel.

GOTCHA 6: GitHub API releases/latest sin auth: 60 req/h; update check manual es OK.

GOTCHA 7: No commitear release/*.exe; solo CI artifacts.
```

---

## Cross-repo checklist

| Repo | Acción |
|------|--------|
| `print-bridge` | Este PRP — electron-builder + CI |
| `panel-admin-ag360ai` | PRP 083 — URL setup + textos bandeja |
| `ssgg` | Sin cambios |

### URLs ejemplo post-release

```
# Instalador (recomendado para VITE_PRINT_BRIDGE_DOWNLOAD_URL)
https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.3.0/maxy-print-bridge-setup.exe

# Portable
https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.3.0/maxy-print-bridge-win.exe
```
