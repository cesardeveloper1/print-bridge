# PRP: Maxy Print Bridge — soporte macOS (Intel + Apple Silicon)

> **Version:** 1.1
> **Created:** 2026-05-26
> **Status:** Ready
> **Repo:** `print-bridge`

**PRPs relacionados:**
- Windows original: `PRPs/001--impresion-termica-bridge-windows.md`
- Linux bridge: `PRPs/003--linux-support.md`
- Panel — botones descarga macOS: `panel-admin-ag360ai/PRPs/040--macos-download-buttons.md`

---

## Goal

Compilar y distribuir el bridge como binario nativo de macOS para **Intel (x64)** y **Apple Silicon (arm64)**, publicando los dos binarios como assets en el mismo GitHub Release que el `.exe` de Windows.

Artefactos esperados al final:
- `release/maxy-print-bridge-mac-x64`
- `release/maxy-print-bridge-mac-arm64`

Todo el CI usa **GitHub Actions gratuito** (`macos-latest` es gratuito en repos públicos).  
Sin Apple Developer certificate ni notarización de pago.

---

## Why

- Los restaurantes con Mac en caja no pueden usar el bridge actual (solo `.exe`).
- `pkg` soporta `node18-macos-x64` y `node18-macos-arm64` como targets.
- Las dependencias core (`ws`, `p-queue`, `node-thermal-printer`) son JavaScript puro — sin addons nativos C++, por lo que la compilación cross-target es limpia.
- macOS trae CUPS de fábrica (Ventura+); `node-thermal-printer` acepta el nombre CUPS en `interface`.

---

## Constraint: sin firma de código (gratuito)

Gatekeeper (macOS Monterey+) bloqueará un binario no firmado. La solución sin pago:

```bash
# El usuario ejecuta UNA VEZ tras descargar:
xattr -d com.apple.quarantine ./maxy-print-bridge-mac-arm64
```

O bien: **click derecho → Abrir** en Finder la primera vez.

Documentar esto en `PRINT_BRIDGE_DEPLOY.md` y en el panel (ver PRP 040).

