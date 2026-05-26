# PRP: Maxy Print Bridge — ejecutable Windows y publicación

> **Version:** 1.0
> **Created:** 2026-05-26
> **Status:** Ready
> **Repo:** `print-bridge` (Node + pkg, Windows local)

**PRPs relacionados:**
- Panel: `panel-admin-ag360ai/PRPs/039--impresion-termica-configuracion-marca.md`
- Backend: `ssgg/PRPs/056--impresion-termica-socket-payload.md`

**Documentación de despliegue:** `PRINT_BRIDGE_DEPLOY.md` (raíz del repo)

---

## Goal

Mantener y publicar el **servicio local Windows** que recibe trabajos de impresión del panel (`ws://127.0.0.1:8080`) e imprime tickets ESC/POS en la impresora elegida, con configuración **sin variables de entorno** para el restaurante (solo UI en `http://127.0.0.1:8081`).

Entregable principal: **`maxy-print-bridge-win.exe`** en GitHub Releases, URL consumida por `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en el panel.

---

## Why

- Los navegadores no pueden imprimir en impresora térmica USB/red sin diálogo de forma fiable; el bridge corre en la PC de caja.
- El cliente no debe configurar API keys: conexión localhost; la “configuración” es elegir impresora en la página local.
- Repo dedicado (`cesardeveloper1/print-bridge`) con CI en `.github/workflows/print-bridge-release.yml`.

---

## What

### Arquitectura actual

```yaml
Puertos (fijos en src/index.ts):
  WS_PORT: 8080   # panel → JSON { type: print, version: 1, thermalPrint }
  UI_PORT: 8081   # página elegir impresora

Config persistida:
  path: %APPDATA%\MaxyPrintBridge\config.json
  code: src/config-store.ts

Protocolo:
  ping:  { "type": "ping" } → { "ok": true, "type": "pong" }
  print: { "type": "print", "version": 1, "thermalPrint": { ... } }
         → { "ok": true } | { "ok": false, "error": "..." }

Impresión:
  src/format-ticket.ts, node-thermal-printer
  cola: p-queue concurrency 1

Build exe:
  npm run pkg:win → release/maxy-print-bridge-win.exe
```

### Publicación (CI)

```yaml
Workflow: .github/workflows/print-bridge-release.yml
Trigger release: tag print-bridge-* (ej. print-bridge-1.0.0)
Trigger manual: workflow_dispatch → artifact
Runner: windows-latest
Steps: npm ci → npm run pkg:win → upload asset
```

URL típica para el panel:

```
https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.0.0/maxy-print-bridge-win.exe
```

### Tareas

#### Task 1 — Release inicial o bump

1. Merge código estable en `main`.
2. Crear tag `print-bridge-1.0.0` y publicar Release en GitHub.
3. Verificar asset `maxy-print-bridge-win.exe` descargable por HTTPS.
4. Comunicar URL a quien configure `VITE_PRINT_BRIDGE_DOWNLOAD_URL` (panel PRP 039).

#### Task 2 — README y `.env.example`

- `.env.example` en raíz: documenta que el **exe no lee .env**; variables `VITE_*` son del panel.
- `README.md`: pasos para restaurante (abrir exe → :8081 → guardar).

#### Task 3 — UX página :8081 (mejoras opcionales v1.1)

**MODIFY:** `src/settings-server.ts`

- Texto en español claro (ya parcialmente hecho).
- Tras guardar, línea: “Puede cerrar esta ventana y usar el panel en Operaciones.”
- Sin pedir tokens ni puertos al usuario en pantalla principal.

#### Task 4 — Robustez impresión (opcional)

- Reintentos en fallo de impresora ocupada.
- Log local rotativo en `%APPDATA%\MaxyPrintBridge\` (no consola visible para usuario).

#### Task 5 — Distribución alternativa (out of scope v1)

- Instalador Inno Setup / firma código.
- Entrada en Inicio automático con Windows.
- Soporte macOS/Linux.

### Success Criteria

- [ ] Tag `print-bridge-*` genera `.exe` en Release.
- [ ] `workflow_dispatch` produce artifact descargable para pruebas.
- [ ] En PC Windows: exe abre WS :8080 y UI :8081.
- [ ] Ping/pong responde (panel PRP 039 puede usarlo para “Conectado”).
- [ ] Print job de prueba desde panel o `wscat` imprime en impresora configurada.
- [ ] `PRINT_BRIDGE_DEPLOY.md` alineado con este PRP.

### Out Of Scope

- Autenticación entre panel y bridge (localhost trust).
- Cambiar puertos sin recompilar panel (`VITE_PRINT_BRIDGE_WS_URL`).
- Lógica de cuándo imprimir (ssgg PRP 056).
- UI del panel (PRP 039).

---

## All Needed Context

```yaml
LEER:
  - src/index.ts
  - src/settings-server.ts
  - src/config-store.ts
  - src/format-ticket.ts
  - src/windows-printers.ts
  - package.json (scripts pkg:win)
  - .github/workflows/print-bridge-release.yml
  - PRINT_BRIDGE_DEPLOY.md

PANEL (contrato consumidor):
  - panel-admin: src/services/localPrintBridge.ts
  - thermalPrint shape: ssgg ThermalPrintPayload / mapper
```

---

## Gotchas

```text
GOTCHA 1: pkg embebe Node 18 win-x64; impresora debe tener driver Windows instalado.

GOTCHA 2: Firewall raro en PCs corporativas puede bloquear 127.0.0.1:8080 — excepción local.

GOTCHA 3: Si el panel está en HTTPS y el browser bloquea ws://127.0.0.1, probar Edge/Chrome
  en la misma máquina; documentar en guía del panel.

GOTCHA 4: Nombre de impresora debe coincidir exactamente con lista Windows (settings-server).

GOTCHA 5: No commitear release/*.exe en git; solo CI artifacts / GitHub Release.
```

---

## Cross-repo checklist

| Repo | Acción |
|------|--------|
| `print-bridge` | Este PRP — release exe |
| `panel-admin` | `VITE_PRINT_BRIDGE_DOWNLOAD_URL` + UI PRP 039 |
| `ssgg` | Sin cambios; payload PRP 056 |
