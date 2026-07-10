# Troubleshooting: los íconos no se ven (bandeja o `.exe`)

Postmortem técnico de dos problemas relacionados donde un ícono no se veía como se esperaba después de reemplazar el diseño placeholder — uno era un bug real de código, el otro resultó ser caché de Windows.

- [Caso 1 — Ícono de la bandeja del sistema en blanco/negro](#caso-1--ícono-de-la-bandeja-del-sistema-en-blanconegro) (bug real, en `electron/tray-state.ts`)
- [Caso 2 — Un `.exe` en `release/` con ícono viejo y el otro con el nuevo](#caso-2--un-exe-en-release-con-ícono-viejo-y-el-otro-con-el-nuevo) (caché del Explorador de Windows, sin bug de código)

---

## Caso 1 — Ícono de la bandeja del sistema en blanco/negro

Tras reemplazar los PNG placeholder de `assets/icon-tray-*.png` por el diseño real, el ícono en la bandeja del sistema seguía mostrando un cuadrado en blanco/negro (el placeholder de "sin ícono" de Windows) en vez del diseño.

### Síntoma

- `npm run electron:dev` compilaba y copiaba los assets sin error (`[copy-electron-assets] 6 file(s) → dist/electron/assets/`).
- El tooltip del ícono (`Maxy Print Bridge — Activo`) se veía correcto al pasar el mouse.
- El ícono en sí se veía como un cuadrado sólido en blanco/negro, sin el glifo diseñado.
- El problema persistía después de: redimensionar los PNG a 16×16, quitar un `.resize()` agregado como parche, y reiniciar `explorer.exe` para descartar caché de íconos de Windows.

### Causa raíz (dos bugs en `assetsDir()`)

Código relevante: [`electron/tray-state.ts`](../electron/tray-state.ts), función `assetsDir()`, usada por `getIconForState()` para construir la ruta a cada PNG.

### Bug 1 — detección de modo dev con `NODE_ENV`

```ts
// ANTES (incorrecto)
function assetsDir(): string {
  if (process.env.NODE_ENV === 'development' || !process.resourcesPath) {
    return path.join(__dirname, '..', 'assets');
  }
  return path.join(process.resourcesPath, 'assets');
}
```

El script `electron:dev` (`package.json`) es `"npm run build:electron && electron ."` — **nunca setea `NODE_ENV`**. Y `process.resourcesPath` **siempre está definido** en Electron, empaquetado o no (apunta a los recursos internos del propio binario de Electron). Entonces la condición completa daba `false`, y en dev caía al `else`: buscaba los assets dentro de `node_modules/electron/dist/resources/assets`, una carpeta que no existe en el proyecto.

**Fix:** usar la señal correcta que expone Electron para esto, `app.isPackaged`, en vez de inferirlo por variables de entorno que nadie setea:

```ts
if (!app.isPackaged) {
  return path.join(__dirname, 'assets');
}
return path.join(process.resourcesPath, 'assets');
```

### Bug 2 — nivel equivocado en la ruta relativa (`..` de más)

Con el Bug 1 corregido, la rama de dev seguía usando `path.join(__dirname, '..', 'assets')`. Pero el `tsconfig.electron.json` compila `electron/tray-state.ts` → `dist/electron/tray-state.js`, y el script `scripts/copy-electron-assets.mjs` copia los PNG a `dist/electron/assets/` (**hermano** de `tray-state.js`, no un nivel arriba).

`__dirname` en tiempo de ejecución es `dist/electron`. Subir un nivel con `'..'` apunta a `dist/assets`, que **no existe**:

```bash
$ ls dist/assets
ls: cannot access 'dist/assets': No such file or directory
$ ls dist/electron/assets
icon.ico icon-512.png icon-tray-error.png icon-tray-printing.png icon-tray-ready.png icon-tray-warn.png
```

**Fix:** quitar el `'..'` — los assets son hermanos del `.js` compilado, no un nivel arriba:

```ts
if (!app.isPackaged) {
  // tray-state.js compiles to dist/electron/; assets are copied to
  // dist/electron/assets (sibling), not one level up.
  return path.join(__dirname, 'assets');
}
```

### Por qué el resultado era "cuadrado en blanco/negro" y no un crash

`getIconForState()` tiene un fallback defensivo:

```ts
const img = nativeImage.createFromPath(iconPath);
if (img.isEmpty()) return nativeImage.createEmpty();
```

Como la ruta apuntaba a un archivo inexistente, `nativeImage.createFromPath` devolvía una imagen vacía, y el fallback silencioso entregaba `nativeImage.createEmpty()` a `tray.setImage()`. Windows renderiza un ícono vacío como ese placeholder sólido — de ahí que ningún cambio en el diseño del PNG (tamaño, color, resize) tuviera efecto: **el archivo nunca se estaba leyendo**, así que no importaba cómo fuera el contenido.

Esta clase de fallback silencioso es útil para no crashear en desarrollo, pero también es lo que ocultó el bug real durante varias iteraciones — el síntoma (ícono vacío) era idéntico tanto si el PNG estaba mal diseñado como si la ruta estaba mal resuelta.

### Cómo verificar / reproducir

1. Confirmar el árbol de build real, no asumirlo:
   ```bash
   npm run build:electron
   find dist -maxdepth 3 -type d
   ```
   Debe existir `dist/electron/assets/`, no `dist/assets/`.

2. Si el ícono de bandeja no aparece, primero descartar que sea el archivo (tamaño, canal alfa) inspeccionando el PNG directamente:
   ```bash
   node -e "
   const fs=require('fs');
   const buf=fs.readFileSync('assets/icon-tray-ready.png');
   console.log(buf.readUInt32BE(16)+'x'+buf.readUInt32BE(20));
   "
   ```
   (Debe dar `16x16`. Los tray icons de Windows deben exportarse en ese tamaño — ver [`ICONS.md`](../ICONS.md).)

3. Si el archivo está bien pero el ícono sigue sin verse, sospechar de la resolución de ruta en runtime antes que del diseño. Es fácil descartar el diseño primero y perder tiempo iterando sobre el PNG cuando el bug está en cómo se arma `iconPath`.

4. Para depurar `assetsDir()` en caliente, un `console.log` temporal alcanza:
   ```ts
   function assetsDir(): string {
     const dir = !app.isPackaged
       ? path.join(__dirname, 'assets')
       : path.join(process.resourcesPath, 'assets');
     console.log('[tray] assetsDir:', dir); // borrar antes de commitear
     return dir;
   }
   ```

### Lección para evitar que se repita

- **No inferir modo dev/prod con `NODE_ENV`** en apps Electron si el script que las lanza no lo setea explícitamente — usar siempre `app.isPackaged`, que Electron garantiza.
- **No asumir la estructura de `dist/`** al escribir rutas relativas con `__dirname` — verificarla con `find`/`ls` después de un build real, especialmente cuando un script aparte (`copy-electron-assets.mjs`) decide dónde caen los assets.
- Un fallback silencioso (`isEmpty() → createEmpty()`) que evita crashes en dev también puede esconder bugs de path. Si un ícono/recurso no aparece y no hay ningún error en consola, sospechar primero de la ruta antes que del contenido del archivo.

---

## Caso 2 — Un `.exe` en `release/` con ícono viejo y el otro con el nuevo

Después de `npm run dist:win`, en `release/` aparecen `maxy-print-bridge-setup.exe` (instalador NSIS) y `maxy-print-bridge-win.exe` (portable). El instalador mostraba el ícono real recién diseñado en el Explorador de Windows; el portable seguía mostrando un ícono genérico/placeholder, pese a que ambos se generan en el mismo build y comparten la misma config de ícono.

### Diagnóstico

`electron-builder.yml` define `win.icon: assets/icon.ico` a nivel `win:`, que aplica a **ambos** targets (`nsis` y `portable`) — no hay configuración separada por target que pudiera justificar la diferencia:

```yaml
win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
  icon: assets/icon.ico
```

Para confirmar si electron-builder realmente incrustaba íconos distintos en cada `.exe`, se extrajo el ícono embebido de cada binario y se comparó:

```powershell
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon("release\maxy-print-bridge-setup.exe")
$icon.ToBitmap().Save("setup.png", [System.Drawing.Imaging.ImageFormat]::Png)
# repetir con maxy-print-bridge-win.exe
```

Los dos PNG resultantes dieron **el mismo MD5** — es decir, `electron-builder` incrusta el ícono correcto e idéntico en los dos ejecutables. La config y el build son correctos.

### Causa raíz: caché de íconos del Explorador de Windows

No es un bug de código ni de `electron-builder.yml`. El Explorador de Windows cachea el ícono de un `.exe` asociado a su **ruta completa** (carpeta + nombre de archivo). Como `release/maxy-print-bridge-win.exe` ya existía de builds anteriores —de cuando `assets/icon-tray-*.png`/`icon.ico` todavía eran placeholders—, Windows mostraba el ícono viejo cacheado para esa ruta exacta en vez de leer el nuevo contenido del archivo. Es la misma familia de bug que el [Caso 1](#caso-1--ícono-de-la-bandeja-del-sistema-en-blanconegro), pero en la caché de miniaturas del Explorador en lugar de la caché de íconos de la bandeja.

### Fix / cómo verificar

1. **Más simple:** reiniciar `explorer.exe` para forzar que descarte la caché de íconos:
   ```powershell
   Stop-Process -Name explorer -Force
   Start-Process explorer.exe
   ```
2. **Más definitivo:** borrar `release/` antes de recompilar, así ningún artefacto nuevo hereda una entrada de caché asociada a esa ruta:
   ```bash
   rm -rf release
   npm run dist:win
   ```
3. Para descartar de entrada que sea un problema de config, comparar el ícono embebido de los `.exe` generados (script de PowerShell arriba) — si el MD5 coincide, el problema es 100% caché del Explorador, no hace falta tocar `electron-builder.yml`.

### Lección para evitar que se repita

- Antes de sospechar de la config de `electron-builder`, comparar los íconos **embebidos realmente** en los binarios (extracción + hash) en vez de confiar solo en lo que muestra el Explorador — el Explorador tiene su propia capa de caché que puede mentir.
- Los artefactos de `release/` se sobrescriben por nombre en cada build; si un nombre de archivo tuvo alguna vez un ícono placeholder, Windows puede seguir mostrándolo hasta que se refresque la caché o se borre y regenere el archivo desde cero.
