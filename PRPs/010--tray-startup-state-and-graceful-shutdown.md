# PRP: Estado real de bandeja y apagado determinista

> **Version:** 1.0  
> **Created:** 2026-08-12  
> **Status:** Implemented  
> **Repo:** `print-bridge`  
> **Pattern:** A — corrección acotada del ciclo de vida Electron/Node.

## 1. Project Overview

Corregir dos fallos visibles de Maxy Print Bridge en Windows: el ícono de bandeja puede quedarse indefinidamente en **“Iniciando…”** aun con impresora configurada y bridge operativo, y la acción **Salir** puede tardar mucho cuando el panel mantiene un WebSocket abierto.

Usuarios: cajeros y soporte técnico que operan el bridge desde la bandeja de Windows.

## 2. Problem Statement

El bridge publica su estado inicial `ready`/`no-printer` dentro de `startBridge()`. Electron registra el listener `b.on('status', ...)` solo después de que la promesa de arranque resuelve, por lo que pierde esa primera emisión y el tray queda con su estado inicial `starting`.

Al salir, `bridge.stop()` espera `wss.close()`. Ese callback no concluye hasta que se cierran todos los clientes WebSocket; el panel puede mantener uno conectado. Como no se cierran activamente los clientes ni existe un plazo máximo, el proceso tarda en terminar y puede impedir un relanzamiento inmediato.

Evidencia: el panel detecta el bridge (muestra “Apagar impresión”) mientras el tooltip dice “Maxy Print Bridge — Iniciando…”.

## 3. Success Criteria

- Tras abrir el Bridge con una impresora previamente guardada, la bandeja muestra `Activo` sin requerir guardar, imprimir ni cambiar de ventana.
- Sin impresora guardada, la bandeja muestra `Sin impresora configurada`, nunca `Iniciando…` después del arranque.
- `Salir` libera WS y HTTP y finaliza normalmente aunque el panel siga conectado.
- Un relanzamiento posterior a `Salir` no genera bloqueo de segunda instancia ni conflictos de puertos por el proceso anterior.
- Los errores de cierre se registran sin bloquear la salida del usuario.

## 4. User Stories

1. Cuando inicio el Bridge que ya configuré, quiero ver su estado real de inmediato para confiar en que está listo para imprimir.
2. Cuando selecciono Salir, quiero que el programa termine en pocos segundos aunque el panel esté abierto, para poder reiniciarlo o actualizarlo.
3. Cuando soporte revisa un caso, quiere distinguir un bridge realmente iniciando de una bandeja que no recibió el estado inicial.

## 5. Functional Requirements

### P0 — Sincronización inicial de tray

- **FR-001:** Al obtener `BridgeHandle`, Electron debe aplicar de inmediato `bridge.getStatus()` a `lastStatus`, ícono, tooltip y menú antes de depender de eventos futuros.
- **FR-002:** El listener `status` se mantiene para cambios posteriores (guardar configuración, imprimir, errores).
- **FR-003:** La bandeja conserva `starting` solo durante el arranque real; el primer estado terminal debe ser `ready`, `no-printer` o `error`.

### P0 — Cierre de servidores y clientes

- **FR-004:** `stop()` debe detener nuevas conexiones y cerrar/terminar explícitamente todos los clientes de `wss.clients` antes de esperar el cierre del WebSocket server.
- **FR-005:** Debe cerrar también el servidor HTTP de configuración (`17881`).
- **FR-006:** El cierre debe tener un timeout corto, documentado y seguro. Si un callback no llega, registrar el hecho y permitir `app.quit()`; el usuario no debe quedar bloqueado indefinidamente.
- **FR-007:** Llamar `stop()` más de una vez no debe lanzar ni dejar promesas pendientes.

### P1 — Observabilidad

- **FR-008:** Registrar inicio, estado inicial aplicado al tray, clientes WS cerrados y resultado/timeout del apagado, sin tokens ni payloads de pedidos.
- **FR-009:** Incluir el estado y puertos efectivos en “Copiar información de soporte”.

## 6. Non-Functional Requirements

- **Rendimiento:** sincronización del tray no añade solicitudes de red ni bloquea UI.
- **Confiabilidad:** salida normal en menos de 3 segundos en condiciones locales; timeout máximo explícito como salvaguarda.
- **Seguridad:** no alterar allowlist de Origin, token compartido, PNA/LNA ni selección de puertos.
- **Compatibilidad:** Windows/Electron empaquetado y modo desarrollo; no asumir APIs exclusivas del panel.

