# Protocolo WebSocket (puerto 17880, con fallback)

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"token":"...","thermalPrint":{...}}` → `{"ok":true}` o error

Cola interna: **un ticket a la vez**.

## Puerto dinámico (17880 preferido, no garantizado)

`17880` es el puerto **preferido**, no fijo. Si está ocupado por otro programa, el bridge le pide al sistema operativo un puerto libre (`listen(0, host)`) y sigue funcionando ahí — no se cae ni deja de imprimir. El puerto real queda en `BridgeStatus.wsPort` y se reporta en `GET http://127.0.0.1:17881/api/config` (campo `wsPort`), en el **mismo puerto fijo de settings (17881)**, que no tiene fallback.

El panel (`localPrintBridge.ts`, función `resolveWsUrl`) consulta ese endpoint antes de conectar el WS: si `17880` no responde, pregunta a `17881/api/config` cuál es el puerto real y conecta ahí. Si esa consulta también falla (caso borde: los dos puertos ocupados a la vez), usa el puerto configurado por defecto como último recurso — no hay reintento ni escaneo de más puertos, es una limitación conocida y aceptada.

Ver `PRPs/008--ws-port-fallback.md` para el detalle de la implementación.

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
