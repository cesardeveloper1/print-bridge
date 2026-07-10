# Publicar los artefactos Windows (GitHub Actions)

El workflow vive en el **repositorio Git del bridge**. Si trabajás en un monorepo local, esa carpeta suele ser `print-bridge/`; en GitHub el repo del bridge tiene esa carpeta como **raíz** del clon.

**Ruta en el repo del bridge:** `.github/workflows/print-bridge-release.yml`

| Paso | Detalle |
|------|---------|
| Repo | Remoto dedicado al bridge (raíz contiene `package.json`, `src/`, `electron/`, `assets/`, `.github/`, etc.). |
| Workflow | **`.github/workflows/print-bridge-release.yml`** |
| Release | Tag que empiece por **`print-bridge-`** (ej. `print-bridge-1.3.0`) y publicar el release. |
| Assets generados | **`maxy-print-bridge-setup.exe`** (instalador) y **`maxy-print-bridge-win.exe`** (portable) adjuntos al release. |
| URLs para el panel | Instalador → **`VITE_PRINT_BRIDGE_DOWNLOAD_URL`**; portable → **`VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE`**. Actualizar en GitHub Environment **production** del panel y redesplegar. |
| Prueba sin release | **Actions** → **Run workflow** → artifact `maxy-print-bridge-win-electron`. |

Si `git pull --tags origin main` rechaza un tag con *would clobber existing tag*, borra el tag local (`git tag -d print-bridge-X.Y.Z`) y vuelve a hacer pull. Detalle en [docs/desarrollo.md — Conflicto de tags al hacer pull](../desarrollo.md#conflicto-de-tags-al-hacer-pull).

**Orden de despliegue:**
```
1. Merge + release print-bridge (setup + portable en GitHub Releases)
2. Actualizar VITE_PRINT_BRIDGE_DOWNLOAD_URL y VITE_PRINT_BRIDGE_DOWNLOAD_URL_PORTABLE en GitHub Environment production del panel
3. Merge panel PRP 083 + push main → Azure rebuild
4. Verificar botón descarga + badge conectado en prod
```

Guía completa paso a paso: [Desplegar y mostrar el descargable en el panel](../despliegue-panel.md).
