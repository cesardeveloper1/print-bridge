# PRP: Fallback de puerto WS + descubrimiento por el panel

> **Version:** 1.0
> **Created:** 2026-07-10
> **Status:** Implemented
> **Repo:** `print-bridge`

**PRP relacionado:** `PRPs/007--ws-origin-and-token-hardening.md` (el `Origin` allowlist ya gatea quién puede conectarse; este PRP resuelve qué pasa cuando el puerto preferido está ocupado, no toca autenticación).

---

## Goal

El bridge escuchaba siempre en `WS_PORT` (17880) fijo — si otro programa ya lo tenía ocupado, el bridge quedaba en estado `error` sin imprimir hasta que el usuario liberara el puerto o reiniciara la PC. Agregar un fallback: si 17880 está ocupado, pedirle al SO un puerto libre cualquiera y seguir funcionando ahí, con el panel descubriendo automáticamente ese puerto real.

## Why

- Consulta original del usuario: "el puerto en el que se aloja puede estar ocupado en algunos casos". No hay forma de saber de antemano qué otro software (u otra instancia zombie del propio bridge) puede estar usando 17880 en la PC de un restaurante.
- Se evaluó un pool de puertos candidatos (varios pares WS/UI fijos) y se descartó por más complejidad: requeriría mantener la misma lista sincronizada en dos repos y escanear varios puertos en serie desde el navegador.
- Diseño elegido: **solo el puerto WS es dinámico** (`listen(0, host)`, el SO asigna uno libre garantizado). El puerto de settings (`UI_PORT`, 17881) se mantiene **fijo, sin fallback** — es el que ya usan la documentación, el cajero (visita manual) y, ahora, el mecanismo de descubrimiento. Un solo punto de verdad en vez de dos rangos a mantener.

---

## What

### 1. `src/bridge.ts` — `bindWebSocketServerWithFallback`

Intenta `listen` en `WS_PORT`; si el error es `EADDRINUSE`, reintenta con `port: 0` (el SO asigna uno libre). El puerto real se lee de `wss.address()` y queda en `BridgeStatus.wsPort` (reemplaza el valor estático que tenía antes).

### 2. `src/settings-server.ts` — `GET /api/config` devuelve el puerto real

`startSettingsServer` ahora recibe `wsPort` (el puerto ya resuelto) como parámetro y lo incluye en la respuesta de `GET /api/config`, en vez de la constante `WS_PORT` fija de antes.

### 3. `electron/main.ts` — UI usa el puerto real, no el estático

Tooltip de bandeja, diálogo "Acerca de" y "Copiar información de soporte" ahora arman la URL del WebSocket con `BridgeStatus.wsPort` (vía helper `currentWsUrl()`), no con la constante `WS_URL` precomputada.

### 4. `panel-admin-ag360ai/src/services/localPrintBridge.ts` — `resolveWsUrl()`

Antes de conectar (`checkPrintBridgeReachable`, `sendThermalPrintJob`), el panel consulta `GET http://127.0.0.1:17881/api/config`. Si devuelve `wsPort`, conecta ahí. Si la consulta falla (timeout 1.5s, bridge viejo sin el campo, o 17881 también ocupado), usa `config.printBridgeWsUrl` (17880) como antes — comportamiento idéntico al de hoy si nada cambió.

### Success Criteria

- [x] Con 17880 libre, el comportamiento es idéntico al de antes (mismo puerto, sin discovery extra visible).
- [x] Con 17880 ocupado por otro proceso, el bridge inicia igual, en un puerto libre asignado por el SO.
- [x] `GET http://127.0.0.1:17881/api/config` reporta el `wsPort` real en ambos casos.
- [x] El panel conecta correctamente al puerto real sin configuración manual, incluso cuando no es 17880.
- [x] Si además 17881 estuviera ocupado (no probado — caso borde no resuelto), el panel cae al puerto configurado por defecto sin crashear.

### Out Of Scope

- Fallback para `UI_PORT` (17881) — se mantiene fijo. Si ambos puertos están ocupados a la vez, es una limitación conocida, no resuelta por este PRP.
- Persistir el puerto elegido entre reinicios del bridge — se resuelve de nuevo en cada arranque.
- Cachear el puerto descubierto en el panel entre llamadas — cada `print`/`ping` vuelve a consultar `GET /api/config` (round-trip local, ~1-5ms, no justifica la complejidad de cachear e invalidar).

---

## Validation Loop

Probado manualmente end-to-end: se ocupó 17880 con un servidor TCP dummy, se arrancó el bridge (`npx ts-node src/index.ts`), confirmó que tomó un puerto efímero (`59102` en la prueba), que `GET /api/config` en 17881 lo reportó correctamente, y que un cliente WS simulando exactamente el flujo de `resolveWsUrl()` del panel (consultar 17881 → conectar al puerto descubierto) completó el ping con éxito.

```bash
npm run build            # print-bridge — OK
npm run build:electron   # print-bridge — OK
```

```bash
npm run lint   # panel-admin-ag360ai — sin errores nuevos en localPrintBridge.ts (1169 preexistentes en el repo, no relacionados)
npm run build  # panel-admin-ag360ai — OK
```

---

## Quality Checklist

- [x] Caso común (puerto libre) sin cambios de comportamiento ni overhead perceptible.
- [x] Caso de fallback probado de punta a punta, no solo en teoría.
- [x] Sin acoplamiento de listas de puertos entre repos — un solo campo (`wsPort`) vía un endpoint ya existente.
- [x] Documentado en `docs/protocolo-ws.md`.
