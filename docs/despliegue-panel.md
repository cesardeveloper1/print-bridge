# Desplegar y mostrar el descargable en el panel

Guía **paso a paso** para que en producción aparezca el botón **Descargar programa** en **Configuración de la Marca → Impresión en caja**.

> La URL del `.exe` se **incrusta al compilar el panel**. No basta subir el archivo a Azure después: hay que configurar GitHub y redeployar.

## Orden de trabajo (resumen)

```
1. Release en print-bridge  →  genera maxy-print-bridge-win.exe
2. Copiar URL HTTPS del .exe
3. Variables en GitHub (panel-admin-ag360ai → production)
4. Push a main del panel  →  Azure recompila
5. Verificar botón en prod
6. Restaurante: descargar, abrir, elegir impresora, Prender impresión
```

## Checklist

| # | Acción | Listo |
|---|--------|-------|
| 1 | Release `print-bridge-X.Y.Z` con asset `.exe` publicado | ☐ |
| 2 | URL del asset copiada (HTTPS directa al `.exe`) | ☐ |
| 3 | `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en GitHub → environment **production** | ☐ |
| 4 | `VITE_PRINT_BRIDGE_WS_URL` = `ws://127.0.0.1:17880` | ☐ |
| 5 | Código del panel con **Impresión en caja** mergeado en `main` | ☐ |
| 6 | Workflow Azure en verde tras push a `main` | ☐ |
| 7 | Botón de descarga visible en el panel de producción | ☐ |

---

## Parte A — Publicar el ejecutable (repo `print-bridge`)

#### A.1 Subir el código a GitHub

- Repo: **https://github.com/cesardeveloper1/print-bridge**
- La rama **`main`** debe incluir `package.json`, `src/`, `electron/`, `assets/` y `.github/workflows/print-bridge-release.yml`.

#### A.2 Crear un Release

1. **GitHub → print-bridge → Releases → Draft a new release**
2. **Tag:** `print-bridge-1.3.0` (debe empezar por **`print-bridge-`**)
3. **Publish release**
4. **Actions → Print bridge** → esperar ✅
5. En el Release deben aparecer **`maxy-print-bridge-setup.exe`** y **`maxy-print-bridge-win.exe`**

**Prueba sin release:** Actions → Run workflow → artifact `maxy-print-bridge-win-electron`. Solo para probar; el panel necesita un Release con URL pública.

#### A.3 Copiar las URLs

```
# Instalador (recomendado — usar en VITE_PRINT_BRIDGE_DOWNLOAD_URL)
https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.3.0/maxy-print-bridge-setup.exe

# Portable (sin instalación — usar en VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE)
https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.3.0/maxy-print-bridge-win.exe
```

(Cambia la versión por la de tu tag.)

---

## Parte B — Configurar el panel (repo `panel-admin-ag360ai`)

#### B.1 Variables en GitHub (obligatorio)

1. **GitHub → panel-admin-ag360ai → Settings → Environments → production**
2. Agregar **Environment variables**:

| Variable | Valor |
|----------|--------|
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | URL del setup.exe del paso A.3 |
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE` | URL del portable win.exe del paso A.3 (opcional) |
| `VITE_PRINT_BRIDGE_WS_URL` | `ws://127.0.0.1:17880` |

Opcional: repetir en **develop** para staging.

Los workflows de Azure ya pasan estas variables al build (`azure-static-web-apps-calm-flower-*.yml` en `main`).

Referencia completa de todas las variables `VITE_PRINT_BRIDGE_*` del panel: [docs/deploy/panel-env.md](./deploy/panel-env.md).

#### B.2 Código en `main`

El panel debe tener desplegada la sección **Impresión en caja** (`LocalPrintingConfig` en Datos de marca). Si solo está en local, hacer merge y push a **`main`**.

#### B.3 Redesplegar

- **Push a `main`** → Azure Static Web Apps recompila automáticamente.
- Esperar workflow en verde.

#### B.4 Verificar en producción

1. Abrir el panel de **producción** (URL real).
2. **Configuración de la Marca** → **Impresión en caja**.
3. Paso 1: botón morado **Descargar programa**.

**Si aparece aviso amarillo** (“Tu administrador debe publicar el instalador”):

- `VITE_PRINT_BRIDGE_DOWNLOAD_URL` vacía en el build, o
- no se redeployó el panel después de crear la variable.

**Probar descarga:** el clic debe bajar `maxy-print-bridge-win.exe`. La URL debe ser del **asset**, no la página del release.

---

## Parte C — Backend (`ssgg`)

**Sin pasos extra** para el descargable. Railway no necesita variables nuevas por el bridge.

Cuándo imprime (lógica ya en backend):

| Config chatbot | Momento del ticket |
|----------------|-------------------|
| Pide comprobante (habitual) | Al pasar a **Aceptado** |
| No pide comprobante | Al crear (**Pre Orden**) |

Detalle: [docs/deploy/backend.md](./deploy/backend.md).

---

## Parte D — Restaurante (después del deploy)

Ver [Uso en la PC de caja](./uso-caja.md): descargar → abrir `.exe` → `http://127.0.0.1:17881` → **Prender impresión** en Operaciones.

---

## Publicar una nueva versión del bridge

1. Push a **`main`** en print-bridge.
2. Tag nuevo: `print-bridge-1.0.1`, etc.
3. Publish release → nuevo `.exe`.
4. Actualizar **`VITE_PRINT_BRIDGE_DOWNLOAD_URL`** con la URL del nuevo tag.
5. Redesplegar panel (push a `main`).

Referencia técnica del workflow de CI: [docs/deploy/publicar-artefactos.md](./deploy/publicar-artefactos.md).
