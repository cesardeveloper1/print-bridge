# Cómo cambiar los íconos

Hay dos tipos de ícono en esta app:

1. **Ícono de la app** — el que se ve en el instalador y en el `.exe`.
2. **Íconos de la bandeja** — el que aparece junto al reloj de Windows (como WhatsApp o Discord), y cambia de color según el estado del programa.

Ahora mismo son diseños de prueba. Hay que cambiarlos por los reales antes de publicar una versión nueva.

---

## 1. Ícono de la app

Archivos a reemplazar (mismo nombre, misma carpeta `assets/`):

| Archivo | Para qué sirve |
|---|---|
| `assets/icon.ico` | Windows: el `.exe`, el instalador, el acceso directo |
| `assets/icon-512.png` | Mac y Linux |

**Pasos:**

1. Pedí el diseño en un solo PNG cuadrado y grande (mínimo 1024×1024, fondo transparente). Guardalo como `assets/icon-512.png`.
2. Corré este comando (genera el `.ico` automáticamente, con todos los tamaños que necesita Windows):

   ```bash
   npx electron-icon-builder --input=assets/icon-512.png --output=build-icons-tmp --flatten
   ```

3. Copiá el resultado y borrá la carpeta temporal:

   ```bash
   cp build-icons-tmp/icons/icon.ico assets/icon.ico
   rm -rf build-icons-tmp
   ```

4. Listo. Para verlo: `npm run dist:win:setup` y mirá el ícono del instalador generado.

---

## 2. Íconos de la bandeja (junto al reloj)

Son 4 imágenes chiquitas (16×16 px) que cambian según el estado:

| Archivo | Cuándo se ve | Color de prueba actual |
|---|---|---|
| `assets/icon-tray-ready.png` | Todo bien | verde |
| `assets/icon-tray-warn.png` | Falta elegir impresora | ámbar |
| `assets/icon-tray-printing.png` | Imprimiendo | azul |
| `assets/icon-tray-error.png` | Error | rojo |

**Pasos:**

1. Pedí un solo diseño simple (ej. una impresora) que se entienda bien en tamaño chico.
2. Exportalo 4 veces en **16×16 px PNG**, cada vez con el color de cada estado (mismo dibujo, distinto color).
3. Guardalos con esos 4 nombres exactos, en `assets/`.
4. Para probar: `npm run electron:dev` y mirá el ícono junto al reloj. Mandá un ticket de prueba (clic derecho en el ícono → "Imprimir ticket de prueba") para ver el cambio de color.

> **¿El ícono no aparece o se ve como un cuadrado en blanco/negro aunque el PNG esté bien?** No es necesariamente el diseño — puede ser la resolución de ruta a `assets/` en `electron/tray-state.ts`. Ver [docs/troubleshooting-tray-icon.md](./docs/troubleshooting-tray-icon.md).

---

## Antes de publicar una versión nueva

- [ ] `assets/icon.ico` es el diseño real (no el de prueba).
- [ ] `assets/icon-512.png` es el diseño real.
- [ ] Los 4 `assets/icon-tray-*.png` son los reales.
- [ ] Se ve bien el instalador (`npm run dist:win:setup`).
- [ ] Se ven bien los 4 colores en la bandeja del sistema.
