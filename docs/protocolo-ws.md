# Protocolo WebSocket (puerto 17880)

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"token":"...","thermalPrint":{...}}` → `{"ok":true}` o error

Cola interna: **un ticket a la vez**.

## Seguridad

Ambos servidores locales (WS `:17880` y settings HTTP `:17881`) validan el header `Origin` del navegador contra un allowlist (`src/allowed-origins.ts`) — solo el panel oficial (producción y dev) puede conectarse. `wscat` y otras pruebas manuales sin `Origin` solo funcionan en modo dev (`npm run dev`, sin empaquetar).

Además, `print` (WS) y `POST /api/config` (settings HTTP) exigen un `token` compartido (`src/bridge-token.ts`) que debe coincidir con `VITE_PRINT_BRIDGE_TOKEN` horneado en el build del panel. `ping` y los `GET` de settings no lo requieren — quedan protegidos solo por el Origin allowlist. Ver `PRPs/007--ws-origin-and-token-hardening.md` para el detalle.

`src/bridge-token.ts` es un archivo **generado** (gitignored) — se genera desde `PRINT_BRIDGE_TOKEN` en `.env` vía `scripts/generate-bridge-token.mjs`, que corre automático antes de `dev`/`build`/`build:electron`. Para cambiar el token: editar `.env`, no `bridge-token.ts`.

## Estructura del proyecto

```
print-bridge/
├── src/
│   ├── index.ts           # WebSocket :17880
│   ├── settings-server.ts # Página :17881
│   ├── config-store.ts
│   ├── format-ticket.ts
│   └── windows-printers.ts
├── .github/workflows/
├── docs/
└── PRPs/
```
