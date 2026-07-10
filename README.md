# Maxy Print Bridge

Programa **local para Windows** que imprime tickets térmicos desde el panel web de Agiliza360, **sin que el navegador muestre ventanas de impresión**.

El panel (en internet) avisa al programa (en la misma PC de caja) y este manda el ticket a la impresora.

> **v1.3 — bandeja del sistema:** el programa ya no abre ventana de consola en ninguna plataforma (Windows, macOS, Linux) — busque el icono **Maxy Print Bridge** en la bandeja del sistema. En Linux es un **AppImage** que requiere `libfuse2` instalado; ver [docs/troubleshooting-linux-appimage.md](./docs/troubleshooting-linux-appimage.md) si se descarga pero no abre.

---

## ¿Para quién es este documento?

| Si eres… | Lee esta sección |
|----------|------------------|
| Dueño o cajero del restaurante | [Uso en la PC de caja](./docs/uso-caja.md) |
| Quien despliega (exe + panel) | [Desplegar y mostrar el descargable en el panel](./docs/despliegue-panel.md) |
| Desarrollador del equipo Maxy | [Desarrollo local](./docs/desarrollo.md) |

Documento técnico ampliado (backend + panel + Railway): [`docs/deploy/`](./docs/deploy/README.md).

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

**Importante:** panel y programa en **la misma PC**. No hace falta Node.js ni contraseñas en el local.

| Qué | Valor |
|-----|--------|
| Programa de impresión | `ws://127.0.0.1:17880` (automático) |
| Elegir impresora | `http://127.0.0.1:17881` |
| Config guardada | `%APPDATA%\MaxyPrintBridge\config.json` |

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/uso-caja.md](./docs/uso-caja.md) | Guía para el restaurante: descargar, instalar, elegir impresora, activar impresión |
| [docs/despliegue-panel.md](./docs/despliegue-panel.md) | Paso a paso para publicar el `.exe` y mostrar el botón de descarga en el panel |
| [docs/desarrollo.md](./docs/desarrollo.md) | Setup local, build, Electron, binarios de distribución, conflicto de tags |
| [docs/ci.md](./docs/ci.md) | Workflow de GitHub Actions por plataforma |
| [docs/protocolo-ws.md](./docs/protocolo-ws.md) | Protocolo WebSocket (puerto 17880) y estructura del proyecto |
| [docs/faq.md](./docs/faq.md) | Preguntas frecuentes |
| [docs/troubleshooting-tray-icon.md](./docs/troubleshooting-tray-icon.md) | Postmortem técnico (Windows): ícono de bandeja en blanco/negro y `.exe` de `release/` con ícono viejo |
| [docs/troubleshooting-linux-appimage.md](./docs/troubleshooting-linux-appimage.md) | Postmortem técnico (Linux): el AppImage se descarga pero no abre |
| [docs/deploy/](./docs/deploy/README.md) | Referencia técnica de despliegue: PC cliente, backend (Railway), panel (variables `VITE_*`) |
| [ICONS.md](./ICONS.md) | Cómo reemplazar los íconos placeholder por el diseño real |
