# Maxy Print Bridge

Servicio local (Windows) que:

- Escucha en **`ws://127.0.0.1:8080`** y recibe trabajos de impresión (JSON → ESC/POS).
- Ofrece una **página simple** en **`http://127.0.0.1:8081`** para elegir la impresora térmica **sin variables de entorno**.

La configuración se guarda en **`%APPDATA%\MaxyPrintBridge\config.json`**.

## Uso en el local

1. Ejecutar `maxy-print-bridge-win.exe` (o `npm start` en desarrollo).
2. Abrir **http://127.0.0.1:8081**, elegir impresora, **Guardar**.
3. Dejar el programa en segundo plano mientras se usa el panel web; las ventas disparan la impresión por el puerto 8080.

## Desarrollo

```bash
npm install
npm run dev
```

Compilar:

```bash
npm run build && npm start
```

## CI (GitHub Actions)

En el **repositorio de este proyecto** (raíz = esta carpeta), el workflow **`.github/workflows/print-bridge-release.yml`** genera el `.exe` en `windows-latest` y lo adjunta al release si el tag es `print-bridge-*`.

## Generar `.exe` (pkg)

```bash
npm run pkg:win
```

Salida: **`release/maxy-print-bridge-win.exe`** (relativo a la raíz de este proyecto).

## Protocolo WebSocket (puerto 8080)

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"thermalPrint":{...}}` → `{"ok":true}` o `{"ok":false,"error":"..."}`

La cola interna procesa un ticket a la vez.
