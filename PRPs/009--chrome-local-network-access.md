# PRP: Compatibilidad Chrome para acceso al bridge local (PNA/LNA)

> **Version:** 1.0  
> **Created:** 2026-08-12  
> **Status:** Implemented  
> **Repos:** `print-bridge` y `panel-admin-ag360ai`  
> **Pattern:** A — cambio de compatibilidad acotado, en dos repos coordinados.

**PRPs relacionados:**

- `print-bridge/PRPs/007--ws-origin-and-token-hardening.md` — allowlist de Origin y token.
- `print-bridge/PRPs/008--ws-port-fallback.md` — fallback del puerto WS.
- `panel-admin-ag360ai/PRPs/169--print-bridge-ws-origin-token.md` — token del panel.
- `panel-admin-ag360ai/PRPs/170--print-bridge-ws-port-discovery.md` — descubrimiento de `wsPort`.

---

## 1. Project Overview

Hacer compatible la comunicación entre `https://admin.agiliza360.ai` y Maxy Print Bridge local (`127.0.0.1`) con las protecciones de Chrome para acceso a red local.

Usuarios objetivo: cajeros/restaurantes que imprimen desde el panel web en Chrome.

El resultado debe funcionar tanto en equipos afectados por el preflight legado **Private Network Access (PNA)** como en Chrome moderno, que usa el permiso **Local Network Access (LNA)**.

Estimación: 1–2 días, incluyendo pruebas manuales en Windows y empaquetado de un release nuevo del bridge.

## 2. Problem Statement

Un cajero puede tener Maxy Print Bridge instalado, iniciado y configurado, pero Chrome bloquea desde el panel HTTPS el `GET http://127.0.0.1:17881/api/config` con el mensaje que deniega acceso al espacio de direcciones `loopback`.

Esto causa dos consecuencias:

1. El panel no puede saber si el bridge está activo ni leer `printerType`.
2. Si `17880` estaba ocupado, el bridge toma correctamente un puerto WS dinámico, pero el panel no puede leer `wsPort` desde `17881`; vuelve a intentar `17880` y falla.

El origen del panel ya está en el allowlist del bridge. El problema no es una variable de entorno ni el token: el navegador bloquea antes de que la comunicación normal se complete.

Evidencia: captura de producción con `https://admin.agiliza360.ai` → `http://127.0.0.1:17881/api/config` bloqueado por acceso a `loopback` y WebSocket posterior fallido.

## 3. Success Criteria

- Un Chrome que exige PNA puede completar `GET /api/config` desde el panel oficial.
- En Chrome con LNA, el panel solicita el permiso de red local mediante una interacción clara y, si el usuario lo concede, detecta el bridge e imprime.
- Con `17880` ocupado y `17881` libre, el panel descubre el puerto WS real y conecta a él.
- Si el permiso se rechaza o `17881` está ocupado, el usuario recibe una explicación accionable; no se presenta como una simple caída del bridge.
- El allowlist actual y el token siguen protegiendo bridge; nunca se responde con CORS wildcard ni se abre el bridge a orígenes arbitrarios.

## 4. User Stories (Jobs-to-be-Done)

1. Cuando Chrome protege el acceso a servicios locales, quiero autorizar explícitamente a Agiliza360 a usar mi bridge, para poder imprimir sin cambiar flags del navegador.
2. Cuando el puerto WS usual está ocupado, quiero que el sistema detecte automáticamente el puerto real del bridge, para no tener que editar configuraciones técnicas.
3. Cuando no se pueda imprimir, quiero ver si el motivo es permiso de Chrome, bridge apagado o puerto ocupado, para poder pedir soporte con evidencia útil.
4. Cuando soporte revise un caso, quiero un log con versión, puertos y errores de origen, para diagnosticarlo sin acceder remotamente al equipo del cliente.

## 5. Functional Requirements

### P0 — Bridge: PNA backward compatibility

- **FR-001:** En `print-bridge/src/settings-server.ts`, una solicitud `OPTIONS` de un `Origin` permitido que incluya `Access-Control-Request-Private-Network: true` debe recibir `Access-Control-Allow-Private-Network: true` además de los headers CORS existentes.
- **FR-002:** El header PNA solo se emite si el origen supera `isSettingsOriginAllowed`; no permitir `*`, ni reflejar orígenes no permitidos.
- **FR-003:** La respuesta debe variar por `Origin` y por la solicitud PNA para evitar una respuesta CORS cacheada para otro contexto.
- **FR-004:** `GET /api/config`, `GET /api/printers`, la página local de settings y `POST /api/config` mantienen el contrato actual y la validación de token del POST.

### P0 — Panel: permiso Local Network Access

