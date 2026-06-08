import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BreakLine,
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from 'node-thermal-printer';
import type { DividerStyle, ThermalPrintPayload } from './types';
import { fileLog } from './file-logger';
import { sendRawToCupsPrinter } from './cups-raw-print';
import { sendRawToWindowsPrinter } from './win-raw-print';
import { sendPdfToPrinter } from './win-pdf-print';
import { readUserConfig } from './config-store';

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printDivider(printer: ThermalPrinter, style: DividerStyle | undefined): void {
  if (!style || style === 'none') return;
  printer.drawLine();
}

function money(n: number | undefined, sym: string = 'S/'): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  return `${sym} ${n.toFixed(2)}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}  ${hh}:${min}`;
}

// ─── Config resolver ─────────────────────────────────────────────────────────

import type { TicketTypeConfig } from './types';

function resolveConfig(payload: ThermalPrintPayload): TicketTypeConfig {
  const isKitchen = payload.ticketType === 'kitchen';
  const raw = isKitchen ? payload.ticketConfig?.kitchen : payload.ticketConfig?.full;
  const def: TicketTypeConfig = isKitchen
    ? {
        showHeader: true, headerTitle: '', headerStyle: 'bold',
        showOrderNumber: true, orderNumberOrder: -2,
        showDeliveryMode: true, deliveryModeOrder: -1,
        showOrderId: true, orderIdOrder: 0, orderIdStyle: 'bold',
        customer: { order: 1, visible: true, style: 'normal', showPhone: false, showAddress: false },
        items:    { order: 2, style: 'normal', showPrices: false },
        totals:   { order: 3, visible: false, style: 'normal' },
        payment:  { order: 4, visible: false, style: 'normal' },
        notes:    { order: 5, visible: true, style: 'inverted' },
        showFooter: true, footerLine1: '', footerLine2: '', footerStyle: 'normal',
      }
    : {
        showHeader: true, headerTitle: '', headerStyle: 'bold',
        showOrderNumber: true, orderNumberOrder: -2,
        showDeliveryMode: true, deliveryModeOrder: -1,
        showOrderId: true, orderIdOrder: 0, orderIdStyle: 'normal',
        customer: { order: 1, visible: true, style: 'normal', showPhone: true, showAddress: true },
        items:    { order: 2, style: 'normal', showPrices: true },
        totals:   { order: 3, visible: true, style: 'bold' },
        payment:  { order: 4, visible: true, style: 'normal' },
        notes:    { order: 5, visible: true, style: 'normal' },
        showFooter: true, footerLine1: '', footerLine2: '', footerStyle: 'normal',
      };
  if (!raw) return def;
  return {
    ...def, ...raw,
    customer: { ...def.customer, ...(raw.customer || {}) },
    items:    { ...def.items,    ...(raw.items    || {}) },
    totals:   { ...def.totals,   ...(raw.totals   || {}) },
    payment:  { ...def.payment,  ...(raw.payment  || {}) },
    notes:    { ...def.notes,    ...(raw.notes    || {}) },
  };
}

function resolveTicketTemplate(template: string, payload: ThermalPrintPayload): string {
  return template
    .replace(/\{nombre_marca\}/g, payload.brandName || payload.brandSubdomain || '')
    .replace(/\{nombre_local\}/g, payload.branchName || payload.brandName || payload.brandSubdomain || '')
    .replace(/\{pedido\}/g, payload.orderId || '');
}

