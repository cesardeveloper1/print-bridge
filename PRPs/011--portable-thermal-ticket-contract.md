# PRP: Contrato portátil y fixtures de conformidad para tickets térmicos

> **Proyecto:** `print-bridge`  
> **Versión:** 1.0  
> **Fecha:** 2026-08-13  
> **Estado:** Implemented  
> **Patrón:** B — contrato multiplataforma sin cambiar el bridge  
> **Consumidor:** `panel-admin-ag360ai-movile/PRPs/022--native-mobile-auto-print.md`

## 1. Project Overview

Convertir el formato actual en una especificación verificable y portátil. `print-bridge` seguirá imprimiendo en escritorio, pero expondrá JSON Schema, fixtures y una representación semántica pura que móvil pueda reproducir sin importar Node, Electron, CUPS, PowerShell ni `node-thermal-printer`.

Estimación: 1–2 semanas incluyendo refactor y snapshots sin regresión física.

## 2. Problem Statement

El contrato existe como interfaces TypeScript internas y el formato está mezclado con filesystem, config global, `Buffer` y envío al SO. Copiar esa función al APK no compila y mantener formatos independientes sin pruebas hará divergir escritorio y móvil.

## 3. Success Criteria

- Schema versionado para `ThermalPrintPayload.version = 1` consumible por otros repos.
- Fixtures full/kitchen y límites producen el mismo documento semántico en escritorio y móvil.
- El ticket ESC/POS default del bridge permanece equivalente al actual.
- El builder puro no accede a filesystem, SO, config, impresora ni red.
- No se obliga a actualizar inmediatamente panel o SSGG.

## 4. User Stories (Jobs-to-be-Done)

- Cuando implemento el encoder móvil, quiero fixtures canónicos para validar compatibilidad.
- Cuando cambia el ticket, quiero detectar diferencias mediante snapshots.
- Cuando soporte compara Android y Windows, quiere separar layout de driver/hardware.

## 5. Functional Requirements

### P0

- **FR-001:** Publicar `docs/contracts/thermal-print-v1.schema.json` para payload y `BrandTicketConfig` actuales.
- **FR-002:** Añadir fixtures sintéticos: full, kitchen, 58/80 mm, textos largos, modificadores, dirección, notas, caracteres españoles y secciones ocultas.
- **FR-003:** Extraer de `format-ticket.ts` un builder puro `payload + opciones -> TicketDocument`.
- **FR-004:** `TicketDocument` representa alineación, énfasis, tamaño, texto, divisores, pares, avance y corte; no contiene `Buffer` ni SO.
- **FR-005:** Adaptar el encoder ESC/POS actual para consumir `TicketDocument` sin cambiar envío Windows/CUPS.
- **FR-006:** El ancho entra como argumento; el builder no llama `readUserConfig()`.
- **FR-007:** Exportar snapshots legibles esperados y pruebas deterministas.
- **FR-008:** Documentar encoding, caracteres no soportados, wrap, corte y diferencias permitidas.
- **FR-009:** Mantener `PrintJobMessage.version = 1`, token local, Origin y WebSocket.
- **FR-010:** Añadir guía móvil: validar schema → construir documento → codificar → comparar snapshot.

### P1

- **FR-011:** Evaluar publicar builder/tipos como paquete privado; no bloquear MVP con otra cadena de despliegue.
- **FR-012:** Golden bytes solo para un perfil Epson/PC850 de referencia, sin declararlo universal.

## 6. Non-Functional Requirements

- Mismo payload/opciones produce mismo documento; sin hora implícita.
- Compatible con Node 18+ y builds Electron existentes.
- Fixtures sin PII real.
- Una resolución de defaults y orden de secciones.
- El módulo puro no importa `fs`, `os`, `path`, Electron, `ws` ni envío.

## 7. Technical Constraints

- `node-thermal-printer` permanece en adapter de escritorio.
- `printedAt` viene en payload; el builder no lo genera.
- Defaults y `full|kitchen` son comportamiento protegido.
- Los repos son separados: schema/fixtures se versionan y verifican hasta decidir paquete.
- No abrir el bridge a la LAN ni convertirlo en servicio móvil.

