# PRP: Origin Allowlist + Shared Token Hardening (WS 17880 y Settings HTTP 17881)

> **Version:** 1.3
> **Created:** 2026-07-10
> **Updated:** 2026-07-10 — implementado y validado manualmente (9 escenarios); `bridge-token.ts` pasó a ser generado desde `.env` (no hardcodeado, no commiteado) vía `scripts/generate-bridge-token.mjs`; ver "Estado final" al pie
> **Status:** Implemented
> **Repo:** `print-bridge`

**PRP relacionado:** `panel-admin-ag360ai/PRPs/169--print-bridge-ws-origin-token.md` (envía `Origin` correcto por diseño del navegador + agrega el token al payload).

---

## Goal

Los dos servidores locales del bridge aceptan conexiones sin validar de dónde vienen:

- **WS** (`ws://127.0.0.1:17880`) — recibe trabajos de impresión, sin `verifyClient`.
- **HTTP de settings** (`http://127.0.0.1:17881`) — expone `GET/POST /api/config` y `GET /api/printers` con **CORS explícitamente abierto a cualquier origen** (`Access-Control-Allow-Origin: '*'`).

Agregar tres capas de defensa, sin romper el protocolo de mensajes existente salvo un campo opcional `token`:

1. **Allowlist de `Origin`** en el handshake WS — rechaza cualquier página que no sea el panel oficial.
2. **Token compartido** embebido en el binario — validado en cada mensaje `print` antes de encolar el trabajo.
3. **Cerrar el CORS wildcard de `settings-server.ts`** — reemplazar `'*'` por el mismo allowlist de origins, y exigir el token en `POST /api/config` (el endpoint que muta configuración).

## Why

- El `WebSocketServer` en `src/bridge.ts:121` no define `verifyClient`. Cualquier pestaña abierta en el mismo navegador de la caja (ads, sitio comprometido, phishing) puede abrir un WS a `127.0.0.1:17880` y mandar tickets de impresión falsos o saturar la cola — WS no tiene CORS/preflight como `fetch`.
- El bind es solo a `127.0.0.1`, así que el riesgo es exclusivamente "otro proceso/pestaña en la misma PC", no exposición de red. El `Origin` header lo pone el navegador y no puede ser falsificado por JS de la página — es la defensa correcta y barata para este caso.
- El token es defensa en profundidad: cubre clientes no-navegador que sí pueden falsificar `Origin` (ej. otro `.exe` local malicioso).
- **Gap encontrado en revisión:** `src/settings-server.ts:6-15` (función `json`) y el handler de `OPTIONS` (línea ~288) devuelven `Access-Control-Allow-Origin: '*'` en **todas** las respuestas, incluido `POST /api/config`. Eso no es "falta de validación" — es una wildcard puesta a propósito (probablemente para que el panel pueda hacer `fetchBridgeConfig()` vía `GET /api/config` desde `https://...`, ver `panel-admin-ag360ai/src/services/localPrintBridge.ts:19`). El problema es que **también habilita el preflight de `POST`**, así que cualquier sitio malicioso abierto en la misma PC puede reconfigurar en silencio el ticket automático, notificaciones, ancho de papel, etc. (CSRF clásico sobre un CORS mal alcanzado). Este endpoint no imprime nada, pero sí controla cómo se imprime — no puede quedar fuera de este PRP.

---

## What

### 1. `src/allowed-origins.ts` (nuevo)

```typescript
export const ALLOWED_ORIGINS = [
  'https://admin.agiliza360.ai', // panel en producción (implementado)
  'http://localhost:8080',       // Vite dev server del panel
];

export function isOriginAllowed(origin: string | undefined, packaged: boolean): boolean {
  if (!origin) {
    // wscat y pruebas manuales no mandan Origin; solo permitir en dev (no empaquetado)
    return !packaged;
  }
  return ALLOWED_ORIGINS.includes(origin);
}
```

### 2. `src/bridge-token.ts` (generado, no hardcodeado)

