# Maxy Print Bridge

Programa **local para Windows** que imprime tickets térmicos desde el panel web de Agiliza360, **sin que el navegador muestre ventanas de impresión**.

El panel (en internet) avisa al programa (en la misma PC de caja) y este manda el ticket a la impresora.

---

## ¿Para quién es este documento?

| Si eres… | Lee esta sección |
|----------|------------------|
| Dueño o cajero del restaurante | [Uso en la PC de caja](#uso-en-la-pc-de-caja-restaurante) |
| Desarrollador del equipo Maxy | [Desarrollo local](#desarrollo-local) y [Publicar el ejecutable](#publicar-el-ejecutable-en-producción) |
| Quien configura el panel en Azure | [Conectar el panel con el bridge](#paso-3--conectar-el-panel-con-el-bridge) |

Documento técnico ampliado del ecosistema completo (backend + panel): [`PRINT_BRIDGE_DEPLOY.md`](./PRINT_BRIDGE_DEPLOY.md).

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

**Importante:** el panel y el programa deben estar en **la misma computadora** (la de caja). No hace falta instalar Node.js ni escribir contraseñas: solo descargar el `.exe`, abrirlo y elegir la impresora.

| Qué | Valor |
|-----|--------|
| Programa de impresión (WebSocket) | `ws://127.0.0.1:8080` (automático, no se configura) |
| Página para elegir impresora | `http://127.0.0.1:8081` |
| Dónde se guarda la impresora elegida | `%APPDATA%\MaxyPrintBridge\config.json` |

---

## Uso en la PC de caja (restaurante)

### Paso 1 — Descargar el programa

Descarga **`maxy-print-bridge-win.exe`** desde el enlace que aparece en el panel (**Configuración de la Marca → Impresión en caja**) o desde el [Release de GitHub](https://github.com/cesardeveloper1/print-bridge/releases).

Guárdalo en una carpeta fácil de encontrar (por ejemplo `Escritorio` o `Documentos`).

### Paso 2 — Abrirlo y dejarlo abierto

1. Haz doble clic en **`maxy-print-bridge-win.exe`**.
2. Puede abrirse una ventana negra (consola): **déjala abierta** mientras trabajas en el panel.
3. Si Windows SmartScreen pregunta, elige **Más información → Ejecutar de todas formas** (el archivo viene del release oficial del equipo).

> Consejo: crea un acceso directo en el escritorio o configura que se abra al encender la PC.

### Paso 3 — Elegir la impresora (solo la primera vez)

1. Abre el navegador (Chrome o Edge) en **la misma PC**.
2. Escribe en la barra de direcciones: **`http://127.0.0.1:8081`**
3. Elige tu impresora térmica en la lista.
4. Pulsa **Guardar**.
5. Puedes cerrar esa pestaña; el programa sigue corriendo en segundo plano.

La impresora debe estar **instalada en Windows** (USB o red) y encendida.

### Paso 4 — Activar impresión en el panel

1. Entra al panel en **Operaciones** (misma PC).
2. Arriba, pulsa **Prender impresión** (debe verse en morado / activo).
3. Cuando llegue un pedido al estado correcto, el ticket debería salir solo.

### ¿Cuándo imprime un pedido?

| Configuración del chatbot | Momento del ticket |
|---------------------------|-------------------|
| Pide comprobante de pago (lo habitual) | Cuando el pedido pasa a **Aceptado** |
| No pide comprobante | Cuando llega el pedido (**Pre Orden**) |

Si un operador mueve el pedido a **Aceptado** manualmente, **también imprime** (con la configuración habitual de comprobante).

### Si no imprime — checklist rápido

- [ ] ¿Está abierto `maxy-print-bridge-win.exe`?
- [ ] ¿Panel y programa en **la misma PC**?
- [ ] ¿En Operaciones dice **Prender impresión** (activo)?
- [ ] ¿Elegiste impresora en `http://127.0.0.1:8081`?
- [ ] ¿La impresora está encendida y con papel?

---

## Desarrollo local

Requisitos: **Node.js 18+** y **npm**.

```bash
# 1. Clonar el repo
git clone https://github.com/cesardeveloper1/print-bridge.git
cd print-bridge

# 2. Instalar dependencias
npm install

# 3. Modo desarrollo (recarga al editar código)
npm run dev
```

En otra terminal, compilar y ejecutar la versión compilada:

```bash
npm run build
npm start
```

Probar que responde (con el bridge corriendo):

```bash
# Ping (requiere wscat: npm i -g wscat)
wscat -c ws://127.0.0.1:8080
# Escribir: {"type":"ping"}
# Debe responder: {"ok":true,"type":"pong"}
```

Abrir **`http://127.0.0.1:8081`** para probar la página de impresora.

---

## Generar el `.exe` en tu PC (Windows)

Útil para probar antes de publicar un release.

```bash
npm install
npm run pkg:win
```

Salida: **`release/maxy-print-bridge-win.exe`**

Ese archivo es el que se distribuye a los restaurantes. No hace falta copiar `node_modules` ni instalar Node en la PC del cliente.

---

## Publicar el ejecutable en producción

Esta sección es para el **equipo de desarrollo**. Resume qué hacer para que cualquier restaurante pueda descargar el programa desde el panel.

### Vista general

```
1. Subir código a GitHub (repo print-bridge)
2. Crear un Release → GitHub Actions genera el .exe
3. Copiar la URL del .exe al panel (variable VITE_PRINT_BRIDGE_DOWNLOAD_URL)
4. Redesplegar el panel
5. El restaurante descarga desde el panel y sigue los pasos de caja
```

No se necesitan variables de entorno **en este repo** para producción. El `.exe` no lee archivos `.env`.

---

### Paso 1 — Preparar el repositorio en GitHub

1. El código debe estar en el repo remoto:  
   **https://github.com/cesardeveloper1/print-bridge**
2. La rama **`main`** debe incluir:
   - `package.json` con el script `pkg:win`
   - `.github/workflows/print-bridge-release.yml` (genera el `.exe` automáticamente)

No hace falta configurar secretos extra para el workflow: usa el token de GitHub del propio Actions.

---

### Paso 2 — Crear un Release (genera el `.exe` automáticamente)

**Opción A — Release oficial (recomendada para producción)**

1. Entra a **GitHub → print-bridge → Releases → Draft a new release**.
2. **Choose a tag:** crea uno nuevo, por ejemplo **`print-bridge-1.0.0`**.  
   ⚠️ El tag **debe empezar por `print-bridge-`** o el workflow no adjuntará el archivo.
3. **Release title:** por ejemplo `Print bridge 1.0.0`.
4. Publica el release (**Publish release**).
5. Ve a **Actions → Print bridge (Windows .exe)** y espera a que termine en verde.
6. Vuelve al Release: debe aparecer el asset **`maxy-print-bridge-win.exe`**.

**Opción B — Prueba rápida sin release**

1. **GitHub → Actions → Print bridge (Windows .exe) → Run workflow**.
2. Al terminar, descarga el artifact **`maxy-print-bridge-win`**.
3. Sirve para probar; **no** es la URL que usará el panel en producción hasta que publiques un Release.

---

### Paso 3 — Conectar el panel con el bridge

El panel (`panel-admin-ag360ai`) necesita la **URL pública HTTPS** del `.exe` en el momento del **build** (no después).

1. Copia la URL directa del asset del Release. Formato:

   ```
   https://github.com/cesardeveloper1/print-bridge/releases/download/print-bridge-1.0.0/maxy-print-bridge-win.exe
   ```

   (Cambia la versión del tag según tu release.)

2. En **GitHub → panel-admin-ag360ai → Settings → Environments → production** (y `develop` si aplica), agrega:

   | Variable | Valor |
   |----------|--------|
   | `VITE_PRINT_BRIDGE_DOWNLOAD_URL` | URL del `.exe` del paso anterior |
   | `VITE_PRINT_BRIDGE_WS_URL` | `ws://127.0.0.1:8080` (casi siempre este valor) |

3. Haz **push a `main`** (o redeploy) para que Azure Static Web Apps recompile el panel con esas variables.

4. En el panel desplegado, la sección **Configuración de la Marca → Impresión en caja** mostrará el botón de descarga (PRP panel 039).

Si `VITE_PRINT_BRIDGE_DOWNLOAD_URL` está vacía, el panel funciona igual pero **no muestra** el enlace de descarga.

---

### Paso 4 — Backend (ssgg) — sin cambios obligatorios

El backend en Railway **no necesita variables nuevas** por el bridge.

Solo define **cuándo** se envía el ticket:

- Configuración del chatbot → `validateWalletPayment` en `BotConfig` (MongoDB).
- Por defecto: imprime al pasar a **Aceptado**.

Detalle: [`PRINT_BRIDGE_DEPLOY.md`](./PRINT_BRIDGE_DEPLOY.md) y `ssgg/PRPs/056--impresion-termica-socket-payload.md`.

---

### Paso 5 — Poner en marcha en el restaurante

Comparte con el local la guía [Uso en la PC de caja](#uso-en-la-pc-de-caja-restaurante) o pídeles:

1. Descargar el `.exe` desde el panel.
2. Abrirlo y dejarlo corriendo.
3. Configurar impresora en `http://127.0.0.1:8081`.
4. **Prender impresión** en Operaciones.

---

### Paso 6 — Verificar que todo funciona (QA)

**En la PC de caja:**

1. Bridge abierto + impresora configurada + **Prender impresión** activo.
2. Crear o mover un pedido de prueba al estado que dispara impresión (**Aceptado** en el flujo habitual).
3. Debe salir el ticket sin diálogo del navegador.

**Si falla la conexión al bridge:**

- El panel muestra error del tipo *“No se pudo conectar al bridge”* → el `.exe` no está corriendo o el firewall bloquea `127.0.0.1:8080`.

**Si conecta pero no imprime:**

- Revisar impresora en `:8081`, papel, driver Windows.

---

## Publicar una nueva versión del bridge

Cuando corrijas bugs o agregues funciones:

1. Sube los cambios a **`main`**.
2. Crea un tag nuevo: **`print-bridge-1.0.1`**, **`print-bridge-1.1.0`**, etc.
3. Publica el Release → GitHub Actions genera el nuevo `.exe`.
4. Actualiza **`VITE_PRINT_BRIDGE_DOWNLOAD_URL`** en el panel con la URL del nuevo tag.
5. Redespliega el panel.

Los restaurantes que ya tienen el `.exe` antiguo pueden seguir usándolo hasta que descarguen la versión nueva desde el panel.

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/print-bridge-release.yml`](./.github/workflows/print-bridge-release.yml)

| Evento | Resultado |
|--------|-----------|
| Release publicado con tag `print-bridge-*` | Adjunta `maxy-print-bridge-win.exe` al release |
| `workflow_dispatch` (manual) | Sube artifact descargable (pruebas) |

El build corre en **`windows-latest`** porque el `.exe` debe compilarse en Windows.

---

## Protocolo WebSocket (puerto 8080)

Para integradores / pruebas técnicas:

- **Ping:** `{"type":"ping"}` → `{"ok":true,"type":"pong"}`
- **Imprimir:** `{"type":"print","version":1,"thermalPrint":{...}}` → `{"ok":true}` o `{"ok":false,"error":"..."}`

La cola interna procesa **un ticket a la vez**.

---

## Estructura del proyecto

```
print-bridge/
├── src/
│   ├── index.ts           # WebSocket :8080
│   ├── settings-server.ts # Página :8081
│   ├── config-store.ts    # Guarda impresora en %APPDATA%
│   ├── format-ticket.ts   # JSON → ESC/POS
│   └── windows-printers.ts
├── .github/workflows/     # CI que genera el .exe
├── release/               # .exe local (no commitear)
├── PRINT_BRIDGE_DEPLOY.md # Despliegue backend + panel
└── PRPs/                  # Especificaciones de producto
```

---

## Preguntas frecuentes

**¿El restaurante necesita un código o API key?**  
No. Solo descargar, abrir el programa y elegir impresora.

**¿Funciona en Mac o Linux?**  
No. Solo **Windows** (impresoras térmicas vía drivers de Windows).

**¿Puedo cambiar el puerto 8080?**  
Sí en código (`src/index.ts`), pero entonces hay que recompilar el panel con otro `VITE_PRINT_BRIDGE_WS_URL`. En producción se deja **8080**.

**¿El `.env` o `.env.example` los usa el `.exe`?**  
No. Esos archivos son documentación para el equipo; las variables `VITE_*` van en el **build del panel**, no en la PC del local.

**¿Dónde reporto problemas?**  
Issues en el repo de GitHub o al equipo de soporte Maxy con: versión del `.exe`, marca de impresora, y si el panel muestra “Prender impresión” activo.
