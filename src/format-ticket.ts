import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from 'node-thermal-printer';
import type { ThermalPrintPayload } from './types';

function money(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(2);
}

export async function printThermalPayload(
  payload: ThermalPrintPayload,
  printerName: string,
): Promise<void> {
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `printer:${printerName}`,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    breakLine: BreakLine.WORD,
    options: { timeout: 5000 },
  });

  printer.alignCenter();
  printer.bold(true);
  printer.println('MAXY — TICKET');
  printer.bold(false);
  printer.drawLine();
  printer.alignLeft();

  const title =
    payload.triggerStatus === 'PREORDER' ? 'PRE-ORDEN' : 'ORDEN ACEPTADA';
  printer.bold(true);
  printer.println(title);
  printer.bold(false);

  if (payload.orderNumber) {
    printer.println(`Pedido: ${payload.orderNumber}`);
  }
  printer.println(`ID: ${payload.orderId}`);
  if (payload.brandSubdomain) {
    printer.println(`Marca: ${payload.brandSubdomain}`);
  }
  if (payload.branchName) {
    printer.println(`Local: ${payload.branchName}`);
  }
  printer.println(`Estado: ${payload.statusLabel}`);
  printer.drawLine();

  if (payload.customerName || payload.customerPhone) {
    printer.bold(true);
    printer.println('Cliente');
    printer.bold(false);
    if (payload.customerName) printer.println(payload.customerName);
    if (payload.customerPhone) printer.println(payload.customerPhone);
    printer.drawLine();
  }

  if (payload.deliveryMode) {
    printer.println(`Modalidad: ${payload.deliveryMode}`);
  }
  if (payload.deliveryAddress) {
    printer.println(`Dir: ${payload.deliveryAddress}`);
  }
  if (payload.deliveryAddressRef) {
    printer.println(`Ref: ${payload.deliveryAddressRef}`);
  }
  if (
    payload.deliveryMode ||
    payload.deliveryAddress ||
    payload.deliveryAddressRef
  ) {
    printer.drawLine();
  }

  printer.bold(true);
  printer.println('Items');
  printer.bold(false);
  for (const line of payload.items || []) {
    const mods =
      line.modifiers && line.modifiers.length
        ? ` (${line.modifiers.join(', ')})`
        : '';
    printer.println(
      `${line.quantity}x ${line.name}${mods}  ${money(line.lineTotal ?? line.unitPrice)}`,
    );
  }
  printer.drawLine();

  if (payload.productsSubtotal !== undefined) {
    printer.println(`Subtotal prod.: ${money(payload.productsSubtotal)}`);
  }
  if (payload.deliveryCost !== undefined) {
    printer.println(`Delivery: ${money(payload.deliveryCost)}`);
  }
  if (payload.discountAmount !== undefined && payload.discountAmount > 0) {
    printer.println(`Descuento: -${money(payload.discountAmount)}`);
  }
  if (payload.total !== undefined) {
    printer.bold(true);
    printer.println(`TOTAL: ${money(payload.total)}`);
    printer.bold(false);
  }
  if (payload.paymentLabel) {
    printer.println(`Pago: ${payload.paymentLabel}`);
  }
  if (payload.specialNotes) {
    printer.drawLine();
    printer.println(`Notas: ${payload.specialNotes}`);
  }

  printer.drawLine();
  printer.println(`Impreso: ${payload.printedAt}`);
  printer.println('');

  printer.cut();
  await printer.execute();
}
