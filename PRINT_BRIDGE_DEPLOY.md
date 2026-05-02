# Impresión térmica: despliegue (Railway + GoDaddy)

Flujo: **NestJS (Railway)** emite por Socket.io un evento `order_status_changed` que puede incluir `thermalPrint`. **El panel (GoDaddy / build estático)** reenvía ese JSON al **bridge** en la PC del restaurante (`ws://127.0.0.1:8080`). El bridge imprime por ESC/POS sin diálogo del navegador.

> **Supuesto en producción:** las variables del backend en **Railway** y las **`VITE_*`** del panel ya están definidas y el sistema funciona. Este documento indica **qué necesita cada capa** (referencia para auditoría, nuevos entornos o incorporar a alguien al proyecto). La impresión térmica **no añade variables nuevas obligatorias** en Railway.

---

## 1. PC del cliente (restaurante)

**No usa variables de entorno.** Solo:

1. Ejecutar **`maxy-print-bridge-win.exe`**.
2. Abrir **`http://127.0.0.1:8081`** → elegir impresora → **Guardar**.

| Qué | Dónde se guarda / origen |
|-----|---------------------------|
| Impresora elegida | Archivo **`%APPDATA%\MaxyPrintBridge\config.json`** (escrito por la página del bridge). |
| Puerto WebSocket (panel → bridge) | **8080**, fijo en el código del bridge. |
| Puerto de la página de ajustes | **8081**, fijo en el código del bridge. |

---

## 2. Backend NestJS (`ssgg` en Railway)

### 2.1 Impresión térmica (lógica de negocio)

| Qué | Dónde se define |
|-----|------------------|
| Si el payload lleva `thermalPrint` y en qué estado (Pre Orden vs Aceptado) | **MongoDB**, colección / documento **`BotConfig`** del subdominio, campo efectivo **`flowOptions.validateWalletPayment`** (misma idea que validar voucher). Se edita desde el **panel** (configuración del chatbot / flujo). |
| Variables de entorno **solo** para esta feature | **Ninguna.** Si el API y Socket.io ya funcionan, no hace falta tocar Railway por el bridge. |

### 2.2 Variables de entorno del servicio (referencia)

La lista **canónica** y validada al arrancar está en el repo:

**`ssgg/src/core/config/env.config.ts`** → objeto Joi **`envSchema`**.

Ahí se definen, entre otras, las claves obligatorias y opcionales del proceso (Mongo, JWT, URLs públicas, proveedores de IA, correo, WhatsApp, Google, Azure Storage, etc.). **Railway** → proyecto → servicio → **Variables**: deben cumplir ese esquema para que `ssgg` levante.

Resumen por **bloques** (cada clave concreta está en el archivo citado):

| Bloque | Ejemplos de variables (ver `env.config.ts`) | Para qué sirve en general |
|--------|-----------------------------------------------|---------------------------|
| Servidor | `PORT` | Puerto HTTP del API en el contenedor. |
| Base de datos | `MONGODB`, `DB_NAME` | Persistencia (incluye `BotConfig`, órdenes, etc.). |
| Origen del panel | `FRONTEND_URL` | URL del front (enlaces, integraciones que esperan el dominio del panel). |
| API pública | `RESTAURANT_URL_API` | URL base pública del backend según tu despliegue. |
| Auth | `JWT_SECRET` | Tokens del panel / API. |
| IA / RAG | `AZURE_*`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `PINECONE_*`, `DEEPSEEK_*` | Agentes, embeddings, etc. |
| Correo | `MAIL_USER`, `MAILGUN_*` | Envío de correo. |
| WhatsApp | `WHATSAPP_PROVIDER_URL_BAILEYS`, `WHATSAPP_PROVIDER_URL_META`, números y grupos (`CHATBOT_NUMBER_HM`, `SOPORTE_NUMBER`, `WSP_GROUP_*`, …) | Mensajería. |
| Google | `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_MAPS_API_KEY`, … | Calendar, mapas, etc. |
| Almacenamiento | `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_IMAGES_CONNECTION_STRING` | PDFs / imágenes. |
| Entorno | `ENVIRONMENT`, `POST_DELIVERY`, … | Comportamiento y URLs internas. |

