import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from 'node-thermal-printer';
import type { ThermalPrintPayload } from './types';
import { fileLog } from './file-logger';
import { sendRawToWindowsPrinter } from './win-raw-print';

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function money(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(2);
}

function buildEscPosBuffer(payload: ThermalPrintPayload): Buffer {
  const spoolDir = path.join(os.tmpdir(), 'MaxyPrintBridge', 'build');
  fs.mkdirSync(spoolDir, { recursive: true });
  const dummyFile = path
    .join(spoolDir, 'escpos-build.bin')
    .replace(/\\/g, '/');

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `file://${dummyFile}`,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    breakLine: BreakLine.WORD,
  });

  const isKitchen = payload.ticketType === 'kitchen';

  printer.alignCenter();
  printer.bold(true);
  printer.println(isKitchen ? 'MAXY — COCINA' : 'MAXY — TICKET');
  printer.bold(false);
  printer.drawLine();
  printer.alignLeft();

  if (!isKitchen) {
    const title =
      payload.triggerStatus === 'PREORDER' ? 'PRE-ORDEN' : 'ORDEN ACEPTADA';
    printer.bold(true);
    printer.println(title);
    printer.bold(false);
  } else {
    printer.bold(true);
    printer.println('TICKET DE COCINA');
    printer.bold(false);
  }

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
  if (!isKitchen) {
    if (payload.deliveryAddress) {
      printer.println(`Dir: ${payload.deliveryAddress}`);
    }
    if (payload.deliveryAddressRef) {
      printer.println(`Ref: ${payload.deliveryAddressRef}`);
    }
  }
  if (
    payload.deliveryMode ||
    (!isKitchen &&
      (payload.deliveryAddress || payload.deliveryAddressRef))
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
    if (isKitchen) {
      printer.println(`${line.quantity}x ${line.name}${mods}`);
    } else {
      printer.println(
        `${line.quantity}x ${line.name}${mods}  ${money(line.lineTotal ?? line.unitPrice)}`,
      );
    }
  }
  printer.drawLine();

  if (!isKitchen) {
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
  }
  if (payload.specialNotes) {
    printer.drawLine();
    printer.println(`Notas: ${payload.specialNotes}`);
  }

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

async function executePrint(
  payload: ThermalPrintPayload,
  printerName: string,
): Promise<void> {
  const buffer = buildEscPosBuffer(payload);
  await sendRawToWindowsPrinter(printerName, buffer);
}

export async function printThermalPayload(
  payload: ThermalPrintPayload,
  printerName: string,
): Promise<void> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 1 + RETRY_ATTEMPTS; attempt++) {
    try {
      await executePrint(payload, printerName);
      fileLog.info(
        `impreso order=${payload.orderId} printer=${printerName} attempt=${attempt}`,
      );
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      fileLog.warn(
        `fallo impresión attempt=${attempt}/${1 + RETRY_ATTEMPTS} order=${payload.orderId} printer=${printerName}: ${lastError.message}`,
      );
      if (attempt < 1 + RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}
