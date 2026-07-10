# Preguntas frecuentes

**¿El restaurante necesita API key?**
No. Descargar, abrir, elegir impresora.

**¿Mac o Linux?**
Impresión térmica sí. Bandeja del sistema solo **Windows** en v1.3 (macOS/Linux siguen con terminal hasta v2.x).

**¿El `.exe` lee `.env`?**
No. Las `VITE_*` van en el **build del panel**, no en la PC del local.

**¿Error «No se encontró send-raw-print.ps1» al imprimir?**
Versiones antiguas del `.exe` no extraían el script de impresión al disco. Desde la corrección en `send-raw-print-script.ts`, al abrir el programa se copia a `%TEMP%\MaxyPrintBridge\send-raw-print.ps1`. Publique un release nuevo (`npm run pkg:win`) y reinstale el `.exe`.

**¿Por qué no veo el botón de descarga en el panel?**
Falta `VITE_PRINT_BRIDGE_DOWNLOAD_URL` en GitHub → production, o el panel no se redeployó tras configurarla. Ver [Desplegar y mostrar el descargable](./despliegue-panel.md).

**¿Dónde reporto problemas?**
Issues en GitHub o soporte Maxy (versión del `.exe`, impresora, estado de **Prender impresión**).
