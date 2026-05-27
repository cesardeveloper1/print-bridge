# PRP: Personalizar ticket — leer config del payload (print-bridge)

> **Version:** 1.0
> **Created:** 2026-05-26
> **Status:** Ready
> **Repo:** `print-bridge` (Node.js / Electron Windows)

**PRPs relacionados:**
- Backend: `ssgg/PRPs/058--ticket-config-brand.md`
- Panel: `panel-admin-ag360ai/PRPs/043--personalizar-ticket-config.md`

---

## Goal

Actualizar `format-ticket.ts` para que lea el campo `ticketConfig` del `ThermalPrintPayload` y ajuste el formato del ticket térmico según la configuración de la m
arca: título personalizado, secciones visibles, y líneas de pie de página.

Todo el cambio está contenido en `src/types.ts` y `src/format-ticket.ts`. No se tocan servidores, ni la cola de impresión, ni el store de configuración.

---

## Why

- Hoy el diseño del ticket está hardcodeado: `'MAXY — TICKET'` como título, todas las secciones siempre visibles, sin footer personalizado.
- El backend (PRP 058) y el panel (PRP 043) ya construyen y envían `ticketConfig` en el payload; el print-bridge es el último eslabón que necesita consumirlo.
- Si `ticketConfig` está ausente o un campo falta, se aplican los defaults actuales → retro-compatible sin cambios de configuración.

---

## What

### Estructura de `ticketConfig` esperada en el payload

```typescript
interface BrandTicketConfig {
  headerTitle: string;          // "" → usa "MAXY — TICKET" / "MAXY — COCINA"
  showOrderId: boolean;         // default: true
  showCustomerPhone: boolean;   // default: true
  showDeliveryAddress: boolean; // default: true
  showItemPrices: boolean;      // default: true
  showTotals: boolean;          // default: true
  showPaymentMethod: boolean;   // default: true
  showSpecialNotes: boolean;    // default: true
  footerLine1: string;          // "" → no imprime
  footerLine2: string;          // "" → no imprime
}
```

---

### Cambios de tipo

**MODIFY:** `src/types.ts`

```typescript
// Agregar interface BrandTicketConfig:
export interface BrandTicketConfig {
  headerTitle?: string;
  showOrderId?: boolean;
  showCustomerPhone?: boolean;
  showDeliveryAddress?: boolean;
  showItemPrices?: boolean;
  showTotals?: boolean;
  showPaymentMethod?: boolean;
  showSpecialNotes?: boolean;
  footerLine1?: string;
  footerLine2?: string;
}

// Agregar campo opcional a ThermalPrintPayload:
export interface ThermalPrintPayload {
  // ... campos existentes sin cambio ...
  ticketConfig?: BrandTicketConfig;  // ← NUEVO
}
```

Todos los campos de `BrandTicketConfig` son opcionales aquí para máxima compatibilidad hacia atrás.

---

### Cambios en `format-ticket.ts`

**MODIFY:** `src/format-ticket.ts`

Agregar función helper que resuelve la config con defaults:

```typescript
function resolveTicketConfig(raw?: BrandTicketConfig): Required<BrandTicketConfig> {
  return {
    headerTitle:          raw?.headerTitle          ?? '',
    showOrderId:          raw?.showOrderId          ?? true,
    showCustomerPhone:    raw?.showCustomerPhone     ?? true,
    showDeliveryAddress:  raw?.showDeliveryAddress   ?? true,
    showItemPrices:       raw?.showItemPrices        ?? true,
    showTotals:           raw?.showTotals            ?? true,
    showPaymentMethod:    raw?.showPaymentMethod     ?? true,
    showSpecialNotes:     raw?.showSpecialNotes      ?? true,
    footerLine1:          raw?.footerLine1           ?? '',
    footerLine2:          raw?.footerLine2           ?? '',
  };
}
```

Actualizar `buildEscPosBuffer` para usar la config:

