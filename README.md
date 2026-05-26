# Maxy Print Bridge

Programa **local para Windows** que imprime tickets térmicos desde el panel web de Agiliza360, **sin que el navegador muestre ventanas de impresión**.

El panel (en internet) avisa al programa (en la misma PC de caja) y este manda el ticket a la impresora.

---

## ¿Para quién es este documento?

| Si eres… | Lee esta sección |
|----------|------------------|
| Dueño o cajero del restaurante | [Uso en la PC de caja](#uso-caja) |
| Quien despliega (exe + panel) | [Desplegar y mostrar el descargable en el panel](#desplegar-panel) |
| Desarrollador del equipo Maxy | [Desarrollo local](#desarrollo-local) |

Documento técnico ampliado (backend + panel + Railway): [`PRINT_BRIDGE_DEPLOY.md`](./PRINT_BRIDGE_DEPLOY.md).

---

<a id="desplegar-panel"></a>

## Desplegar y mostrar el descargable en el panel

Guía **paso a paso** para que en producción aparezca el botón **Descargar programa** en **Configuración de la Marca → Impresión en caja**.

> La URL del `.exe` se **incrusta al compilar el panel**. No basta subir el archivo a Azure después: hay que configurar GitHub y redeployar.

### Orden de trabajo (resumen)

```
1. Release en print-bridge  →  genera maxy-print-bridge-win.exe
2. Copiar URL HTTPS del .exe
3. Variables en GitHub (panel-admin-ag360ai → production)
4. Push a main del panel  →  Azure recompila
5. Verificar botón en prod
6. Restaurante: descargar, abrir, elegir impresora, Prender impresión
```

### Checklist

| # | Acción | Listo |
|---|--------|-------|
| 1 | Release `print-bridge-X.Y.Z` con asset `.exe` publicado | ☐ |
| 2 | URL del asset copiada (HTTPS directa al `.exe`) | ☐ |
| 3 | `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en GitHub → environment **production** | ☐ |
| 4 | `VITE_PRINT_BRIDGE_WS_URL` = `ws://127.0.0.1:8080` | ☐ |
| 5 | Código del panel con **Impresión en caja** mergeado en `main` | ☐ |
| 6 | Workflow Azure en verde tras push a `main` | ☐ |
| 7 | Botón de descarga visible en el panel de producción | ☐ |

---

### Parte A — Publicar el ejecutable (repo `print-bridge`)

#### A.1 Subir el código a GitHub

- Repo: **https://github.com/cesardeveloper1/print-bridge**
- La rama **`main`** debe incluir `package.json`, `src/` y `.github/workflows/print-bridge-release.yml`.

#### A.2 Crear un Release

1. **GitHub → print-bridge → Releases → Draft a new release**
2. **Tag:** `print-bridge-1.0.0` (debe empezar por **`print-bridge-`**)  
3. **Publish release**
4. **Actions → Print bridge (Windows .exe)** → esperar ✅
5. En el Release debe aparecer **`maxy-print-bridge-win.exe`**

**Prueba sin release:** Actions → Run workflow → artifact `maxy-print-bridge-win`. Solo para probar; el panel necesita un Release con URL pública.

#### A.3 Copiar la URL del `.exe`

Formato:

```
https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.0.0/maxy-print-bridge-win.exe
```

(Cambia la versión por la de tu tag.)

---

### Parte B — Configurar el panel (repo `panel-admin-ag360ai`)

#### B.1 Variables en GitHub (obligatorio)

1. **GitHub → panel-admin-ag360ai → Settings → Environments → production**
2. Agregar **Environment variables**:

| Variable | Valor |
|----------|--------|
| `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | URL del paso A.3 |
| `VITE_PRINT_BRIDGE_WS_URL` | `ws://127.0.0.1:8080` |

Opcional: repetir en **develop** para staging.

Los workflows de Azure ya pasan estas variables al build (`azure-static-web-apps-calm-flower-*.yml` en `main`).

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

### Parte C — Backend (`ssgg`)

**Sin pasos extra** para el descargable. Railway no necesita variables nuevas por el bridge.

Cuándo imprime (lógica ya en backend):

| Config chatbot | Momento del ticket |
|----------------|-------------------|
| Pide comprobante (habitual) | Al pasar a **Aceptado** |
| No pide comprobante | Al crear (**Pre Orden**) |

Detalle: [`PRINT_BRIDGE_DEPLOY.md`](./PRINT_BRIDGE_DEPLOY.md).

---

### Parte D — Restaurante (después del deploy)

Ver sección [Uso en la PC de caja](#uso-caja): descargar → abrir `.exe` → `http://127.0.0.1:8081` → **Prender impresión** en Operaciones.

---

### Publicar una nueva versión del bridge

1. Push a **`main`** en print-bridge.
2. Tag nuevo: `print-bridge-1.0.1`, etc.
3. Publish release → nuevo `.exe`.
4. Actualizar **`VITE_PRINT_BRIDGE_DOWNLOAD_URL`** con la URL del nuevo tag.
5. Redesplegar panel (push a `main`).

---

## Cómo funciona (en simple)

```
Pedido en el panel (Operaciones)
        ↓
Backend en la nube (ssgg) avisa por internet
        ↓
El navegador en la PC de caja recibe el aviso
        ↓
El navegador le habla al programa local (Maxy Print Bridge)
        ↓
El programa imprime en la impresora térmica
```

**Importante:** panel y programa en **la misma PC**. No hace falta Node.js ni contraseñas en el local.

| Qué | Valor |
|-----|--------|
| Programa de impresión | `ws://127.0.0.1:8080` (automático) |
| Elegir impresora | `http://127.0.0.1:8081` |
| Config guardada | `%APPDATA%\MaxyPrintBridge\config.json` |

---

<a id="uso-caja"></a>

## Uso en la PC de caja (restaurante)

### Paso 1 — Descargar el programa

Desde el panel (**Configuración de la Marca → Impresión en caja**) o desde [Releases de GitHub](https://github.com/cesardeveloper1/print-bridge/releases).

Guárdalo en Escritorio o Documentos.

### Paso 2 — Abrirlo y dejarlo abierto

1. Doble clic en **`maxy-print-bridge-win.exe`**.
2. Deja la ventana abierta mientras usas el panel.
3. Si SmartScreen avisa: **Más información → Ejecutar de todas formas**.

> Consejo: acceso directo en el escritorio o inicio automático con Windows.

### Paso 3 — Elegir la impresora (primera vez)

1. Misma PC, Chrome o Edge.
2. Abrir **`http://127.0.0.1:8081`**
3. Elegir impresora térmica → **Guardar**.

La impresora debe estar instalada en Windows (USB o red) y encendida.

### Paso 4 — Activar impresión en el panel

1. **Operaciones** (misma PC).
2. **Prender impresión** (activo, en morado).

### Si no imprime

- [ ] ¿`.exe` abierto?
- [ ] ¿Misma PC para panel y programa?
- [ ] ¿**Prender impresión** activo?
- [ ] ¿Impresora elegida en `:8081`?
- [ ] ¿Impresora encendida y con papel?

---

<a id="desarrollo-local"></a>

## Desarrollo local

Requisitos: **Node.js 18+** y **npm**.

```bash
git clone https://github.com/cesardeveloper1/print-bridge.git
cd print-bridge
npm install
npm run dev
```

Compilar y ejecutar:

```bash
npm run build && npm start
```

Generar `.exe` local:

```bash
npm run pkg:win
# → release/maxy-print-bridge-win.exe
```

Probar ping (con [wscat](https://www.npmjs.com/package/wscat)):

```bash
wscat -c ws://127.0.0.1:8080
# {"type":"ping"}  →  {"ok":true,"type":"pong"}
```

Página de impresora: **`http://127.0.0.1:8081`**

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/print-bridge-release.yml`](./.github/workflows/print-bridge-release.yml)

| Evento | Resultado |
|--------|-----------|
| Release con tag `print-bridge-*` | Adjunta `maxy-print-bridge-win.exe` |
| `workflow_dispatch` | Artifact para pruebas |

Build en **`windows-latest`**. No hace falta configurar secretos extra.

---

## Protocolo WebSocket (puerto 8080)

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"thermalPrint":{...}}` → `{"ok":true}` o error

Cola interna: **un ticket a la vez**.

---

## Estructura del proyecto

```
print-bridge/
├── src/
│   ├── index.ts           # WebSocket :8080
│   ├── settings-server.ts # Página :8081
│   ├── config-store.ts
│   ├── format-ticket.ts
│   └── windows-printers.ts
├── .github/workflows/
├── PRINT_BRIDGE_DEPLOY.md
└── PRPs/
```

---

## Preguntas frecuentes

**¿El restaurante necesita API key?**  
No. Descargar, abrir, elegir impresora.

**¿Mac o Linux?**  
No. Solo **Windows**.

**¿El `.exe` lee `.env`?**  
No. Las `VITE_*` van en el **build del panel**, no en la PC del local.

**¿Por qué no veo el botón de descarga en el panel?**  
Falta `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en GitHub → production, o el panel no se redeployó tras configurarla. Ver [Desplegar y mostrar el descargable](#desplegar-panel).

**¿Dónde reporto problemas?**  
Issues en GitHub o soporte Maxy (versión del `.exe`, impresora, estado de **Prender impresión**).
