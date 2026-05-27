# PRP: Maxy Print Bridge — soporte Linux (x64)

> **Version:** 1.0
> **Created:** 2026-05-26
> **Status:** Ready
> **Repo:** `print-bridge`

**Dependencia:** Ejecutar después de `PRPs/002--macos-support.md` (el refactor de `windows-printers.ts` → `printers.ts` ya cubre Linux mediante la rama `else → []`; este PRP extiende esa rama).

**PRPs relacionados:**
- Windows: `PRPs/001--impresion-termica-bridge-windows.md`
- macOS bridge: `PRPs/002--macos-support.md`
- Panel — botones descarga Linux: `panel-admin-ag360ai/PRPs/041--linux-download-buttons.md`

---

## Goal

Compilar y distribuir el bridge como binario nativo de **Linux x64**, publicado como asset adicional en el mismo GitHub Release que los binarios Windows y macOS.

Artefacto esperado:
- `release/maxy-print-bridge-linux-x64`

CI: **GitHub Actions `ubuntu-latest`** — runner más rápido y sin multiplicador de minutos (1× vs 10× de macOS). Completamente gratuito en repos públicos.

---

## Why

- Algunas cajas de restaurante corren Ubuntu o Debian; el bridge Windows no funciona en ellos.
- `pkg` soporta `node18-linux-x64` como target.
- CUPS está disponible en todas las distros Linux relevantes (Ubuntu, Debian, Mint) mediante `apt install cups` si no viene preinstalado.
- El runner `ubuntu-latest` de GitHub Actions es Linux x64 — compilación nativa directa.

---

## Diferencias Linux vs macOS

| Aspecto | macOS | Linux |
|---------|-------|-------|
| CUPS | Preinstalado (Ventura+) | Puede requerir `sudo apt install cups` |
| `lpstat` | Siempre disponible | Disponible con CUPS instalado |
| Gatekeeper | Sí, bloquea ejecutables no firmados | No (sin equivalente en escritorio estándar) |
| Permiso de ejecución | `xattr -d com.apple.quarantine` | `chmod +x ./maxy-print-bridge-linux-x64` |
| GitHub Actions runner cost | 10× multiplicador | 1× (igual que Ubuntu) |

---

## Archivos a modificar

### 1. `src/printers.ts` — extender rama Linux (depende de PRP 002)

El PRP 002 refactoriza `windows-printers.ts` → `printers.ts` con la estructura:
```
win32  → PowerShell
darwin → lpstat
else   → []  (actualmente)
```

**Cambio de este PRP:** reemplazar `else → []` por una rama `linux` explícita que también use `lpstat`:

```typescript
// En listPrinters():
if (process.platform === 'win32')  return listWindowsPrinters();
if (process.platform === 'darwin') return listMacOsPrinters();
if (process.platform === 'linux')  return listLinuxPrinters();
return [];

// listLinuxPrinters() — idéntico a listMacOsPrinters()
// Ambos usan lpstat -a y lpstat -d; CUPS es el estándar en ambos OS.
// Se puede exportar una función compartida listCupsPrinters() usada por ambas plataformas.
```

**Refactor sugerido:** dado que macOS y Linux usan exactamente el mismo mecanismo CUPS, extraer una función interna `listCupsPrinters()` y `getCupsDefaultPrinterName()` compartida por ambas ramas. Reduce duplicación.

### 2. `package.json` — 1 script nuevo

```json
"pkg:linux-x64": "npm run build && pkg dist/index.js --targets node18-linux-x64 --output release/maxy-print-bridge-linux-x64"
```

Añadir junto a `pkg:win`, `pkg:mac-x64`, `pkg:mac-arm64`.

### 3. `.github/workflows/print-bridge-release.yml` — añadir job Linux

```yaml
build-linux-x64:
  if: >-
    github.event_name == 'workflow_dispatch' ||
    (github.event_name == 'release' && startsWith(github.event.release.tag_name, 'print-bridge-'))
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: npm
        cache-dependency-path: package-lock.json
    - run: npm ci && npm run pkg:linux-x64
    - name: Verify artifact
      run: |
        p="release/maxy-print-bridge-linux-x64"
        [ -f "$p" ] || (echo "Missing $p" && exit 1)
        ls -lh "$p"
    - name: Upload asset to release
      if: github.event_name == 'release'
      uses: softprops/action-gh-release@v2
      with:
        files: release/maxy-print-bridge-linux-x64
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    - name: Upload workflow artifact (manual runs)
      if: github.event_name == 'workflow_dispatch'
      uses: actions/upload-artifact@v4
      with:
        name: maxy-print-bridge-linux-x64
        path: release/maxy-print-bridge-linux-x64
```