## 8. Data Requirements

```ts
type TicketInstruction =
  | { kind: 'text'; value: string; align: 'left' | 'center' | 'right'; style: 'normal' | 'bold' | 'inverted'; width: 1 | 2; height: 1 | 2 }
  | { kind: 'leftRight'; left: string; right: string; style: 'normal' | 'bold' }
  | { kind: 'divider'; style: 'none' | 'dashed' | 'solid' }
  | { kind: 'feed'; lines: number }
  | { kind: 'cut' };

interface TicketDocument {
  contractVersion: 1;
  paperWidthMm: 58 | 80;
  lineWidth: number;
  instructions: TicketInstruction[];
}
```

JSON Schema es fuente estructural; `TicketDocument` es fuente del layout semántico.

## 9. UI/UX Requirements

No se agrega UI. Electron debe seguir viéndose e imprimiendo igual. La documentación incluye muestras de texto renderizado para revisión humana.

## 10. Risks & Assumptions

| Riesgo | Mitigación |
|---|---|
| Refactor cambia espacios/wrap | Snapshots antes/después + QA físico. |
| Semántica coincide, bytes fallan | Tests separados de encoder/hardware. |
| Fixtures móviles desactualizados | `contractVersion`, hash y checklist cross-repo. |
| Paquete complica builds | Mantener P1; schema/fixtures primero. |

Supuesto: equivalencia semántica es suficiente aunque SDKs generen bytes equivalentes no idénticos.

## 11. Out of Scope

- Bluetooth, USB, TCP móvil o Capacitor.
- API durable, leases o trabajos SSGG.
- Abrir bridge a LAN.
- Cambiar diseño, labels o reglas de negocio.
- Resolver impresión silenciosa iOS.
- Publicar paquete npm público.

## 12. Open Questions

1. Ancho default 48 columnas vs perfiles 58/80. Resolver con hardware certificado.
2. Paquete privado. Recomendación: después del segundo consumidor validado.
3. Charset Android. Recomendación: PC850 si hardware admite y fallback documentado.

## Implementation Blueprint

```yaml
MUST_READ:
  - src/types.ts
  - src/format-ticket.ts
  - src/print-queue.ts
  - src/bridge.ts
  - PRPs/004--ticket-config-customization.md
  - PRPs/007--ws-origin-and-token-hardening.md
```

Estructura:

```text
docs/contracts/thermal-print-v1.schema.json
docs/contracts/fixtures/*.json
docs/contracts/expected/*.txt
docs/contracts/README.md
src/ticket-document.ts
src/ticket-builder.ts
src/escpos-encoder.ts
src/format-ticket.ts
```

Orden: congelar fixtures → schema → builder puro → adapter ESC/POS → snapshots/QA físico → guía/versionado.

## Validation Loop

```bash
npm run build
# ejecutar suite unitaria de contracts/ticket builder
npm run build:electron
```

Validar: full default; kitchen; `both`; 58/80; wrap; tildes/ñ/moneda; config parcial/legacy/null; versión desconocida rechazada.

## Anti-Patterns

- ❌ Filesystem/Buffer en contrato portable.
- ❌ Cambiar layout durante extracción.
- ❌ Orden real como fixture.
- ❌ Abrir WebSocket a LAN para el teléfono.
- ❌ Declarar compatibilidad sin impresión física.

## Implementation Result

Implementado el 2026-08-13:

- Schema v1, cuatro fixtures sintéticos y cuatro snapshots semánticos.
- `TicketDocument` discriminado, builder puro y encoder Epson/PC850 separado.
- Validación defensiva de payload v1 antes de la cola WebSocket.
- Suite Node Test con 8 casos: snapshots, versión desconocida, cocina, secciones ocultas y buffer ESC/POS.
- `npm.cmd test`, `npm.cmd run build` y `npm.cmd run build:electron` completados correctamente.

Pendiente fuera del entorno automatizado: QA físico comparativo en impresoras certificadas 58/80 mm y eventual paquete privado P1.
