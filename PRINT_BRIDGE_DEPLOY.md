# Impresión térmica: despliegue (Railway + GoDaddy)

Flujo: **NestJS (Railway)** emite por Socket.io un evento `order_status_changed` que puede incluir `thermalPrint`. **El panel (GoDaddy / estático)** reenvía ese JSON al **bridge** en `ws://127.0.0.1:8080` en la PC del restaurante. El bridge imprime por ESC/POS sin diálogo del navegador.

## Dónde subir el `.exe`

El backend **no** sirve el ejecutable: debe estar en un origen **HTTPS** accesible desde el navegador, por ejemplo:

- **GitHub Releases** (recomendado): este repo incluye el workflow **`.github/workflows/print-bridge-release.yml`**.
  1. Crea un **release** en GitHub cuyo **tag** empiece por `print-bridge-` (ej. `print-bridge-1.0.0`) y **públicalo**.
  2. El Actions compila en `windows-latest` con `pkg` y adjunta **`maxy-print-bridge-win.exe`** al mismo release.
  3. Copia la URL directa del asset. Formato típico:  
     `https://github.com/TU_ORG/TU_REPO/releases/download/print-bridge-1.0.0/maxy-print-bridge-win.exe`  
  Para probar sin release: **Actions → Print bridge (Windows .exe) → Run workflow**; descarga el artifact generado.
- **Azure Blob / S3 / Cloudflare R2** con acceso público de solo lectura.
- **Mismo hosting del panel** si tu hosting permite archivos estáticos grandes (menos habitual en hosting compartido).

Luego apunta el panel a esa URL con la variable de entorno del frontend (ver abajo).

## Variables de entorno

### Backend `ssgg` (Railway)

No se requieren variables nuevas para esta función: la decisión de adjuntar `thermalPrint` usa la **configuración del bot** en Mongo (`validateWalletPayment` en `flowOptions`), igual que el flujo de voucher.

Asegúrate de que Railway tenga ya las URLs y CORS habituales del proyecto; el WebSocket del panel sigue siendo el mismo `VITE_SOCKET_BASE_URL` / `wss://`.

### Frontend `panel-admin-ag360ai` (build en GoDaddy o CI)

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `VITE_API_BASE_URL` | Sí | API REST (ej. `https://tu-servicio.up.railway.app/api/v3`). |
| `VITE_SOCKET_BASE_URL` | Sí | Origen de Socket.io sin path (ej. `https://tu-servicio.up.railway.app`). |
| `VITE_PRINT_BRIDGE_WS_URL` | No | Default `ws://127.0.0.1:8080`. Solo cámbiala si el bridge usa otro puerto/host local. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | No* | URL **HTTPS** del `.exe` para el botón en **Configuración → Proveedores**. Si queda vacía, el panel muestra un aviso de configuración. |

\* Obligatoria si quieres que el enlace de descarga sea visible para el cliente.

### PC del cliente (bridge)

| Variable | Descripción |
|----------|-------------|
| `PRINT_BRIDGE_PORT` | Default `8080`. |
| `PRINT_BRIDGE_HOST` | Default `127.0.0.1` (no abrir a la red). |
| `PRINT_BRIDGE_PRINTER_NAME` | Nombre exacto de la impresora en Windows; si se omite, se usa la **impresora predeterminada**. |

Variables del bridge se configuran en Windows con “Variables de entorno” del usuario o un `.cmd` que haga `set` antes de lanzar el `.exe`.

## Comportamiento de impresión según voucher

- **`validateWalletPayment !== false`** (validar voucher): se adjunta `thermalPrint` cuando el estado pasa a **Aceptado**.
- **`validateWalletPayment === false`**: se adjunta `thermalPrint` cuando el estado es **Pre Orden**.

Si no hay `BotConfig` para el subdominio, se asume validar voucher (**solo Aceptado**).

## Código relevante

- Bridge: carpeta `print-bridge/` en la raíz del monorepo.
- Backend: `ssgg/src/modules/order-orchestration/order-orchestration.service.ts`, `ssgg/src/modules/order-orchestration/utils/thermal-print.mapper.ts`.
- Panel: `panel-admin-ag360ai/src/contexts/SocketProvider.tsx`, `panel-admin-ag360ai/src/services/localPrintBridge.ts`, botón en `Operaciones`, enlaces en `Proveedores`.