- **FR-005:** El panel debe realizar la primera consulta HTTP al bridge como una solicitud explícitamente marcada para destino local, compatible con la API de Chrome LNA (`targetAddressSpace: 'local'` cuando el navegador lo soporte).
- **FR-006:** La UX debe explicar por qué se pide acceso: “Permitir a Agiliza360 acceder a la red local para conectarse a Maxy Print Bridge e imprimir”. No presentar una solicitud de navegador sin contexto.
- **FR-007:** El flujo que necesite WebSocket debe resolver primero y correctamente la configuración HTTP local, para que el permiso LNA se solicite/registre antes del WebSocket.
- **FR-008:** Si Chrome niega el permiso o bloquea la consulta local, el estado del bridge debe indicar `Permiso de Chrome requerido o bloqueado`, con acción de reintentar. No debe afirmar que el `.exe` está apagado.
- **FR-009:** Navegadores que no implementen LNA o ignoren la opción adicional deben conservar el flujo actual sin error.

### P1 — Diagnóstico y soporte

- **FR-010:** El bridge debe registrar al inicio versión de aplicación, host, puerto WS efectivo y puerto UI esperado.
- **FR-011:** Si `17880` está ocupado, registrar que se eligió el puerto WS alternativo. Si `17881` está ocupado, registrar inequívocamente que el discovery HTTP no está disponible.
- **FR-012:** El panel debe separar en consola/telemetría local: permiso/bloqueo de navegador, bridge no alcanzable y error de WebSocket, incluyendo URL/puerto destino pero nunca el token.

## 6. Non-Functional Requirements

- **Security:** conservar el allowlist exacto de orígenes y el token de los trabajos de impresión. No usar CORS wildcard ni desactivar controles de Chrome mediante políticas/flags del cliente.
- **Compatibility:** Chrome estable actual, Chrome administrado y versiones que todavía activen PNA. No romper Firefox, Edge ni builds de desarrollo.
- **Performance:** el paso de permiso/discovery debe respetar el timeout local actual; no crear reintentos infinitos ni degradar el render inicial.
- **Reliability:** todos los errores de permiso, `fetch`, WS y timeout deben cerrar recursos y resolver el estado del UI de manera determinista.
- **Observability:** logs sin secretos, rotación existente preservada y texto de diagnóstico entendible por soporte.

## 7. Technical Constraints

- Bridge: Node HTTP + `ws`, host fijo `127.0.0.1`, UI `17881`, WS preferido `17880` con fallback ya implementado.
- Panel: React/Vite; las variables `VITE_PRINT_BRIDGE_*` están horneadas en el build y no se deben usar para sortear permisos del navegador.
- Chrome sustituyó el plan de enforcement PNA por LNA, pero equipos con flags, políticas o versiones antiguas pueden seguir exhibiendo el fallo PNA. Deben soportarse los dos comportamientos.
- El permiso LNA está ligado al origen seguro del panel; probar específicamente en `https://admin.agiliza360.ai`, no solo en Vite `localhost`.
- No se debe intentar servir TLS público en `127.0.0.1` como solución de esta entrega.

## 8. Data Requirements

No hay nuevos datos de negocio ni cambios en `config.json`.

Datos técnicos mínimos por incidente:

- versión del bridge;
- versión de Chrome (aportada por soporte);
- estado de permiso local si el navegador lo expone;
- URL/puerto WS efectivo;
- errores de red sin token ni payload de pedidos.

Retención: usar la rotación actual de `bridge.log` (2 MB) y no añadir PII.

## 9. UI/UX Requirements

Flujo propuesto:

1. Usuario abre la sección que usa impresión.
2. Si no existe una conexión local autorizada, ve estado `Conectar bridge de impresión` con breve explicación y botón de acción.
3. Al pulsarlo, el panel lanza la consulta local compatible con LNA; Chrome puede mostrar su diálogo nativo.
4. Si concede, el panel muestra `Bridge conectado` y la impresora configurada.
5. Si rechaza o Chrome bloquea, mostrar instrucciones breves para permitir acceso local al sitio y un botón `Reintentar`.

No usar como copy principal “CORS”, “PNA” o “loopback”; son términos de soporte, no del cajero.

## 10. Risks & Assumptions

| Riesgo | Mitigación |
|---|---|
| Chrome cambia nuevamente el mecanismo de acceso local | Mantener pruebas en Chrome estable/canary y aislar la llamada local en un helper. |
| El usuario rechaza el permiso | Estado explícito y acción de reintentar; guía de soporte para restaurar permisos del sitio. |
| `17881` está ocupado | Log claro y diagnóstico diferenciado; sigue fuera de alcance hacer dinámico el punto de discovery. |
| `17880` está ocupado | Mantener fallback actual y exigir que discovery HTTP sea exitoso antes del WS. |
| Un cambio CORS abre el bridge a cualquier sitio | Pruebas negativas de Origin no permitido y revisión de seguridad. |

