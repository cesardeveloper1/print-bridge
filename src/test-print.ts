import type { ThermalPrintPayload } from './types';

export function buildTestPrintPayload(): ThermalPrintPayload {
  const now = new Date().toISOString();
  return {
    version: 1,
    triggerStatus: 'ACEPTED',
    ticketType: 'full',
    orderId: 'TEST-PRINT',
    orderNumber: 'TEST-001',
    brandSubdomain: 'maxy',
    branchName: 'Maxy Print Bridge',
    statusLabel: 'PRUEBA',
    customerName: 'Ticket de prueba',
    deliveryMode: 'LOCAL',
    items: [
      { name: 'Ticket de prueba ESC/POS', quantity: 1, unitPrice: 0, lineTotal: 0 },
    ],
    productsSubtotal: 0,
    total: 0,
    createdAt: now,
    printedAt: now,
  };
}
