# Maxy Print Bridge

Servicio local (Windows) que escucha en `ws://127.0.0.1:8080`, recibe el JSON de ticket térmico y lo imprime vía ESC/POS sin intervención del navegador.

## Variables de entorno (solo en la PC del cliente)

| Variable | Descripción |
|----------|-------------|
| `PRINT_BRIDGE_PORT` | Puerto (default `8080`) |
| `PRINT_BRIDGE_HOST` | Bind (default `127.0.0.1`; no exponer en red) |
| `PRINT_BRIDGE_PRINTER_NAME` | Nombre exacto de la impresora en Windows. Si se omite, usa la **impresora predeterminada** del sistema. |

## Ejecutar en desarrollo

```bash
cd print-bridge
npm install
npm run dev
```

## Compilar TypeScript

```bash
npm run build && npm start
```

## CI (GitHub Actions)

En el monorepo, el workflow **`.github/workflows/print-bridge-release.yml`** genera el `.exe` en `windows-latest` y lo adjunta al release si el tag es `print-bridge-*`.

## Generar `.exe` (pkg)

Requiere Node 18+ y herramientas de build si alguna dependencia nativa lo pide:

```bash
npm run pkg:win
```

El binario queda en `print-bridge/release/maxy-print-bridge-win.exe`. Si `pkg` falla por módulos nativos, distribuye la carpeta `dist/` + `node_modules` y un `.bat` que ejecute `node dist/index.js`, o instala Node LTS en el cliente.

## Protocolo WebSocket

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"thermalPrint":{...}}` → `{"ok":true}` o `{"ok":false,"error":"..."}`

La cola interna procesa un ticket a la vez para evitar mezclar trabajos en la misma impresora.