```typescript
function buildEscPosBuffer(payload: ThermalPrintPayload): Buffer {
  // ... setup printer (sin cambio) ...

  const isKitchen = payload.ticketType === 'kitchen';
  const cfg = resolveTicketConfig(payload.ticketConfig);  // ← NUEVO

  // ENCABEZADO
  printer.alignCenter();
  printer.bold(true);
  // Si headerTitle está definido y no vacío, usarlo; si no, comportamiento actual
  const mainTitle = cfg.headerTitle.trim()
    ? cfg.headerTitle.trim().toUpperCase()
    : (isKitchen ? 'MAXY — COCINA' : 'MAXY — TICKET');
  printer.println(mainTitle);
  printer.bold(false);
  printer.drawLine();
  printer.alignLeft();

  // STATUS BANNER (sin cambio)
  if (!isKitchen) {
    const title = payload.triggerStatus === 'PREORDER' ? 'PRE-ORDEN' : 'ORDEN ACEPTADA';
    printer.bold(true);
    printer.println(title);
    printer.bold(false);
  } else {
    printer.bold(true);
    printer.println('TICKET DE COCINA');
    printer.bold(false);
  }

  // ORDER INFO
  if (payload.orderNumber) printer.println(`Pedido: ${payload.orderNumber}`);
  if (cfg.showOrderId) printer.println(`ID: ${payload.orderId}`);  // ← condicional
  if (payload.brandSubdomain) printer.println(`Marca: ${payload.brandSubdomain}`);
  if (payload.branchName) printer.println(`Local: ${payload.branchName}`);
  printer.println(`Estado: ${payload.statusLabel}`);
  printer.drawLine();

  // CLIENTE
  const showCustomer = payload.customerName
    || (cfg.showCustomerPhone && payload.customerPhone);
  if (showCustomer) {
    printer.bold(true);
    printer.println('Cliente');
    printer.bold(false);
    if (payload.customerName) printer.println(payload.customerName);
    if (cfg.showCustomerPhone && payload.customerPhone)  // ← condicional
      printer.println(payload.customerPhone);
    printer.drawLine();
  }

  // DELIVERY
  const hasDeliveryLine = payload.deliveryMode
    || (!isKitchen && cfg.showDeliveryAddress
        && (payload.deliveryAddress || payload.deliveryAddressRef));
  if (hasDeliveryLine) {
    if (payload.deliveryMode) printer.println(`Modalidad: ${payload.deliveryMode}`);
    if (!isKitchen && cfg.showDeliveryAddress) {  // ← condicional
      if (payload.deliveryAddress) printer.println(`Dir: ${payload.deliveryAddress}`);
      if (payload.deliveryAddressRef) printer.println(`Ref: ${payload.deliveryAddressRef}`);
    }
    printer.drawLine();
  }

  // ITEMS
  printer.bold(true);
  printer.println('Items');
  printer.bold(false);
  for (const line of payload.items || []) {
    const mods = line.modifiers?.length ? ` (${line.modifiers.join(', ')})` : '';
    if (isKitchen || !cfg.showItemPrices) {  // ← condicional showItemPrices
      printer.println(`${line.quantity}x ${line.name}${mods}`);
    } else {
      printer.println(`${line.quantity}x ${line.name}${mods}  ${money(line.lineTotal ?? line.unitPrice)}`);
    }
  }
  printer.drawLine();

  // TOTALES (solo full ticket + config activa)
  if (!isKitchen && cfg.showTotals) {  // ← condicional
    if (payload.productsSubtotal !== undefined)
      printer.println(`Subtotal prod.: ${money(payload.productsSubtotal)}`);
    if (payload.deliveryCost !== undefined)
      printer.println(`Delivery: ${money(payload.deliveryCost)}`);
    if (payload.discountAmount !== undefined && payload.discountAmount > 0)
      printer.println(`Descuento: -${money(payload.discountAmount)}`);
    if (payload.total !== undefined) {
      printer.bold(true);
      printer.println(`TOTAL: ${money(payload.total)}`);
      printer.bold(false);
    }
  }

  // MÉTODO DE PAGO
  if (!isKitchen && cfg.showPaymentMethod && payload.paymentLabel) {  // ← condicional
    printer.println(`Pago: ${payload.paymentLabel}`);
  }

  // NOTAS ESPECIALES
  if (cfg.showSpecialNotes && payload.specialNotes) {  // ← condicional
    printer.drawLine();
    printer.println(`Notas: ${payload.specialNotes}`);
  }

  // PIE DE TICKET — NUEVO
  if (cfg.footerLine1.trim() || cfg.footerLine2.trim()) {
    printer.drawLine();
    if (cfg.footerLine1.trim()) printer.println(cfg.footerLine1.trim());
    if (cfg.footerLine2.trim()) printer.println(cfg.footerLine2.trim());
  }

  // TIMESTAMP + CORTE (sin cambio)
  printer.drawLine();
  printer.println(`Impreso: ${payload.printedAt}`);
  printer.println('');
  printer.cut();

  const buffer = printer.getBuffer();
  if (!buffer || buffer.length === 0) {
    throw new Error('No se pudo generar el ticket (buffer vacío).');
  }
  return buffer;
}
```

---

### Matriz de comportamiento