Suposición: el panel sigue siendo servido por `https://admin.agiliza360.ai` y es el único origen público de producción autorizado para imprimir.

## 11. Out of Scope

- Eliminar el bridge local o reemplazarlo por impresión desde servidor.
- Fallback dinámico para `17881`; el puerto sigue siendo el punto de discovery fijo.
- Escaneo de un rango de puertos desde el navegador.
- Pedir al cliente que desactive flags de seguridad, edite el registro de Windows o aplique políticas de Chrome como solución permanente.
- Cambiar el formato de tickets, selección de impresora o protocolo de trabajos de impresión.

## 12. Open Questions

1. **UX de permiso:** ¿el permiso se debe pedir al ingresar al panel, al abrir Ajustes de impresión o solo al hacer clic en “Conectar bridge”?  
   - Recomendación: botón explícito en la experiencia de impresión para que el diálogo de Chrome tenga contexto.

2. **Estado/prompt exacto según Chrome:** validar en Chrome estable actual si el prompt aparece con la consulta marcada al destino `127.0.0.1`.  
   - Responsable: ingeniería frontend; bloquear antes de cerrar la implementación.

3. **Soporte de Chrome administrado:** ¿hay clientes con `chrome://policy` administrado por empresa?  
   - Responsable: soporte/comercial; afecta si una política puede negar LNA de forma central.

4. **Release coordinado:** ¿se publicará primero el panel o el instalador bridge?  
   - Recomendación: bridge primero, después panel; los cambios de headers son retrocompatibles y el panel nuevo necesita un bridge con PNA compatible.

---

## Implementation Blueprint

### `print-bridge/src/settings-server.ts`

- Centralizar la construcción de headers CORS/PNA para respuestas `OPTIONS`.
- Revisar el header de solicitud privada y emitir `Access-Control-Allow-Private-Network: true` solo tras aprobar el origen.
- Incluir el `Vary` apropiado para no mezclar respuestas de preflight entre orígenes/solicitudes.
- Mantener la respuesta 403 para cualquier Origin que no esté en la allowlist.

### `panel-admin-ag360ai/src/services/localPrintBridge.ts`

- Introducir un helper único para consultas HTTP locales compatible con el `RequestInit` extendido de Chrome.
- Usarlo en `fetchBridgeConfig()` y `resolveWsUrl()`; ambos son actualmente rutas hacia `:17881`.
- Clasificar los errores de la consulta local para que `PrintBridgeProvider` pueda distinguir permiso/bloqueo de indisponibilidad de bridge.

### `panel-admin-ag360ai/src/contexts/PrintBridgeProvider.tsx` y UI asociada

- Exponer estado de acceso local pendiente/denegado.
- Añadir interacción explícita para conectar/reintentar y copy de ayuda dirigido al usuario.
- Tras éxito HTTP, conservar la comprobación WS actual.

### Documentación

- Actualizar `print-bridge/docs/protocolo-ws.md` y la guía de soporte con la ruta de `bridge.log` y los tres diagnósticos: permiso de Chrome, `17880` ocupado y `17881` ocupado.

## Validation Loop

### Pruebas del bridge

1. `OPTIONS /api/config` desde `https://admin.agiliza360.ai` con solicitud PNA devuelve CORS específico + autorización PNA.
2. El mismo request desde un Origin no permitido devuelve 403 y no entrega headers permisivos.
3. Abrir directamente `http://127.0.0.1:17881` mantiene el flujo normal de configuración.
4. `npm run build`, `npm run build:electron` y pruebas existentes pasan.

### Pruebas del panel

1. Chrome estable actual: permitir acceso local, detectar bridge e imprimir.
2. Chrome con LNA bloqueante: se muestra prompt; conceder permite discovery y WS.
3. Rechazar el permiso: mensaje accionable + reintento, sin reportar falsamente bridge apagado.
4. Navegador sin soporte LNA: el flujo previo sigue funcionando.
5. `npm run lint` y `npm run build` pasan.

### Pruebas de puertos

1. `17880` libre: WS efectivo es `17880`.
2. `17880` ocupado: bridge usa puerto efímero; `GET :17881/api/config` expone `wsPort`; panel conecta a ese puerto.
3. `17881` ocupado: bridge/log/UI reportan el conflicto y panel ofrece diagnóstico de discovery no disponible.

## Quality Checklist

- [ ] No se amplió el allowlist ni se usó `Access-Control-Allow-Origin: *`.
- [ ] El token no aparece en logs, UI ni telemetría.
- [ ] PNA legado y LNA moderno tienen prueba documentada.
- [ ] El caso WS dinámico se prueba con Chrome, no solo con cliente WS de consola.
- [ ] El caso permiso rechazado tiene UX y guía para soporte.
- [ ] Se publica y prueba una nueva versión del instalador bridge antes de cerrar el rollout.