Cualquier variable adicional que Railway inyecte y **no** esté en el schema puede existir si Joi tiene **`.unknown(true)`** (el archivo lo permite); las críticas son las marcadas como **required** en `envSchema`.

---

## 3. Frontend del panel (`panel-admin-ag360ai`)

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
| `VITE_PRINT_BRIDGE_WS_URL` | No | Default **`ws://127.0.0.1:8080`**. | El navegador del cajero habla con el bridge **en esa misma PC**. Solo cámbiala si recompilas el bridge con otro puerto. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | No* | URL **HTTPS** directa al `.exe` (p. ej. asset de un GitHub Release). | Botón en **Configuración → Proveedores**. |

\* Si está vacía, el panel puede mostrar un aviso; el resto del panel sigue funcionando.

**Coherencia:** `VITE_API_BASE_URL` y `VITE_SOCKET_BASE_URL` deben apuntar al **mismo backend** (`ssgg`) que ya tienes en Railway. La impresión no cambia eso.

---

## 4. MongoDB (datos, no env del bridge)

| Dato | Dónde |
|------|--------|
| `validateWalletPayment` efectivo | `BotConfig` por subdominio → `agentsConfig` / `flowOptions` según el agente activo (misma resolución que usa el backend con `AgentConfigUtil`). |

---

## 5. Publicar el `.exe` (GitHub Actions)

El workflow vive en el **repositorio Git del bridge**. Si trabajás en un monorepo local, esa carpeta suele ser `print-bridge/`; en GitHub el repo del bridge tiene esa carpeta como **raíz** del clon.

**Ruta en el repo del bridge:** `.github/workflows/print-bridge-release.yml`

| Paso | Detalle |
|------|---------|
| Repo | Remoto dedicado al bridge (en el clon, la raíz contiene `package.json`, `src/`, `.github/`, etc.). |
| Workflow | **`.github/workflows/print-bridge-release.yml`** |
| Release | Tag que empiece por **`print-bridge-`** (ej. `print-bridge-1.0.0`) y publicar el release. |
| Asset generado | **`maxy-print-bridge-win.exe`** adjunto al release. |
| URL para el panel | `https://github.com/TU_ORG/TU_REPO_PRINT_BRIDGE/releases/download/print-bridge-1.0.0/maxy-print-bridge-win.exe` → copiar a **`VITE_PRINT_BRIDGE_DOWNLOAD_URL`** en el **build** del panel. |
| Prueba sin release | **Actions** → workflow **Print bridge (Windows .exe)** → **Run workflow** → descargar el artifact. |

---

## 6. Comportamiento de impresión según voucher (backend)

- **`validateWalletPayment !== false`**: se envía `thermalPrint` al pasar a **Aceptado**.
- **`validateWalletPayment === false`**: se envía en **Pre Orden**.

Si no hay `BotConfig` para el subdominio, se asume validar voucher (**solo Aceptado**).

---

## 7. Código relevante en el repo

- Bridge: proyecto/repositorio **`print-bridge`** (`src/index.ts`, `src/settings-server.ts`, `src/config-store.ts`; CI en `.github/workflows/print-bridge-release.yml`).
- Validación env backend: `ssgg/src/core/config/env.config.ts`.
- Config panel: `panel-admin-ag360ai/src/config/env.ts`.
- Orquestación + `thermalPrint`: `ssgg/src/modules/order-orchestration/`, `utils/thermal-print.mapper.ts`.
- Panel: `SocketProvider`, `localPrintBridge`, `PrintBridgeContext`, Operaciones, Proveedores.
