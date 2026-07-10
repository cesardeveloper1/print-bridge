# Impresión térmica: despliegue (Railway + GoDaddy)

Flujo: **NestJS (Railway)** emite por Socket.io un evento `order_status_changed` que puede incluir `thermalPrint`. **El panel (GoDaddy / build estático)** reenvía ese JSON al **bridge** en la PC del restaurante (`ws://127.0.0.1:17880`). El bridge imprime por ESC/POS sin diálogo del navegador.

> **Supuesto en producción:** las variables del backend en **Railway** y las **`VITE_*`** del panel ya están definidas y el sistema funciona. Esta sección indica **qué necesita cada capa** (referencia para auditoría, nuevos entornos o incorporar a alguien al proyecto). La impresión térmica **no añade variables nuevas obligatorias** en Railway.

## Documentos

| Documento | Contenido |
|-----------|-----------|
| [pc-cliente.md](./pc-cliente.md) | Setup en la PC del restaurante: Windows, macOS, Linux — sin variables de entorno |
| [backend.md](./backend.md) | Variables de entorno de `ssgg` (Railway), lógica de `BotConfig`/`flowOptions` y comportamiento de impresión según voucher |
| [panel-env.md](./panel-env.md) | Todas las variables `VITE_*` del panel (`panel-admin-ag360ai`), cuáles son obligatorias |
| [publicar-artefactos.md](./publicar-artefactos.md) | Workflow de GitHub Actions que genera los `.exe` de Windows y cómo publicarlos |

Guía operativa paso a paso (no solo referencia): [../despliegue-panel.md](../despliegue-panel.md).

## Código relevante en el repo

- Bridge: proyecto/repositorio **`print-bridge`** (`src/index.ts`, `src/settings-server.ts`, `src/config-store.ts`; CI en `.github/workflows/print-bridge-release.yml`).
- Validación env backend: `ssgg/src/core/config/env.config.ts`.
- Config panel: `panel-admin-ag360ai/src/config/env.ts`.
- Orquestación + `thermalPrint`: `ssgg/src/modules/order-orchestration/`, `utils/thermal-print.mapper.ts`.
- Panel: `SocketProvider`, `localPrintBridge`, `PrintBridgeContext`, Operaciones, Proveedores.
