# Contrato térmico portable v1

Este directorio define la frontera compartida entre SSGG, el bridge de escritorio y los encoders móviles.

## Fuentes de verdad

- `thermal-print-v1.schema.json`: estructura externa de `ThermalPrintPayload.version = 1`.
- `fixtures/*.json`: entradas sintéticas y opciones físicas del papel.
- `expected/*.txt`: documento semántico esperado; no son bytes específicos de una impresora.
- `src/ticket-document.ts`: unión discriminada de instrucciones.
- `src/ticket-builder.ts`: resolución canónica de defaults, secciones, orden y wrap.

## Flujo de conformidad

1. Validar el payload en la frontera. Una versión desconocida se rechaza completa.
2. Construir un documento con `lineWidth`/`paperWidthMm` explícitos.
3. Comparar la representación semántica con el fixture esperado.
4. Codificar las instrucciones al transporte/SDK de la plataforma.
5. Hacer QA físico por modelo antes de declararlo compatible.

El móvil puede generar bytes distintos a Windows si su SDK usa comandos equivalentes. Lo obligatorio es preservar texto, visibilidad, orden, énfasis, ajuste, avance y corte. “Bytes enviados” no garantiza que haya papel, tinta o corte físico.

## Perfiles de referencia

| Papel | Columnas | Uso |
|---|---:|---|
| 58 mm | 32 | Impresora móvil/compacta |
| 80 mm | 48 | Caja/cocina estándar |
| 112 mm | 64 | Compatibilidad con configuración histórica del bridge |

El encoder de escritorio usa Epson + PC850 multilingüe. Si un encoder móvil no soporta un carácter, debe aplicar un fallback documentado y nunca truncar silenciosamente campos completos.

## Cambios de contrato

- Campos opcionales retrocompatibles pueden añadirse manteniendo `version: 1` si los consumidores antiguos los ignoran.
- Cambios de semántica, campos obligatorios o estructura requieren nueva versión, schema y fixtures.
- No editar snapshots para “hacer pasar” un cambio sin revisar visualmente la diferencia.

## Validación

```bash
npm.cmd test
npm.cmd run build:electron
```

Los fixtures no contienen PII real y deben mantenerse así.
