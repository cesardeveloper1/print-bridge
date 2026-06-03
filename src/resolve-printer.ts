import { readUserConfig } from './config-store';
import {
  getWindowsDefaultPrinterName,
  listWindowsPrinters,
  type WindowsPrinterRow,
} from './windows-printers';
import { UI_URL } from './ports';

export type ResolvedPrinter = {
  printerName: string;
  printers: WindowsPrinterRow[];
  configPrinterName: string | null;
};

export function resolvePrinterForPrint(): ResolvedPrinter {
  const cfg = readUserConfig();
  const printers = listWindowsPrinters();
  let printerName: string | null = cfg.printerName;

  if (!printerName) {
    printerName = getWindowsDefaultPrinterName();
  }

  if (!printerName) {
    if (printers.length === 0) {
      throw new Error(
        'No se encontró ninguna impresora instalada en Windows. Conecte la impresora térmica e instale su driver.',
      );
    }
    throw new Error(
      `No hay impresora predeterminada en Windows. Abra ${UI_URL} y elija una impresora, o defina una predeterminada en Configuración de Windows.`,
    );
  }

  return {
    printerName,
    printers,
    configPrinterName: cfg.printerName,
  };
}
