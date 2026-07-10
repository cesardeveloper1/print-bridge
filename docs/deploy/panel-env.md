# Frontend del panel (`panel-admin-ag360ai`)

Las variables deben existir en el momento del **`npm run build`** (archivo **`.env` / `.env.production`**, o secretos del CI que exporten `VITE_*` antes del build). **GoDaddy** (u otro hosting estático) suele recibir solo la carpeta **`dist`**; no “inyecta” `VITE_*` después.

**Origen en código:** `panel-admin-ag360ai/src/config/env.ts` (cada clave se lee con `import.meta.env.VITE_…`).

| Variable | Obligatoria para el panel en prod | Valor / de dónde sale | Uso |
|----------|-------------------------------------|------------------------|-----|
| `VITE_ENVIRONMENT` | No | Default `production` en código si falta. | Entorno lógico del build. |
| `VITE_API_BASE_URL` | Sí | URL del API **con** sufijo `/api/v3` (ej. tu Railway + `/api/v3`). Debe coincidir con el backend desplegado. | Todas las llamadas REST. |
| `VITE_SOCKET_BASE_URL` | Sí | Origen **HTTPS** del mismo host que sirve Socket.io **sin** path (ej. `https://tu-servicio.up.railway.app`). | Conexión a `/orders`, `/events`, etc. |
| `VITE_WHATSAPP_META` | No | Default en código si no se define. | Dominio Meta / WhatsApp Cloud según tu despliegue. |
| `VITE_META_APP_ID` | No | Default en código. | Login Meta. |
| `VITE_META_CONFIG_ID` | No | Default en código. | Configuración Meta. |
| `VITE_META_API_VERSION` | No | Default en código. | Versión Graph API. |
| `VITE_META_REDIRECT_URI` | No | Default en código. | Callback OAuth Meta. |
| `VITE_WHATSAPP_URL_WS` | No | Default en código (servicio Baileys u otro). | WebSocket / URL del proveedor WhatsApp según arquitectura. |
| `VITE_BILLING_API_URL` | No | Default en código. | API de facturación / billing. |
| `VITE_GOOGLE_MAPS_API_KEY` | No | Vacío si no hay mapas. | Mapa de órdenes (clave restringida por dominio en Google Cloud). |
| `VITE_PRINT_BRIDGE_WS_URL` | No | Default **`ws://127.0.0.1:17880`**. | El navegador del cajero habla con el bridge **en esa misma PC**. Solo cámbiala si recompilas el bridge con otro puerto. |
| `VITE_PRINT_BRIDGE_TOKEN` | **Sí** (producción y `develop` si se prueba impresión ahí) | Debe coincidir **byte a byte** con `PRINT_BRIDGE_SHARED_TOKEN` en `print-bridge/src/bridge-token.ts`. | El bridge (desde `PRPs/007--ws-origin-and-token-hardening.md`) rechaza `print` y `POST /api/config` sin este token. Si falta o no coincide, la impresión deja de funcionar con error "No autorizado". |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | No* | URL **HTTPS** al `maxy-print-bridge-setup.exe` (instalador recomendado). | Botón primario Windows en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE` | No* | URL **HTTPS** al `maxy-print-bridge-win.exe` (portable). Si está vacía, no se muestra enlace secundario. | Enlace "Versión portable" en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_MAC_X64` | No* | URL **HTTPS** al `.dmg` macOS Intel (`maxy-print-bridge-mac-x64.dmg`). | Botón Mac Intel en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_MAC_ARM` | No* | URL **HTTPS** al `.dmg` macOS Apple Silicon (`maxy-print-bridge-mac-arm64.dmg`). | Botón Mac ARM en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_LINUX` | No* | URL **HTTPS** al `.AppImage` Linux x64. | Botón Linux en **Configuración → Impresión**. |

\* Si está vacía, el panel puede mostrar un aviso; el resto del panel sigue funcionando.

**macOS:** el `.dmg` no está firmado ni notarizado por Apple, así que al abrirlo por primera vez Gatekeeper muestra "está dañado y no se puede abrir" salvo que el usuario corra `xattr -cr` sobre la app — ver [pc-cliente.md#macos](./pc-cliente.md#macos). Si en algún momento se agrega firma/notarización, esta nota debe borrarse.

**Coherencia:** `VITE_API_BASE_URL` y `VITE_SOCKET_BASE_URL` deben apuntar al **mismo backend** (`ssgg`) que ya tienes en Railway. La impresión no cambia eso.

Guía paso a paso para configurar estas variables la primera vez: [Desplegar y mostrar el descargable en el panel](../despliegue-panel.md).
