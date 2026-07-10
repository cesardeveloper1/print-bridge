# Preguntas frecuentes

**¿El restaurante necesita API key?**
No. Descargar, abrir, elegir impresora.

**¿Mac o Linux?**
Impresión térmica sí, y desde v1.3 también corren como app de bandeja del sistema (Electron), igual que Windows — ya no son binarios de consola. En Linux el artefacto es un **AppImage**; requiere `libfuse2` instalado en la PC del restaurante o no abre (ver [troubleshooting-linux-appimage.md](./troubleshooting-linux-appimage.md)). En macOS no está firmada/notarizada, así que Gatekeeper la bloquea salvo que se limpie la cuarentena (ver [pc-cliente.md#macos](./deploy/pc-cliente.md#macos)).

**Descargué el AppImage de Linux, le doy doble clic y no pasa nada.**
Casi siempre falta `libfuse2` (Ubuntu 22.04+ y 24.04 no lo traen por defecto) — sin eso el AppImage no muestra ningún error, simplemente no arranca. Ver [troubleshooting-linux-appimage.md](./troubleshooting-linux-appimage.md) para el diagnóstico completo y el fix.

**¿El `.exe` lee `.env`?**
No. Las `VITE_*` van en el **build del panel**, no en la PC del local.

**¿Error «No se encontró send-raw-print.ps1» al imprimir?**
Versiones antiguas del `.exe` no extraían el script de impresión al disco. Desde la corrección en `send-raw-print-script.ts`, al abrir el programa se copia a `%TEMP%\MaxyPrintBridge\send-raw-print.ps1`. Publique un release nuevo (`npm run pkg:win`) y reinstale el `.exe`.

**¿Por qué no veo el botón de descarga en el panel?**
Falta `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en GitHub → production, o el panel no se redeployó tras configurarla. Ver [Desplegar y mostrar el descargable](./despliegue-panel.md).

**¿Dónde reporto problemas?**
Issues en GitHub o soporte Maxy (versión del `.exe`, impresora, estado de **Prender impresión**).