| Config | `ticketConfig` ausente | `ticketConfig` presente |
|--------|----------------------|------------------------|
| Título | `'MAXY — TICKET'` (actual) | `headerTitle` si no vacío; si vacío → `'MAXY — TICKET'` |
| ID | Siempre imprime (actual) | Según `showOrderId` |
| Teléfono cliente | Siempre imprime (actual) | Según `showCustomerPhone` |
| Dirección | Siempre imprime (actual) | Según `showDeliveryAddress` |
| Precios | Siempre imprime (actual) | Según `showItemPrices` |
| Totales | Siempre imprime (actual) | Según `showTotals` |
| Pago | Siempre imprime (actual) | Según `showPaymentMethod` |
| Notas | Siempre imprime (actual) | Según `showSpecialNotes` |
| Footer | No hay (actual) | `footerLine1` + `footerLine2` si no vacíos |

---

### Success Criteria

- [ ] `ticketConfig` ausente → ticket idéntico al actual (sin regresión).
- [ ] `headerTitle = 'MI RESTAURANTE'` → título "MI RESTAURANTE" en lugar de "MAXY — TICKET".
- [ ] `showOrderId = false` → línea `ID: xxx` no aparece.
- [ ] `showCustomerPhone = false` → teléfono no aparece; nombre sí.
- [ ] `showDeliveryAddress = false` → dirección y referencia no aparecen.
- [ ] `showItemPrices = false` → ítems sin precio; totales no aparecen aunque `showTotals = true`.
- [ ] `showTotals = false` → bloque subtotal/total/delivery/descuento no aparece.
- [ ] `showPaymentMethod = false` → línea `Pago: xxx` no aparece.
- [ ] `showSpecialNotes = false` → sección notas no aparece.
- [ ] `footerLine1 = '¡Gracias!'` y `footerLine2 = ''` → solo una línea de footer antes del corte.
- [ ] `npm run build` pasa (TypeScript strict).
- [ ] Ticket de cocina (`ticketType === 'kitchen'`) no se ve afectado por `showItemPrices`, `showTotals`, `showDeliveryAddress` (kitchen ya los ignora por lógica `isKitchen`).

### Out Of Scope

- Configuración de printer desde el payload (printerName siempre viene de config local).
- Alineación/estilos ESC/POS personalizados (font size, bold por sección).
- QR code o imagen de marca (v2).
- Múltiples idiomas en el ticket (los labels siempre en español en v1).

---

## All Needed Context

```yaml
LEER / MODIFICAR:
  - src/types.ts
      why: Agregar BrandTicketConfig interface + campo ticketConfig? en ThermalPrintPayload.

  - src/format-ticket.ts
      why: Leer ticketConfig, aplicar resolveTicketConfig(), condicionar todas las secciones.

REFERENCIA (solo leer):
  - src/index.ts
      why: Ver cómo se valida y pasa el payload a printThermalPayload — no cambia.

  - node_modules/node-thermal-printer/
      why: API del printer (println, drawLine, bold, alignCenter, etc.) — no cambia.
```

---

## Gotchas

```typescript
// GOTCHA 1: `showTotals` y `showItemPrices` están relacionados — si !showItemPrices,
// no tiene sentido mostrar totales. En format-ticket.ts, usar:
// `if (!isKitchen && cfg.showTotals && cfg.showItemPrices)` para el bloque de totales.
// El panel (PRP 043) ya deshabilita el toggle showTotals cuando showItemPrices=false,
// pero el bridge debe ser defensivo.

// GOTCHA 2: headerTitle.toUpperCase() — las impresoras ESC/POS en PC850_MULTILINGUAL
// soportan tildes en mayúsculas. Probar "TÍTULO" con tilde antes de asumir que funciona.
// Si hay problemas de encoding, normalizar con normalize('NFD').replace(/[̀-ͯ]/g, '').

// GOTCHA 3: footerLine1/2 con longitud > 58 caracteres se wrappean automáticamente
// por BreakLine.WORD. No truncar manualmente.

// GOTCHA 4: Si ticketConfig llega como null (no undefined), `resolveTicketConfig(null)`
// devuelve defaults correctamente porque `null?.headerTitle ?? ''` evalúa ''.
// Pero si llega como string serializado "{...}", el bridge recibiría un string, no un objeto.
// El bridge confía en que el remitente envía JSON bien formado (WebSocket JSON.parse).

// GOTCHA 5: isKitchen ya suprime totales, dirección y precios por su propia lógica.
// Las condiciones `cfg.showXxx` SOLO aplican cuando !isKitchen, para no romper kitchen.
// Ver la condición `if (!isKitchen && cfg.showDeliveryAddress)` en el ejemplo.
```

---

## Cross-repo checklist

| Repo | Acción |
|------|--------|
| `ssgg` | Agregar ticketConfig a Brand + embed en ThermalPrintPayload — PRP 058 |
| `panel-admin-ag360ai` | UI configuración + enviar ticketConfig en impresión manual — PRP 043 |
| `print-bridge` | Este PRP |