// ─── ESC/POS buffer builder ───────────────────────────────────────────────────

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
  const sym = payload.currencySymbol || 'S/';
  const cfg = resolveConfig(payload);

  // Derived show/hide flags
  const showHeader  = cfg.showHeader  ?? true;
  const showFooter  = cfg.showFooter  ?? true;
  const showCustomer = cfg.customer.visible ?? true;
  const showPhone   = showCustomer && cfg.customer.showPhone && !!payload.customerPhone;
  const showRef     = cfg.showOrderId;
  const showPrices  = cfg.items.showPrices;
  const showTotals  = !isKitchen && cfg.totals.visible;
  const showPayment = !isKitchen && cfg.payment.visible  && !!payload.paymentLabel;
  const showNotes   = cfg.notes.visible;
  const showAddress = !isKitchen && cfg.customer.showAddress && (!!payload.deliveryAddress || !!payload.deliveryAddressRef);

  // ── ENCABEZADO: nombre del local ─────────────────────────────────────────
  if (showHeader) {
    const rawHeaderTitle = cfg.headerTitle?.trim()
      ? resolveTicketTemplate(cfg.headerTitle, payload)
      : (payload.brandName || payload.branchName || payload.brandSubdomain || (isKitchen ? 'COCINA' : 'TICKET'));
    printer.alignCenter();
    printer.bold(true);
    printer.println(rawHeaderTitle.toUpperCase());
    printer.bold(false);
    printer.alignLeft();
  }

  // ── SECCIONES ORDENADAS (incluye número de orden y modalidad) ────────────
  const dateStr = formatDate(payload.createdAt);
  const shortNumber = payload.orderNumber
    ? `#${payload.orderNumber.split('-').pop()}`
    : `#${payload.orderId.slice(-4)}`;
  const sections: { order: number; print: () => void }[] = [];

  // orderNumber
  if (cfg.showOrderNumber ?? true) {
    sections.push({
      order: cfg.orderNumberOrder ?? -2,
      print: () => {
        printDivider(printer, cfg.dividers?.orderNumber ?? 'solid');
        printer.alignCenter();
        printer.setTextSize(1, 1);
        printer.bold(true);
        printer.println(shortNumber);
        printer.bold(false);
        printer.setTextSize(0, 0);
        printer.alignLeft();
      },
    });
  }

  // deliveryMode
  if ((cfg.showDeliveryMode ?? true) && payload.deliveryMode) {
    sections.push({
      order: cfg.deliveryModeOrder ?? -1,
      print: () => {
        printDivider(printer, cfg.dividers?.deliveryMode ?? 'solid');
        printer.alignCenter();
        printer.bold(true);
        printer.println(payload.deliveryMode!.toUpperCase());
        printer.bold(false);
        printer.alignLeft();
      },
    });
  }

  // orderId
  if (showRef) {
    sections.push({
      order: cfg.orderIdOrder ?? 0,
      print: () => {
        printDivider(printer, cfg.dividers?.orderId ?? 'solid');
        printer.alignCenter();
        printer.println(`Ref: ${payload.orderNumber || payload.orderId}`);
        printer.alignLeft();
      },
    });
  }

  // customer
  if (showCustomer || showPhone) {
    sections.push({
      order: cfg.customer?.order ?? 1,
      print: () => {
        printDivider(printer, cfg.dividers?.customer ?? 'solid');
        printer.alignCenter();
        if (showCustomer && payload.customerName) {
          printer.bold(true);
          printer.println(payload.customerName);
          printer.bold(false);
        }
        if (showCustomer && dateStr) printer.println(dateStr);
        if (showPhone) printer.println(`Tel: ${payload.customerPhone}`);
        printer.alignLeft();
      },
    });
  }

  // items
  sections.push({
    order: cfg.items?.order ?? 2,
    print: () => {
      printDivider(printer, cfg.dividers?.items ?? 'solid');
      if (showPrices) {
        printer.tableCustom([
          { text: 'Cant.', align: 'LEFT', width: 0.15 },
          { text: 'Producto', align: 'LEFT', width: 0.55 },
          { text: 'Precio', align: 'RIGHT', width: 0.30 },
        ]);
      } else {
        printer.tableCustom([
          { text: 'Cant.', align: 'LEFT', width: 0.20 },
          { text: 'Producto', align: 'LEFT', width: 0.80 },
        ]);
      }
      printer.drawLine();
      for (const item of payload.items || []) {
        const lineTotal = item.lineTotal ?? (item.unitPrice !== undefined ? item.quantity * item.unitPrice : undefined);
        if (showPrices) {
          printer.tableCustom([
            { text: String(item.quantity), align: 'LEFT', width: 0.15 },
            { text: item.name, align: 'LEFT', width: 0.55 },
            { text: lineTotal !== undefined ? lineTotal.toFixed(2) : '', align: 'RIGHT', width: 0.30 },
          ]);
        } else {
          printer.tableCustom([
            { text: String(item.quantity), align: 'LEFT', width: 0.20 },
            { text: item.name, align: 'LEFT', width: 0.80 },
          ]);
        }
        for (const mod of item.modifiers || []) printer.println(`  + ${mod}`);
        if (item.notes) printer.println(`  ★ ${item.notes}`);
      }
    },
  });

  // notes
  if (showNotes && payload.specialNotes) {
    sections.push({
      order: cfg.notes?.order ?? 5,
      print: () => {
        printDivider(printer, cfg.dividers?.notes ?? 'solid');
        printer.bold(true);
        printer.println('★ Notas del pedido:');
        printer.bold(false);
        printer.println(payload.specialNotes!);
      },
    });
  }

  // totals
  if (showTotals) {
    sections.push({
      order: cfg.totals?.order ?? 3,
      print: () => {
        printDivider(printer, cfg.dividers?.totals ?? 'solid');
        if (payload.productsSubtotal !== undefined) printer.leftRight('Subtotal', money(payload.productsSubtotal, sym));
        if (payload.deliveryCost !== undefined && payload.deliveryCost > 0) printer.leftRight('Delivery', money(payload.deliveryCost, sym));
        if (payload.discountAmount !== undefined && payload.discountAmount > 0) printer.leftRight('Descuento', `-${money(payload.discountAmount, sym)}`);
        if (payload.total !== undefined) {
          printer.bold(true);
          printer.leftRight('TOTAL', money(payload.total, sym));
          printer.bold(false);
        }
        if (showPayment) printer.println(`Pago: ${payload.paymentLabel}`);
      },
    });
  }

  sections.sort((a, b) => a.order - b.order).forEach((s) => s.print());

  // ── RESUMEN (siempre al final del cuerpo) ─────────────────────────────────
  if (payload.summary) {
    printer.drawLine();
    printer.bold(true);
    printer.println('Resumen:');
    printer.bold(false);
    printer.println(payload.summary);
  }

  // ── DIRECCIÓN ─────────────────────────────────────────────────────────────
  if (showAddress) {
    printDivider(printer, cfg.dividers?.address ?? 'solid');
    printer.bold(true);
    printer.println('Direccion:');
    printer.bold(false);
    if (payload.deliveryAddress) printer.println(payload.deliveryAddress);
    if (payload.deliveryAddressRef) {
      printer.println('Referencia:');
      printer.println(payload.deliveryAddressRef);
    }
  }

  // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
  if (showFooter && (cfg.footerLine1 || cfg.footerLine2)) {
    printDivider(printer, cfg.dividers?.footer ?? 'solid');
    if (cfg.footerLine1) printer.println(resolveTicketTemplate(cfg.footerLine1, payload));
    if (cfg.footerLine2) printer.println(resolveTicketTemplate(cfg.footerLine2, payload));
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

async function sendRawBuffer(printerName: string, buffer: Buffer): Promise<void> {
  if (process.platform === 'win32') {
    await sendRawToWindowsPrinter(printerName, buffer);
    return;
  }
  if (process.platform === 'linux' || process.platform === 'darwin') {
    await sendRawToCupsPrinter(printerName, buffer);
    return;
  }
  throw new Error(`Plataforma no soportada para impresión: ${process.platform}`);
}

async function executePrint(
  payload: ThermalPrintPayload,
  printerName: string,
): Promise<void> {
  const cfg = readUserConfig();
  if (cfg.printerType === 'regular') {
    if (!payload.pdfBase64) {
      throw new Error(
        'Esta impresora está configurada como Láser/Inkjet y requiere PDF. ' +
        'Actualice el panel web a la última versión para enviar PDF automáticamente.',
      );
    }
    await sendPdfToPrinter(printerName, payload.pdfBase64);
    return;
  }
  const buffer = buildEscPosBuffer(payload);
  await sendRawBuffer(printerName, buffer);
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
