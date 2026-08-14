import type { ThermalPrintLineItem, ThermalPrintPayload } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isLineItem(value: unknown): value is ThermalPrintLineItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.quantity === 'number' &&
    Number.isFinite(value.quantity) &&
    value.quantity > 0 &&
    isOptionalFiniteNumber(value.unitPrice) &&
    isOptionalFiniteNumber(value.lineTotal) &&
    (value.modifiers === undefined ||
      (Array.isArray(value.modifiers) &&
        value.modifiers.every((modifier) => typeof modifier === 'string'))) &&
    isOptionalString(value.notes)
  );
}

/** Validación defensiva del contrato externo antes de acceder a la cola/impresora. */
export function isThermalPrintPayloadV1(value: unknown): value is ThermalPrintPayload {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (value.triggerStatus !== 'PREORDER' && value.triggerStatus !== 'ACEPTED') return false;
  if (value.ticketType !== undefined && value.ticketType !== 'full' && value.ticketType !== 'kitchen') {
    return false;
  }
  if (typeof value.orderId !== 'string' || value.orderId.length === 0) return false;
  if (typeof value.brandSubdomain !== 'string' || value.brandSubdomain.length === 0) return false;
  if (typeof value.statusLabel !== 'string' || value.statusLabel.length === 0) return false;
  if (typeof value.printedAt !== 'string' || value.printedAt.length === 0) return false;
  if (!Array.isArray(value.items) || !value.items.every(isLineItem)) return false;

  const optionalStrings = [
    value.orderNumber,
    value.brandName,
    value.branchName,
    value.branchExternalId,
    value.customerName,
    value.customerPhone,
    value.deliveryMode,
    value.deliveryAddress,
    value.deliveryAddressRef,
    value.paymentLabel,
    value.specialNotes,
    value.summary,
    value.createdAt,
    value.currencySymbol,
    value.pdfBase64,
  ];
  if (!optionalStrings.every(isOptionalString)) return false;

  const optionalNumbers = [
    value.productsSubtotal,
    value.deliveryCost,
    value.discountAmount,
    value.total,
  ];
  if (!optionalNumbers.every(isOptionalFiniteNumber)) return false;

  return value.ticketConfig === undefined || isRecord(value.ticketConfig);
}