> **Actualización (2026-07-10):** la distribución mac migró de este binario `pkg` suelto a un `.app` empaquetado con Electron dentro de un `.dmg` (ver `.github/workflows/print-bridge-release.yml`, jobs `build-mac-x64`/`build-mac-arm64`). El comando de arriba ya no aplica tal cual — para un `.app` sin firmar hace falta `xattr -cr` (recursivo) sobre el bundle, y sin ese paso Gatekeeper en Ventura/Sonoma+ muestra "está dañado" en vez del clásico aviso de "desarrollador no identificado". Instrucciones vigentes: [docs/deploy/pc-cliente.md](../docs/deploy/pc-cliente.md#macos).

---

## Archivos a modificar

### 1. `src/windows-printers.ts` → renombrar/refactorizar a `src/printers.ts`

**Contexto actual:**  
`windows-printers.ts` exporta `listWindowsPrinters()` y `getWindowsDefaultPrinterName()`.  
Retorna `[]` en plataformas no-Windows (línea 9: `if (process.platform !== 'win32') return []`).

**Cambio:**  
Crear `src/printers.ts` que unifique la lógica por plataforma:

```
listWindowsPrinters()      → PowerShell Get-CimInstance (igual que ahora)
listMacOsPrinters()        → execSync('lpstat -a') → parsear líneas "NOMBRE accepting..."
listPrinters()             → dispatcher: win32 → Windows, darwin → macOS, else → []
getDefaultPrinterName()    → win32: getWindowsDefault via PowerShell
                             darwin: execSync('lpstat -d') → parsear "system default destination: NOMBRE"
                             else: null
```

Parseo de `lpstat -a` (macOS):
```
Cada línea tiene formato:  "HP_LaserJet accepting requests since..."
Tomar el primer token antes del espacio como nombre de impresora.
```

Parseo de `lpstat -d` (macOS):
```
Salida: "system default destination: HP_LaserJet"
Tomar todo después de "destination: ".
Si no hay impresora por defecto: "No system default destination." → retornar null.
```

**Archivos que importan el módulo actual y necesitan actualizar su import:**
- `src/index.ts` — importa `getWindowsDefaultPrinterName`
- `src/settings-server.ts` — importa `listWindowsPrinters`

Actualizar esos imports para que apunten a `./printers` y usen las funciones unificadas.

### 2. `src/format-ticket.ts` — sin cambios de código

La línea:
```typescript
interface: `printer:${printerName}`,
```
Funciona con nombres CUPS en macOS exactamente igual que en Windows con Win32_Printer.  
`node-thermal-printer` abstrae esto internamente. **No requiere modificación.**

### 3. `src/file-logger.ts` — verificar rutas

`config-store.ts:configDir()` ya resuelve `~/.maxy-print-bridge` en no-Windows.  
Verificar que `file-logger.ts` use `configDir()` para la ruta del log, no `process.env.APPDATA` hardcodeado.  
Si ya lo hace: sin cambios. Si no: alinear para que el log en macOS vaya a `~/.maxy-print-bridge/bridge.log`.

### 4. `package.json` — 2 scripts nuevos

```json
"pkg:mac-x64":   "npm run build && pkg dist/index.js --targets node18-macos-x64   --output release/maxy-print-bridge-mac-x64",
"pkg:mac-arm64": "npm run build && pkg dist/index.js --targets node18-macos-arm64  --output release/maxy-print-bridge-mac-arm64"
```

Añadir después de `pkg:win` en la sección `"scripts"`.

### 5. `.github/workflows/print-bridge-release.yml` — añadir jobs macOS

**Enfoque:** mantener el job Windows existente intacto y añadir dos jobs nuevos para macOS.  
No convertir a matrix para evitar romper el job Windows (que ya funciona en producción).

```yaml
build-mac-x64:
  if: >-
    github.event_name == 'workflow_dispatch' ||
    (github.event_name == 'release' && startsWith(github.event.release.tag_name, 'print-bridge-'))
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: npm
        cache-dependency-path: package-lock.json
    - run: npm ci && npm run pkg:mac-x64
    - name: Verify artifact
      run: |
        p="release/maxy-print-bridge-mac-x64"
        [ -f "$p" ] || (echo "Missing $p" && exit 1)
        ls -lh "$p"
    - name: Upload asset to release
      if: github.event_name == 'release'
      uses: softprops/action-gh-release@v2
      with:
        files: release/maxy-print-bridge-mac-x64
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    - name: Upload workflow artifact (manual runs)
      if: github.event_name == 'workflow_dispatch'
      uses: actions/upload-artifact@v4
      with:
        name: maxy-print-bridge-mac-x64
        path: release/maxy-print-bridge-mac-x64

build-mac-arm64:
  # Igual que build-mac-x64 pero con pkg:mac-arm64 y artifact mac-arm64
```

> **Nota:** `macos-latest` corre en Apple Silicon (arm64) desde 2024. Ambos targets (`x64` y `arm64`) compilan correctamente en este runner porque `pkg` genera el binario target desde el host sin importar la arquitectura del runner.

---

## Validation gates

```bash
# 1. TypeScript sin errores tras el refactor de printers.ts
npm run build

# 2. Binarios generados (ejecutar en CI macos-latest o Mac físico)
npm run pkg:mac-x64
ls -lh release/maxy-print-bridge-mac-x64   # debe existir y pesar ~50-80 MB

npm run pkg:mac-arm64
ls -lh release/maxy-print-bridge-mac-arm64  # idem

# 3. En Mac físico — verificar que levanta
xattr -d com.apple.quarantine ./release/maxy-print-bridge-mac-arm64  # quitar cuarentena
./release/maxy-print-bridge-mac-arm64 &
sleep 2
curl http://127.0.0.1:8081/api/printers  # debe retornar array JSON (puede ser [])
curl http://127.0.0.1:8081/api/config    # debe retornar { "printerName": null }
curl -X POST http://127.0.0.1:8081/api/config \
  -H "Content-Type: application/json" \
  -d '{"printerName":"TestPrinter"}'     # debe retornar { "ok": true }
curl http://127.0.0.1:8081/api/config    # debe retornar { "printerName": "TestPrinter" }

# 4. Verificar CUPS disponible en macOS (pre-requisito del usuario)
lpstat -a    # lista impresoras; si falla → CUPS no activo (infrecuente en macOS moderno)
lpstat -d    # muestra impresora por defecto
```

---

## Gotchas

| # | Riesgo | Mitigación |
|---|--------|-----------|
| 1 | **Gatekeeper bloquea el binario** | Documentar `xattr -d` + "click derecho → Abrir" en `PRINT_BRIDGE_DEPLOY.md` y en el panel (PRP 040) |
| 2 | **`lpstat` no disponible** | Viene con CUPS; macOS Ventura+ lo trae activo. Si falla: `listPrinters()` retorna `[]` — mismo comportamiento que Windows sin impresoras |
| 3 | **Nombre CUPS con espacios o caracteres especiales** | `lpstat -a` puede dar nombres con espacios. Tomar el token hasta el primer espacio es insuficiente si el nombre lleva espacios; parsear hasta " accepting" como delimitador |
| 4 | **`node18` vs `node20` en pkg** | Si `pkg` con node18 target falla en macOS CI, usar `node20-macos-x64` / `node20-macos-arm64` como fallback |
| 5 | **CI macos-latest es arm64 desde 2024** | No afecta el build de x64 — `pkg` no requiere arquitectura matching |

---

## Flujo de release post-implementación

```
Tag: print-bridge-1.1.0
        ↓
GitHub Actions (3 jobs paralelos)
  ├─ build-and-attach (Windows, existente)  → maxy-print-bridge-win.exe
  ├─ build-mac-x64 (nuevo)                  → maxy-print-bridge-mac-x64
  └─ build-mac-arm64 (nuevo)                → maxy-print-bridge-mac-arm64
        ↓
GitHub Release → 3 assets adjuntos
        ↓
Copiar URLs → env vars del panel (ver PRP 040)
```
