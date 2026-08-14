import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ThermalPrintPayload } from './types';
import { readUserConfig } from './config-store';
import { fileLog } from './file-logger';
import { sendRawToCupsPrinter } from './cups-raw-print';
import { sendRawToWindowsPrinter } from './win-raw-print';
import { sendPdfToPrinter } from './win-pdf-print';
import { buildTicketDocument } from './ticket-builder';
import { encodeTicketDocument } from './escpos-encoder';

const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildEscPosBuffer(payload: ThermalPrintPayload): Buffer {
  const spoolDir = path.join(os.tmpdir(), 'MaxyPrintBridge', 'build');
  fs.mkdirSync(spoolDir, { recursive: true });
  const dummyFile = path.join(spoolDir, 'escpos-build.bin');
  const lineWidth = readUserConfig().lineWidth ?? 48;
  const document = buildTicketDocument(payload, { lineWidth });
  return encodeTicketDocument(document, dummyFile);
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
  const config = readUserConfig();
  if (config.printerType === 'regular') {
    if (!payload.pdfBase64) {
      throw new Error(
        'Esta impresora está configurada como Láser/Inkjet y requiere PDF. ' +
          'Actualice el panel web a la última versión para enviar PDF automáticamente.',
      );
    }
    await sendPdfToPrinter(printerName, payload.pdfBase64);
    return;
  }
  await sendRawBuffer(printerName, buildEscPosBuffer(payload));
}

export async function printThermalPayload(
  payload: ThermalPrintPayload,
  printerName: string,
): Promise<void> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 1 + RETRY_ATTEMPTS; attempt += 1) {
    try {
      await executePrint(payload, printerName);
      fileLog.info(`impreso order=${payload.orderId} printer=${printerName} attempt=${attempt}`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      fileLog.warn(
        `fallo impresión attempt=${attempt}/${1 + RETRY_ATTEMPTS} order=${payload.orderId} printer=${printerName}: ${lastError.message}`,
      );
      if (attempt < 1 + RETRY_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