Implementación final: en vez de un archivo commiteado con el valor hardcodeado, `src/bridge-token.ts` es **generado y gitignored**. `scripts/generate-bridge-token.mjs` lee `PRINT_BRIDGE_TOKEN` de `.env` (también gitignored) y escribe el archivo antes de cada `dev`/`build`/`build:electron` (hooks `predev`/`prebuild`/`prebuild:electron` en `package.json`). Si falta la variable en `.env`, el generador falla con exit code 1 y un mensaje claro — no hay fallback silencioso que deje el bridge sirviendo sin token.

```typescript
// contenido generado, ver scripts/generate-bridge-token.mjs
export const PRINT_BRIDGE_SHARED_TOKEN = 'OgcVZ7U3ApeyM-KuoOvFGj2Vvnb12tlC'; // valor actual en .env
```

Para rotar el token: editar `PRINT_BRIDGE_TOKEN` en `.env`, correr `npm run build`/`build:electron` de nuevo, y actualizar `VITE_PRINT_BRIDGE_TOKEN` en todos los ambientes del panel al mismo valor. **Pendiente:** el workflow de CI (`.github/workflows/print-bridge-release.yml`) todavía no escribe `.env` desde un secret antes de compilar — hoy solo funciona en builds locales con `.env` presente.

### 3. `src/bridge.ts` — `verifyClient` en el `WebSocketServer`

```typescript
import { isOriginAllowed } from './allowed-origins';

const wss = new WebSocketServer({
  host,
  port: WS_PORT,
  verifyClient: (info, cb) => {
    const packaged = options?.packaged !== false && !!process.versions?.electron;
    if (isOriginAllowed(info.origin, packaged)) return cb(true);
    fileLog.error(`WS rechazado: origin no permitido "${info.origin}"`);
    cb(false, 403, 'Origin no permitido');
  },
});
```

### 4. `src/bridge.ts` — validar token antes de encolar (dentro del handler de `message`, después de `parseMessage`)

```typescript
import { PRINT_BRIDGE_SHARED_TOKEN } from './bridge-token';

// después de: const msg = parseMessage(text); if (!msg) { ... }
if (msg.token !== PRINT_BRIDGE_SHARED_TOKEN) {
  fileLog.error(`WS mensaje rechazado: token inválido (order=${msg.thermalPrint?.orderId})`);
  socket.send(JSON.stringify({ ok: false, error: 'No autorizado' }));
  return;
}
```

El `ping` (`{"type":"ping"}`) **no** requiere token — se resuelve antes en el mismo handler y no expone ninguna acción sensible.

### 5. `src/types.ts` — agregar `token?: string` a `PrintJobMessage`

### 6. `src/bridge.ts` — `parseMessage` debe seguir aceptando mensajes sin `token` como JSON válido (para no romper el parseo), la validación de token va **después**, no dentro de `parseMessage`.

### 7. `src/settings-server.ts` — cerrar el CORS wildcard

Reutilizar `isOriginAllowed` de `src/allowed-origins.ts`. Regla: si viene `Origin` y no está permitido, rechazar; si no viene `Origin` (navegación directa a `http://127.0.0.1:17881` o llamada `fetch` same-origin desde la propia página de settings), permitir — es el caso normal de "cajero abre el ícono de bandeja".

```typescript
import { isOriginAllowed } from './allowed-origins';

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = isOriginAllowed(origin, true); // settings server siempre "packaged-strict": exige match si hay Origin
  return allowed && origin
    ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
    : {}; // sin Origin (same-origin real) no hace falta CORS; con Origin no permitido, no reflejar nada
}

function json(res: http.ServerResponse, code: number, body: unknown, origin?: string) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(origin),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}
```

En el handler principal, obtener `req.headers.origin` y:
- Si hay `Origin` y **no** está permitido → responder `403` (mismo código en `OPTIONS`, `GET` y `POST`) antes de tocar `readUserConfig`/`writeUserConfig`.
- `POST /api/config` además exige `body.token === PRINT_BRIDGE_SHARED_TOKEN` (mismo secreto del WS) — es el endpoint que muta estado, el que hay que proteger más.
- `GET /api/config` y `GET /api/printers` no requieren token (son lectura, y el panel los usa sin token hoy vía `fetchBridgeConfig`); quedan protegidos solo por el Origin allowlist.

