import { printThermalPayload } from '../dist/format-ticket.js';
import { resolvePrinterForPrint } from '../dist/resolve-printer.js';
import { toUserFacingPrintError } from '../dist/print-errors.js';

const payload = {
  version: 1,
  triggerStatus: 'ACEPTED',
  orderId: 'test-1',
  orderNumber: 'TEST-001',
  brandSubdomain: 'test',
  statusLabel: 'Aceptado',
  items: [{ name: 'Producto prueba', quantity: 1, lineTotal: 10 }],
  printedAt: new Date().toISOString(),
};

try {
  const r = resolvePrinterForPrint();
  console.log('printer:', r.printerName);
  await printThermalPayload(payload, r.printerName);
  console.log('PRINT OK');
} catch (e) {
  try {
    const r = resolvePrinterForPrint();
    console.log('USER MSG:', toUserFacingPrintError(e, r));
  } catch {
    console.log('USER MSG:', e instanceof Error ? e.message : e);
  }
  process.exit(1);
}