Este job corre en paralelo con los de Windows y macOS.

### 4. `PRINT_BRIDGE_DEPLOY.md` — sección Linux

Añadir sección nueva con instrucciones para el usuario final:

```markdown
## Linux (Ubuntu / Debian)

### Requisitos previos
\`\`\`bash
sudo apt-get update && sudo apt-get install -y cups
sudo systemctl enable cups && sudo systemctl start cups
\`\`\`

### Instalación
1. Descargar `maxy-print-bridge-linux-x64` desde GitHub Releases.
2. Dar permiso de ejecución:
   \`\`\`bash
   chmod +x ./maxy-print-bridge-linux-x64
   \`\`\`
3. Ejecutar (déjalo en segundo plano):
   \`\`\`bash
   ./maxy-print-bridge-linux-x64 &
   \`\`\`
4. Configurar impresora en: http://127.0.0.1:8081

### Impresora no aparece en la lista
Verificar que CUPS la detecta:
\`\`\`bash
lpstat -a   # lista impresoras CUPS
lpstat -d   # impresora por defecto
\`\`\`
```

### 5. `src/file-logger.ts` y `src/config-store.ts` — sin cambios adicionales

`config-store.ts:configDir()` ya resuelve `~/.maxy-print-bridge` para Linux (rama `else`).  
Si el PRP 002 alineó `file-logger.ts` con `configDir()`, Linux queda cubierto automáticamente.

### 6. `src/format-ticket.ts` — sin cambios

`printer:${printerName}` funciona con CUPS en Linux igual que en macOS.

---

## Validation gates

```bash
# 1. TypeScript sin errores
npm run build

# 2. Binario Linux generado (en CI ubuntu-latest o máquina Linux)
npm run pkg:linux-x64
ls -lh release/maxy-print-bridge-linux-x64  # debe existir y pesar ~50-80 MB

# 3. En Linux físico/VM — verificar que levanta
chmod +x ./release/maxy-print-bridge-linux-x64
./release/maxy-print-bridge-linux-x64 &
sleep 2
curl http://127.0.0.1:8081/api/printers  # array JSON (vacío si no hay impresoras CUPS)
curl http://127.0.0.1:8081/api/config    # { "printerName": null }

# 4. Con impresora CUPS configurada en Linux
lpstat -a    # debe listar la impresora
# La UI en http://127.0.0.1:8081 debe mostrar la impresora en el selector

# 5. Verificar que el log se escribe en la ruta correcta
cat ~/.maxy-print-bridge/bridge.log
```

---

## Gotchas

| # | Riesgo | Mitigación |
|---|--------|-----------|
| 1 | **CUPS no instalado** | Instrucción clara en `PRINT_BRIDGE_DEPLOY.md` y en el panel (PRP 041); el bridge retorna `[]` en lugar de crashear |
| 2 | **Permisos USB en Linux sin CUPS** | Con CUPS configurado los permisos se gestionan via `lp` group; sin CUPS: `/dev/usb/lp0` requiere `dialout`/`lp` group — CUPS es el path recomendado |
| 3 | **Nombres de impresora CUPS con guiones vs espacios** | CUPS en Linux a veces normaliza espacios a guiones en el nombre interno; `lpstat -a` muestra el nombre interno — usar ese mismo nombre en la config es correcto |
| 4 | **Autostart del bridge al boot** | Fuera del scope de este PRP; usuario avanzado puede usar `systemd --user`; no es requisito para MVP |
| 5 | **Distros sin `lpstat` en PATH** | `lpstat` viene en el paquete `cups-client`; instalar con `sudo apt install cups-client` si solo se necesita el cliente sin el servidor CUPS |

---

## Flujo de release post-implementación

```
Tag: print-bridge-1.1.0
        ↓
GitHub Actions (4 jobs paralelos)
  ├─ build-and-attach   (Windows)     → maxy-print-bridge-win.exe
  ├─ build-mac-x64      (macOS Intel) → maxy-print-bridge-mac-x64
  ├─ build-mac-arm64    (macOS ARM)   → maxy-print-bridge-mac-arm64
  └─ build-linux-x64    (Linux)       → maxy-print-bridge-linux-x64
        ↓
GitHub Release → 4 assets adjuntos
        ↓
Copiar URLs → env vars del panel (ver PRP 040 y 041)
```