Esto implica que **la propia página de settings** (`SETTINGS_PAGE`, servida en `GET /`) debe mandar el token al guardar. Como esa página es HTML/JS servido por el mismo bridge (no por el panel), el valor puede inyectarse server-side al renderizarla:

```typescript
// en startSettingsServer, al responder GET '/':
html(res, 200, SETTINGS_PAGE.replace('__BRIDGE_TOKEN__', PRINT_BRIDGE_SHARED_TOKEN));
```
y en el `<script>` del `SETTINGS_PAGE`, incluir `token: '__BRIDGE_TOKEN__'` en el body del `fetch('/api/config', { method: 'POST', ... })`.

### Success Criteria

- [ ] Una conexión WS desde un `Origin` fuera de `ALLOWED_ORIGINS` es rechazada en el handshake (código 403), y queda logueada en `file-logger`.
- [ ] Un mensaje `print` sin `token` o con `token` incorrecto responde `{ ok: false, error: 'No autorizado' }` y no llega a `queue.add`.
- [ ] `ping` sigue funcionando sin token (compatibilidad con `wscat` en dev).
- [ ] En modo dev (`npm run dev`, sin Electron empaquetado) sigue siendo posible probar con `wscat` sin mandar `Origin`.
- [ ] `GET/POST /api/config` y `GET /api/printers` en `settings-server.ts` ya no responden `Access-Control-Allow-Origin: '*'`; solo reflejan un origen si está en `ALLOWED_ORIGINS`.
- [ ] `POST /api/config` sin `token` correcto responde `403`/`401` y **no** llama a `writeUserConfig`.
- [ ] La página de settings servida en `http://127.0.0.1:17881/` sigue guardando configuración sin fricción (el token se inyecta server-side, el cajero no ve ni escribe nada).
- [ ] `docs/protocolo-ws.md` documenta el campo `token` del mensaje `print`. `README.md` ya no tiene esa sección (fue dividido) — no editarlo ahí.

### Out Of Scope

- No cambiar el puerto ni el protocolo de descubrimiento.
- No implementar token por-instalación (rotación, UI de configuración) — es un secreto estático de fábrica.
- No agregar autenticación a `GET /api/config` / `GET /api/printers` más allá del Origin allowlist — son de solo lectura y de baja sensibilidad (nombre de impresora, config de ticket).

---

## All Needed Context

### Files To Inspect

```yaml
READ:
  - src/bridge.ts          # WebSocketServer, handler de mensajes
  - src/settings-server.ts # HTTP 17881, CORS wildcard actual, SETTINGS_PAGE inline
  - src/types.ts           # PrintJobMessage
  - src/file-logger.ts     # fileLog.error para logging de rechazos
  - src/index.ts           # cómo se pasa options.packaged a startBridge
  - CLAUDE.md               # protocolo wscat de pruebas manuales
  - docs/protocolo-ws.md    # doc del protocolo WS (README.md fue dividido en docs/*.md)
  - docs/desarrollo.md      # enlaza a protocolo-ws.md, revisar si necesita nota sobre token
```

### Conventions

```yaml
Style: TypeScript strict mode, sin librerías nuevas (usar 'ws' ya presente)
Logging: fileLog.error / fileLog.info (src/file-logger.ts)
No hay tests ni linter configurado — validar con `npm run build`
```

---

## Implementation Blueprint

### Task 1 — Origin allowlist
Crear `src/allowed-origins.ts`, cablear `verifyClient` en `src/bridge.ts`.

### Task 2 — Token compartido
Crear `src/bridge-token.ts`, agregar `token?: string` a `PrintJobMessage` en `src/types.ts`, validar en el handler de `message` antes de `resolveTicketJobs`.

### Task 3 — Cerrar CORS de `settings-server.ts`
Reemplazar `Access-Control-Allow-Origin: '*'` por el allowlist (`corsHeaders`), exigir `token` en `POST /api/config`, e inyectar el token server-side en `SETTINGS_PAGE` para que el `fetch('/api/config', { method: 'POST' })` de la propia página siga funcionando sin que el cajero haga nada distinto.

