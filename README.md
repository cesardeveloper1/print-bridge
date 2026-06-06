# Maxy Print Bridge

Programa **local para Windows** que imprime tickets térmicos desde el panel web de Agiliza360, **sin que el navegador muestre ventanas de impresión**.

El panel (en internet) avisa al programa (en la misma PC de caja) y este manda el ticket a la impresora.

> **v1.3 — bandeja del sistema:** el programa ya no abre ventana de consola. Busque el icono **Maxy Print Bridge** en la bandeja del sistema (flecha ↑ junto al reloj). macOS y Linux siguen con binario de consola hasta v2.x.

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
| 4 | `VITE_PRINT_BRIDGE_WS_URL` = `ws://127.0.0.1:17880` | ☐ |
| 5 | Código del panel con **Impresión en caja** mergeado en `main` | ☐ |
| 6 | Workflow Azure en verde tras push a `main` | ☐ |
| 7 | Botón de descarga visible en el panel de producción | ☐ |

---

### Parte A — Publicar el ejecutable (repo `print-bridge`)

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

### Parte B — Configurar el panel (repo `panel-admin-ag360ai`)

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

Ver sección [Uso en la PC de caja](#uso-caja): descargar → abrir `.exe` → `http://127.0.0.1:17881` → **Prender impresión** en Operaciones.

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
| Programa de impresión | `ws://127.0.0.1:17880` (automático) |
| Elegir impresora | `http://127.0.0.1:17881` |
| Config guardada | `%APPDATA%\MaxyPrintBridge\config.json` |

---

<a id="uso-caja"></a>

## Uso en la PC de caja (restaurante)

### Paso 1 — Descargar el programa

Desde el panel (**Configuración de la Marca → Impresión en caja**) o desde [Releases de GitHub](https://github.com/cesardeveloper1/print-bridge/releases).

Hay dos versiones para Windows:
- **Instalador** (`maxy-print-bridge-setup.exe`) — recomendado; crea acceso directo y entrada en "Agregar o quitar programas".
- **Portable** (`maxy-print-bridge-win.exe`) — sin instalación; ejecutar directamente desde Escritorio.

### Paso 2 — Instalar o ejecutar

**Instalador:** ejecutar setup y seguir el asistente.  
**Portable:** doble clic en el `.exe`.

Si SmartScreen avisa: **Más información → Ejecutar de todas formas**.

### Paso 3 — Buscar el icono en la bandeja del sistema

El programa **no abre ventana de consola** — corre en segundo plano.

Busque el icono **Maxy Print Bridge** en la bandeja del sistema (flecha **↑** junto al reloj, abajo a la derecha). Si no aparece, actívelo desde el área de notificaciones.

- **Clic izquierdo** en el icono → abre la configuración de impresora en el navegador.
- **Clic derecho** → menú: configuración, ticket de prueba, logs, soporte, autoarranque, salir.

> El programa debe permanecer activo en la bandeja mientras usa el panel. No use "Salir" del menú durante el turno.

### Paso 4 — Elegir la impresora (primera vez)

1. Clic en el icono de la bandeja (o abrir `http://127.0.0.1:17881`).
2. Elegir impresora térmica → **Guardar**.

La impresora debe estar instalada en Windows (USB o red) y encendida.

### Paso 5 — Activar impresión en el panel

1. **Operaciones** (misma PC).
2. **Prender impresión** (activo, en morado).

### Si no imprime

- [ ] ¿Icono de **Maxy Print Bridge** visible en la bandeja del sistema (↑ junto al reloj)?
- [ ] ¿Misma PC para panel y programa?
- [ ] ¿**Prender impresión** activo?
- [ ] ¿Impresora configurada? (clic en el icono de la bandeja)
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

Modo Electron (Windows — sin consola, con bandeja del sistema):

```bash
npm run icons            # genera iconos placeholder en assets/ (solo primera vez)
npm run electron:dev     # compila + abre Electron en modo desarrollo
```

Generar binarios para distribución:

```bash
# Windows — Electron (v1.3+)
npm run dist:win         # setup.exe + portable → release/
npm run dist:win:setup   # solo setup NSIS
npm run dist:win:portable # solo portable

# macOS / Linux — pkg (legacy hasta v2.x)
npm run pkg:mac-x64      # → release/maxy-print-bridge-mac-x64
npm run pkg:mac-arm64    # → release/maxy-print-bridge-mac-arm64
npm run pkg:linux-x64    # → release/maxy-print-bridge-linux-x64
```

> **Windows y bandeja del sistema:** a partir de v1.3 el instalador y el portable son Electron (sin consola). `pkg:win` queda como script de emergencia bajo el nombre `pkg:win:legacy`.

**Nombre en terminal:** el proceso usa `process.title = "Maxy Print Bridge"` (pestaña de Terminal, Activity Monitor, etc.). No se usa firma de código ni metadatos PE en el `.exe`. Para no agrupar bajo “Terminal” en Windows 11, use **Host de consola de Windows** como terminal predeterminada (Configuración → Para desarrolladores → Terminal).

**Mac / Linux:** al salir con error o si ya hay otra instancia, la terminal pide **Enter** antes de cerrar (igual que Windows). Deje la ventana abierta mientras use el panel.

Probar ping (con [wscat](https://www.npmjs.com/package/wscat)):

```bash
wscat -c ws://127.0.0.1:17880
# {"type":"ping"}  →  {"ok":true,"type":"pong"}
```

Página de impresora: **`http://127.0.0.1:17881`**

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/print-bridge-release.yml`](./.github/workflows/print-bridge-release.yml)

| Plataforma | Build | Evento release → adjunta |
|------------|-------|--------------------------|
| Windows | `electron-builder` (Electron) | `maxy-print-bridge-setup.exe` + `maxy-print-bridge-win.exe` |
| macOS Intel | `pkg` | `maxy-print-bridge-mac-x64` |
| macOS ARM | `pkg` | `maxy-print-bridge-mac-arm64` |
| Linux x64 | `pkg` | `maxy-print-bridge-linux-x64` |

`workflow_dispatch` → artifacts descargables sin publicar release. No hace falta configurar secretos extra.

---

## Protocolo WebSocket (puerto 17880)

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"thermalPrint":{...}}` → `{"ok":true}` o error

Cola interna: **un ticket a la vez**.

---

## Estructura del proyecto

```
print-bridge/
├── src/
│   ├── index.ts           # WebSocket :17880
│   ├── settings-server.ts # Página :17881
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
Impresión térmica sí. Bandeja del sistema solo **Windows** en v1.3 (macOS/Linux siguen con terminal hasta v2.x).

**¿El `.exe` lee `.env`?**  
No. Las `VITE_*` van en el **build del panel**, no en la PC del local.

**¿Error «No se encontró send-raw-print.ps1» al imprimir?**  
Versiones antiguas del `.exe` no extraían el script de impresión al disco. Desde la corrección en `send-raw-print-script.ts`, al abrir el programa se copia a `%TEMP%\MaxyPrintBridge\send-raw-print.ps1`. Publique un release nuevo (`npm run pkg:win`) y reinstale el `.exe`.

**¿Por qué no veo el botón de descarga en el panel?**  
Falta `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en GitHub → production, o el panel no se redeployó tras configurarla. Ver [Desplegar y mostrar el descargable](#desplegar-panel).

**¿Dónde reporto problemas?**  
Issues en GitHub o soporte Maxy (versión del `.exe`, impresora, estado de **Prender impresión**).
