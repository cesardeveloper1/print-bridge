# Troubleshooting: el AppImage de Linux se descarga pero no abre

Análisis del síntoma reportado "se descarga, se le da doble clic (o se ejecuta), y no pasa absolutamente nada — sin ventana, sin error, sin ícono en la bandeja".

Este documento es **solo Linux**. Para macOS ver la nota de Gatekeeper en [pc-cliente.md#macos](./deploy/pc-cliente.md#macos). Para el bug de ícono de bandeja en Windows ver [troubleshooting-tray-icon.md](./troubleshooting-tray-icon.md). Son tres plataformas con causas y fixes completamente distintos — no mezclar el diagnóstico entre ellas.

---

## Contexto: qué cambió

Hasta hace poco, la documentación (`README.md`, `docs/faq.md`, `docs/deploy/pc-cliente.md`) describía Linux como un **binario de consola** (`pkg`), ejecutado por terminal, sin bandeja del sistema — "hasta v2.x". Pero `electron-builder.yml` y `.github/workflows/print-bridge-release.yml` (`build-linux-x64`, `npm run dist:linux`) ya migraron Linux a **Electron**, el mismo `electron/main.ts` con bandeja que usa Windows. El artefacto real es `maxy-print-bridge-linux-x64.AppImage`, no un binario suelto. La documentación quedó desactualizada respecto al pipeline real — eso ya se corrigió en `pc-cliente.md`, pero explica por qué alguien podría estar siguiendo instrucciones (`chmod +x && ./binario-sin-extension`) que no coinciden con lo que realmente se descargó.

## Causas más probables (de mayor a menor probabilidad)

### 1. Falta `libfuse2` — la causa más común, síntoma exacto

Los AppImage montan su propio filesystem vía FUSE2 al ejecutarse. Si `libfuse2` no está instalado, el AppImage **no arranca y no muestra ningún error** — especialmente si se lanza con doble clic desde el explorador de archivos, sin terminal donde ver el mensaje de error (`dlopen(): error loading libfuse.so.2`).

**Ubuntu 22.04 en adelante, y sobre todo 24.04, no traen `libfuse2` instalado por defecto.** Es la causa número uno reportada para "el AppImage no hace nada" en cualquier proyecto que distribuye AppImages, no solo este.

**Diagnóstico:**
```bash
ldconfig -p | grep libfuse.so.2
```
Si no devuelve nada, falta la librería.

**Fix:**
```bash
sudo apt-get update && sudo apt-get install -y libfuse2
```

**Diagnóstico alternativo sin instalar nada** (extrae el AppImage y lo corre sin FUSE, para confirmar que el problema es específicamente FUSE y no algo más):
```bash
./maxy-print-bridge-linux-x64.AppImage --appimage-extract-and-run
```
Si con este flag sí abre, el problema es 100% FUSE.

### 2. Falta de terminal para ver el error real

Independientemente de la causa de fondo, **siempre diagnosticar corriendo desde una terminal**, nunca con doble clic:
```bash
chmod +x ./maxy-print-bridge-linux-x64.AppImage
./maxy-print-bridge-linux-x64.AppImage
```
Cualquier error de Electron (librerías faltantes, sandbox, GPU) imprime a stderr. Con doble clic desde Nautilus/Files, ese output se pierde y el usuario solo ve "no pasa nada".

### 3. Bandeja del sistema no disponible en el entorno de escritorio

Electron crea el ícono de bandeja (`electron/main.ts`, `new Tray(...)`) asumiendo que el entorno de escritorio soporta el protocolo `StatusNotifierItem`/AppIndicator. **GNOME vanilla (Ubuntu por defecto desde 17.10) no tiene bandeja del sistema sin una extensión** (`AppIndicator and KStatusNotifierItem Support` u otra). Si la app arranca pero no hay dónde mostrar el ícono, el comportamiento visible puede ser indistinguible de "no pasa nada" — el proceso sigue vivo (`ps aux | grep maxy`), sirviendo en `17880`/`17881`, pero no hay ícono que clickear.

**Diagnóstico:**
```bash
ps aux | grep -i maxy      # ¿el proceso sigue corriendo?
curl http://127.0.0.1:17881  # ¿responde el servidor de settings?
```
Si el proceso está vivo y el `curl` responde, el bridge **sí está funcionando** — el problema es solo la falta de ícono de bandeja visible, no que "no pasó nada". En ese caso, usar directamente `http://127.0.0.1:17881` para configurar la impresora, sin depender del ícono.

**Fix (GNOME):** instalar la extensión `AppIndicator and KStatusNotifierItem Support` desde extensions.gnome.org.

### 4. Posible excepción no capturada al crear el `Tray` (hipótesis, no confirmada en Linux)

`electron/tray-state.ts` (`getIconForState`) tiene un fallback conocido: si no encuentra el PNG del ícono, entrega `nativeImage.createEmpty()` en vez de fallar — documentado en detalle en [troubleshooting-tray-icon.md](./troubleshooting-tray-icon.md) (bug confirmado en **Windows**, donde ese fallback degrada a un ícono en blanco/negro sin crashear).

En Linux, `new Tray(imagenVacía)` es conocido por **lanzar una excepción** en vez de degradar con gracia (a diferencia de Windows/macOS). Y `electron/main.ts` **no tiene ningún `process.on('uncaughtException', ...)`** — a diferencia de `src/index.ts` (el entrypoint de consola, que sí lo tiene y muestra un diálogo de error). Si esto ocurre, el proceso de Electron muere inmediatamente sin mostrar nada, lo cual también coincide con el síntoma reportado.

**No confirmado todavía en una PC Linux real** — es una hipótesis basada en el comportamiento documentado de Electron en Linux, no una reproducción verificada como el Caso 1 de `troubleshooting-tray-icon.md`. Si los puntos 1-3 no explican el problema en un caso concreto, este es el siguiente sospechoso a confirmar corriendo el AppImage desde terminal (punto 2) y revisando si imprime algo como `Error: Failed to create tray icon` antes de morir.

---

## Orden de diagnóstico recomendado

1. `ldconfig -p | grep libfuse.so.2` — si falta, instalar `libfuse2` y volver a probar. Resuelve la mayoría de los casos.
2. Correr el AppImage desde terminal (nunca doble clic) para ver cualquier error real.
3. `ps aux | grep maxy` + `curl http://127.0.0.1:17881` — confirmar si el proceso realmente arrancó pero solo falta el ícono de bandeja (entorno sin AppIndicator).
4. Si el proceso muere y el punto 2 muestra un error relacionado a `Tray` o íconos, es el bug del punto 4 — reportarlo, no es lo mismo que el Caso 1 de Windows aunque la causa raíz (resolución de ruta de assets) pueda ser compartida.
