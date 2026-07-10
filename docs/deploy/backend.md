# Backend NestJS (`ssgg` en Railway)

## Impresión térmica (lógica de negocio)

| Qué | Dónde se define |
|-----|------------------|
| Si el payload lleva `thermalPrint` y en qué estado (Pre Orden vs Aceptado) | **MongoDB**, colección / documento **`BotConfig`** del subdominio, campo efectivo **`flowOptions.validateWalletPayment`** (misma idea que validar voucher). Se edita desde el **panel** (configuración del chatbot / flujo). |
| Variables de entorno **solo** para esta feature | **Ninguna.** Si el API y Socket.io ya funcionan, no hace falta tocar Railway por el bridge. |

## Variables de entorno del servicio (referencia)

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

## MongoDB (datos, no env del bridge)

| Dato | Dónde |
|------|--------|
| `validateWalletPayment` efectivo | `BotConfig` por subdominio → `agentsConfig` / `flowOptions` según el agente activo (misma resolución que usa el backend con `AgentConfigUtil`). |

## Comportamiento de impresión según voucher

- **`validateWalletPayment !== false`**: se envía `thermalPrint` al pasar a **Aceptado**.
- **`validateWalletPayment === false`**: se envía en **Pre Orden**.

Si no hay `BotConfig` para el subdominio, se asume validar voucher (**solo Aceptado**).
