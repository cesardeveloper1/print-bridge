# PC del cliente (restaurante)

**No usa variables de entorno.**

## Windows (v1.3+)

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

Guía orientada al restaurante (menos técnica): [docs/uso-caja.md](../uso-caja.md).

## macOS

> **La app no está firmada ni notarizada por Apple** (decisión de costo: requeriría Apple Developer Program, US$99/año). Por eso Gatekeeper la bloquea al descargarla — ver [nota sobre "archivo dañado"](#nota-la-app-no-esta-firmada-mensaje-esta-danado) más abajo.

1. Descargar el `.dmg` correspondiente desde GitHub Releases:
   - **Intel (x64):** `maxy-print-bridge-mac-x64.dmg`
   - **Apple Silicon (arm64):** `maxy-print-bridge-mac-arm64.dmg`

   Si no sabes cuál tienes: menú Apple → Acerca de esta Mac → Chip/Procesador. Si dice "Intel" usa x64; si dice "Apple M1/M2/M3…" usa arm64.

2. Abrir el `.dmg` (doble clic) y arrastrar **`Maxy Print Bridge.app`** a la carpeta **Aplicaciones**.

3. Quitar la cuarentena de Gatekeeper (paso obligatorio la primera vez, la app no está firmada) y abrir:
   ```bash
   xattr -cr "/Applications/Maxy Print Bridge.app"
   open "/Applications/Maxy Print Bridge.app"
   ```

   `xattr -cr` limpia el atributo de cuarentena de forma **recursiva** en todo el paquete `.app` — con `xattr -d` (sin `-r`) sobre un `.app` puede no alcanzar y seguir mostrando "está dañado y no se puede abrir".

4. Abrir **`http://127.0.0.1:17881`** → elegir impresora → **Guardar**.

Si la impresora no aparece, verificar CUPS:
```bash
lpstat -a   # lista impresoras CUPS
lpstat -d   # impresora por defecto
```

### Nota: la app no está firmada — mensaje "está dañado"

Como `Maxy Print Bridge.app` no tiene firma de código de Apple (ni siquiera ad-hoc) ni está notarizada, macOS Ventura/Sonoma+ **no** ofrece el clásico botón "Abrir de todas formas" para desarrolladores no identificados — directamente dice **"'Maxy Print Bridge' está dañado y no se puede abrir. Deberías moverlo a la papelera."** Ese mensaje es engañoso: el archivo no está corrupto, es el comportamiento estándar de Gatekeeper con binarios sin ninguna firma descargados de internet (atributo `com.apple.quarantine`).

El paso 3 (`xattr -cr`) es la única forma sin costo de evitarlo — hay que ejecutarlo cada vez que se instala una versión nueva, ya que cada descarga vuelve a traer el atributo de cuarentena. La alternativa que elimina el problema de raíz (firmar + notarizar la app) requiere una cuenta de Apple Developer Program; no está implementada por ahora.

## Linux (Ubuntu / Debian)

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

## Dónde vive cada dato

| Qué | Dónde se guarda / origen |
|-----|---------------------------|
| Impresora elegida | **`~/.maxy-print-bridge/config.json`** (Linux/macOS) o **`%APPDATA%\MaxyPrintBridge\config.json`** (Windows). |
| Puerto WebSocket (panel → bridge) | **17880**, fijo en `src/ports.ts`. |
| Puerto de la página de ajustes | **17881**, fijo en `src/ports.ts`. |