### Task 4 — Documentación
Actualizar `docs/protocolo-ws.md` (puerto 17880, campo `token`) y `CLAUDE.md` con el nuevo requisito de `Origin`/`token` para ambos servidores (17880 y 17881), y el dominio real de producción en `ALLOWED_ORIGINS`. **No** editar `README.md` — ese contenido ya vive en `docs/` tras el split; `README.md` solo debe seguir enlazando a `docs/protocolo-ws.md`.

### Task 5 — Coordinar con el panel
Confirmar con `panel-admin-ag360ai/PRPs/169--print-bridge-ws-origin-token.md` que `VITE_PRINT_BRIDGE_TOKEN` en el build de producción coincide byte a byte con `PRINT_BRIDGE_SHARED_TOKEN` de este repo antes de publicar un release.

---

## Validation Loop

### Build

```bash
npm run build
```

### Manual (dev, sin empaquetar)

```bash
npm run dev
wscat -c ws://127.0.0.1:17880
# {"type":"ping"} → {"ok":true,"type":"pong"}  (sin Origin, permitido solo en dev)
```

### Manual (Origin rechazado)

Abrir una página HTML cualquiera fuera del allowlist y ejecutar en su consola:
```js
new WebSocket('ws://127.0.0.1:17880').onerror = console.log;
```
Debe fallar el handshake (no debe llegar a `onopen`).

### Manual (token)

Con el panel real conectado (Origin permitido) mandar un `print` sin `token` o con uno incorrecto → debe responder `{ ok: false, error: 'No autorizado' }` sin imprimir.

### Manual (settings-server CORS)

Desde una página fuera del allowlist:
```js
fetch('http://127.0.0.1:17881/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ printerName: 'hackeado' }),
}).then(r => r.status).then(console.log);
```
Debe fallar el preflight (no debe completar el POST) — verificar además que `config.json` no cambió.

Abrir `http://127.0.0.1:17881/` directamente en el navegador (flujo normal del cajero) y confirmar que **Guardar cambios** sigue funcionando sin fricción.

---

## Quality Checklist

- [x] `ALLOWED_ORIGINS` y `PRINT_BRIDGE_SHARED_TOKEN` tienen valores reales antes de publicar release (no placeholders).
- [x] Rechazos quedan logueados (`file-logger`) para poder diagnosticar falsos positivos en producción.
- [x] `wscat`/pruebas manuales sin `Origin` siguen funcionando en dev (verificado con cliente `ws` directo).
- [x] No se rompe el flujo existente del panel (ping + print con token válido, `fetchBridgeConfig` vía `GET /api/config`).
- [x] No se rompe el flujo de la página de settings (`http://127.0.0.1:17881/` abierta directo desde el ícono de bandeja) — Guardar cambios sigue funcionando sin que el cajero vea ni copie ningún token.
- [x] `settings-server.ts` ya no devuelve `Access-Control-Allow-Origin: '*'` en ninguna respuesta.

---

## Estado final (2026-07-10)

Implementado y probado manualmente contra el bridge real (9/9 escenarios: ping sin Origin en dev, Origin no permitido rechazado 403, print sin token rechazado, `GET/POST /api/config` con CORS cerrado, POST sin token bloqueado sin corromper `config.json`, flujo completo de la página de settings con token inyectado). `npm run build` y `npm run build:electron` compilan sin errores.

Archivos tocados: `src/allowed-origins.ts` (nuevo), `src/bridge-token.ts` (nuevo), `src/bridge.ts`, `src/settings-server.ts`, `src/types.ts`, `CLAUDE.md`, `docs/protocolo-ws.md`, `docs/deploy/panel-env.md`, `.env.example`.

**Pendiente para producción:** publicar un release de `print-bridge` con este código y coordinar `VITE_PRINT_BRIDGE_TOKEN` en GitHub Environments del panel (ver `panel-admin-ag360ai/PRPs/169--print-bridge-ws-origin-token.md`, ya implementado también).
