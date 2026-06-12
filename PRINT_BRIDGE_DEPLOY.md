# Impresión térmica: despliegue (Railway + GoDaddy)

Flujo: **NestJS (Railway)** emite por Socket.io un evento `order_status_changed` que puede incluir `thermalPrint`. **El panel (GoDaddy / build estático)** reenvía ese JSON al **bridge** en la PC del restaurante (`ws://127.0.0.1:17880`). El bridge imprime por ESC/POS sin diálogo del navegador.

> **Supuesto en producción:** las variables del backend en **Railway** y las **`VITE_*`** del panel ya están definidas y el sistema funciona. Este documento indica **qué necesita cada capa** (referencia para auditoría, nuevos entornos o incorporar a alguien al proyecto). La impresión térmica **no añade variables nuevas obligatorias** en Railway.

---

## 1. PC del cliente (restaurante)

**No usa variables de entorno.**

### Windows (v1.3+)

El programa corre en **segundo plano con icono en la bandeja del sistema** (↑ junto al reloj). No abre ventana de consola.

Hay dos artefactos de distribución:

| Artefacto | Uso recomendado |
|-----------|-----------------|
| `maxy-print-bridge-setup.exe` | Instalador NSIS — recomendado para restaurantes; crea acceso directo y entrada en "Agregar o quitar programas". |
| `maxy-print-bridge-win.exe` | Portable — sin instalación; ejecutar directamente. |

1. Descargar e instalar (o ejecutar el portable).
2. Si SmartScreen avisa: **Más información → Ejecutar de todas formas**.
3. Buscar el icono **Maxy Print Bridge** en la bandeja del sistema.
4. Clic en el icono → abrir configuración → elegir impresora → **Guardar**.

### macOS

1. Descargar el binario correspondiente desde GitHub Releases:
   - **Intel (x64):** `maxy-print-bridge-mac-x64`
   - **Apple Silicon (arm64):** `maxy-print-bridge-mac-arm64`
   
   Si no sabes cuál tienes: menú Apple → Acerca de esta Mac → Procesador. Si dice "Intel" usa x64; si dice "M1", "M2", etc. usa arm64.

2. Quitar la cuarentena de Gatekeeper y ejecutar:
   ```bash
   xattr -d com.apple.quarantine ./maxy-print-bridge-mac-arm64   # o mac-x64
   chmod +x ./maxy-print-bridge-mac-arm64
   ./maxy-print-bridge-mac-arm64
   ```
   
   Alternativa sin terminal: **click derecho → Abrir** en Finder la primera vez.

3. Abrir **`http://127.0.0.1:17881`** → elegir impresora → **Guardar**.

Si la impresora no aparece, verificar CUPS:
```bash
lpstat -a   # lista impresoras CUPS
lpstat -d   # impresora por defecto
```

### Linux (Ubuntu / Debian)

Requisito previo: CUPS instalado.

```bash
sudo apt-get update && sudo apt-get install -y cups
sudo systemctl enable cups && sudo systemctl start cups
```

1. Descargar **`maxy-print-bridge-linux-x64`** desde GitHub Releases.
2. Dar permiso de ejecución y lanzar:
   ```bash
   chmod +x ./maxy-print-bridge-linux-x64
   ./maxy-print-bridge-linux-x64
   ```
3. Abrir **`http://127.0.0.1:17881`** → elegir impresora → **Guardar**.

Si la impresora no aparece en la lista, verificar que CUPS la detecta:
```bash
lpstat -a   # lista impresoras CUPS
lpstat -d   # impresora por defecto
```

La impresión envía el ticket con **`lp -d NOMBRE -o raw`** (bytes ESC/POS). El nombre en la UI debe coincidir con el de `lpstat -a`.

| Qué | Dónde se guarda / origen |
|-----|---------------------------|
| Impresora elegida | **`~/.maxy-print-bridge/config.json`** (Linux/macOS) o **`%APPDATA%\MaxyPrintBridge\config.json`** (Windows). |
| Puerto WebSocket (panel → bridge) | **17880**, fijo en `src/ports.ts`. |
| Puerto de la página de ajustes | **17881**, fijo en `src/ports.ts`. |

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
| `VITE_PRINT_BRIDGE_WS_URL` | No | Default **`ws://127.0.0.1:17880`**. | El navegador del cajero habla con el bridge **en esa misma PC**. Solo cámbiala si recompilas el bridge con otro puerto. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | No* | URL **HTTPS** al `maxy-print-bridge-setup.exe` (instalador recomendado). | Botón primario Windows en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE` | No* | URL **HTTPS** al `maxy-print-bridge-win.exe` (portable). Si está vacía, no se muestra enlace secundario. | Enlace "Versión portable" en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_MAC_X64` | No* | URL **HTTPS** al binario macOS Intel. | Botón Mac Intel en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_MAC_ARM` | No* | URL **HTTPS** al binario macOS Apple Silicon. | Botón Mac ARM en **Configuración → Impresión**. |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_LINUX` | No* | URL **HTTPS** al binario Linux x64. | Botón Linux en **Configuración → Impresión**. |

\* Si está vacía, el panel puede mostrar un aviso; el resto del panel sigue funcionando.

**Coherencia:** `VITE_API_BASE_URL` y `VITE_SOCKET_BASE_URL` deben apuntar al **mismo backend** (`ssgg`) que ya tienes en Railway. La impresión no cambia eso.

---

## 4. MongoDB (datos, no env del bridge)

| Dato | Dónde |
|------|--------|
| `validateWalletPayment` efectivo | `BotConfig` por subdominio → `agentsConfig` / `flowOptions` según el agente activo (misma resolución que usa el backend con `AgentConfigUtil`). |

---

## 5. Publicar los artefactos Windows (GitHub Actions)

El workflow vive en el **repositorio Git del bridge**. Si trabajás en un monorepo local, esa carpeta suele ser `print-bridge/`; en GitHub el repo del bridge tiene esa carpeta como **raíz** del clon.

**Ruta en el repo del bridge:** `.github/workflows/print-bridge-release.yml`

| Paso | Detalle |
|------|---------|
| Repo | Remoto dedicado al bridge (raíz contiene `package.json`, `src/`, `electron/`, `assets/`, `.github/`, etc.). |
| Workflow | **`.github/workflows/print-bridge-release.yml`** |
| Release | Tag que empiece por **`print-bridge-`** (ej. `print-bridge-1.3.0`) y publicar el release. |
| Assets generados | **`maxy-print-bridge-setup.exe`** (instalador) y **`maxy-print-bridge-win.exe`** (portable) adjuntos al release. |
| URLs para el panel | Instalador → **`VITE_PRINT_BRIDGE_DOWNLOAD_URL`**; portable → **`VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE`**. Actualizar en GitHub Environment **production** del panel y redesplegar. |
| Prueba sin release | **Actions** → **Run workflow** → artifact `maxy-print-bridge-win-electron`. |

Si `git pull --tags origin main` rechaza un tag con *would clobber existing tag*, borra el tag local (`git tag -d print-bridge-X.Y.Z`) y vuelve a hacer pull. Detalle en [`README.md` — Conflicto de tags al hacer pull](./README.md#conflicto-de-tags-al-hacer-pull).

**Orden de despliegue:**
```
1. Merge + release print-bridge (setup + portable en GitHub Releases)
2. Actualizar VITE_PRINT_BRIDGE_DOWNLOAD_URL y VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE en GitHub Environment production del panel
3. Merge panel PRP 083 + push main → Azure rebuild
4. Verificar botón descarga + badge conectado en prod
```

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