## 7. Technical Constraints

- Modificar principalmente `electron/main.ts` y `src/bridge.ts`.
- Usar `BridgeHandle.getStatus()` existente como fuente de verdad inicial; no duplicar configuración de impresora en Electron.
- `WebSocketServer.close()` espera clientes existentes: el código de apagado debe gestionar `wss.clients` antes de esperar su callback.
- Mantener el contrato público de `BridgeHandle.stop(): Promise<void>`.

## 8. Data Requirements

No hay cambios de schema ni de `config.json`. Solo se agregan líneas técnicas a `bridge.log`: versión, estado inicial, cantidad de sockets cerrados y resultado de cierre.

## 9. UI/UX Requirements

- Tooltip inmediatamente posterior al arranque: `Activo` + impresora o `Sin impresora configurada`.
- No agregar diálogos de confirmación ni pantallas nuevas.
- Si hay error real al arrancar, conservar el estado/ícono de error existente y el mensaje de soporte.

## 10. Risks & Assumptions

| Riesgo | Mitigación |
|---|---|
| Terminar un socket mientras hay un trabajo de impresión | En Salir se privilegia liberar el proceso; registrar si había cola pendiente y no afirmar que terminó el trabajo. |
| Timeout demasiado corto oculta una falla | Registrar contexto y usarlo solo tras iniciar el cierre ordenado. |
| Aplicar estado antes del listener deja un intervalo mínimo | Aplicar snapshot inmediatamente y luego registrar listener en el mismo bloque síncrono. |

Suposición: `getStatus()` representa correctamente la configuración persistida al finalizar `startBridge()`.

## 11. Out of Scope

- Cambiar la configuración de impresora, el protocolo WS o impresión de tickets.
- Implementar reinicio automático o actualizar el instalador.
- Cambios en `panel-admin-ag360ai` o `ssgg` para resolver el tooltip de Electron.

## 12. Open Questions

1. ¿Qué timeout exacto se adopta para salida? Recomendación: 2 s, con medición en Windows.
2. ¿Se debe mostrar una notificación si se termina con trabajos pendientes? Decisión de producto; no necesaria para la corrección base.

## Implementation Blueprint

### `electron/main.ts`

1. Después de `bridge = b`, obtener `const initialStatus = b.getStatus()`.
2. Asignar `lastStatus`, ejecutar `applyStatusToTray(tray, initialStatus)` y `refreshTrayMenu()`.
3. Luego registrar los listeners actuales para estado y notificaciones.
4. En `handleQuit`, impedir invocaciones repetidas mientras ya se está cerrando y llamar a `app.quit()` incluso si el cierre excede el límite controlado.

### `src/bridge.ts`

1. Guardar un `stopPromise` para idempotencia.
2. Antes de `wss.close`, iterar los clientes activos: solicitar `close()` y usar `terminate()` como fallback para los que no cierren.
3. Cerrar `wss` y `settingsServer` de forma independiente/coordinada; capturar `ERR_SERVER_NOT_RUNNING` como cierre válido.
4. Resolver al completarse ambos o al vencer timeout; escribir un log que permita diferenciar ambos casos.

## Validation Loop

1. Con `%APPDATA%/MaxyPrintBridge/config.json` ya configurado, iniciar Bridge: el tooltip debe cambiar a `Activo` sin interacción.
2. Sin `printerName`, iniciar Bridge: debe mostrar `Sin impresora configurada`.
3. Abrir panel y verificar que mantiene un WS conectado; pulsar Salir y medir el tiempo hasta que desaparezca el proceso.
4. Relanzar inmediatamente tras salir; debe obtener el single-instance lock y puertos sin error.
5. Repetir con una impresión en cola y verificar que no hay bloqueo indefinido.
6. Ejecutar `npm.cmd run build` y el build Electron/release aplicable.

## Quality Checklist

- [ ] El tray aplica el snapshot inicial y escucha cambios futuros.
- [ ] La salida fuerza liberación de clientes WS y cierra HTTP.
- [ ] El timeout está acotado y deja log.
- [ ] No se filtran token ni datos de pedidos.
- [ ] Se probó el relanzamiento inmediato en Windows.
