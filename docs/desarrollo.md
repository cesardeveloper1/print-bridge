# Desarrollo local

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

# macOS — Electron (.dmg)
npm run dist:mac:x64     # → release/maxy-print-bridge-mac-x64.dmg
npm run dist:mac:arm64   # → release/maxy-print-bridge-mac-arm64.dmg

# Linux — Electron (AppImage)
npm run dist:linux       # → release/maxy-print-bridge-linux-x64.AppImage
```

> **Windows y bandeja del sistema:** a partir de v1.3 el instalador y el portable son Electron (sin consola). `pkg:win` queda como script de emergencia bajo el nombre `pkg:win:legacy`.
>
> **macOS y Linux también migraron a Electron** (dejaron de usar `pkg`). Los scripts `pkg:mac-x64`, `pkg:mac-arm64` y `pkg:linux-x64` siguen en `package.json` mientras no se confirme que nada los necesita, pero **el CI ya no los usa** — no los uses para generar los artefactos que se publican en Releases.
>
> **macOS no está firmado**: el `.dmg` generado por `dist:mac:*` no tiene firma ni notarización de Apple, así que Gatekeeper lo bloquea al descargarlo ("está dañado y no se puede abrir"). Ver [docs/deploy/pc-cliente.md#macos](./deploy/pc-cliente.md#macos) para el workaround.

**Nombre en terminal:** el proceso usa `process.title = "Maxy Print Bridge"` (pestaña de Terminal, Activity Monitor, etc.). No se usa firma de código ni metadatos PE en el `.exe`. Para no agrupar bajo “Terminal” en Windows 11, use **Host de consola de Windows** como terminal predeterminada (Configuración → Para desarrolladores → Terminal).

**Mac / Linux:** al salir con error o si ya hay otra instancia, la terminal pide **Enter** antes de cerrar (igual que Windows). Deje la ventana abierta mientras use el panel.

Probar ping (con [wscat](https://www.npmjs.com/package/wscat)):

```bash
wscat -c ws://127.0.0.1:17880
# {"type":"ping"}  →  {"ok":true,"type":"pong"}
```

Página de impresora: **`http://127.0.0.1:17881`**

Detalle del protocolo WebSocket y estructura del proyecto: [docs/protocolo-ws.md](./protocolo-ws.md).

## Conflicto de tags al hacer pull

Si `git pull --tags origin main` falla con un mensaje como:

```
! [rejected]        print-bridge-1.3.0 -> print-bridge-1.3.0  (would clobber existing tag)
```

el tag ya existe en local apuntando a un commit distinto del remoto. Git no lo sobrescribe automáticamente.

**Borrar el tag local** (no afecta al remoto):

```bash
git tag -d print-bridge-1.3.0
```

Luego sincronizar de nuevo:

```bash
git pull --tags origin main
```

**Verificar** (opcional) a qué commit apunta cada uno:

```bash
git show print-bridge-1.3.0 --no-patch
git ls-remote --tags origin | grep print-bridge
```

> Si el tag local era el correcto y el remoto está mal, no lo borres sin revisar; en ese caso el problema está en GitHub, no en tu clon.
