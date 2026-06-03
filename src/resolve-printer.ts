import { readUserConfig } from './config-store';
import {
  getDefaultPrinterName,
  listPrinters,
  type PrinterRow,
} from './printers';
import { UI_URL } from './ports';

export type ResolvedPrinter = {
  printerName: string;
  printers: PrinterRow[];
  configPrinterName: string | null;
};

function osLabel(): string {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'linux') return 'Linux (CUPS)';
  if (process.platform === 'darwin') return 'macOS (CUPS)';
  return 'el sistema';
}

export function resolvePrinterForPrint(): ResolvedPrinter {
  const cfg = readUserConfig();
  const printers = listPrinters();
  let printerName: string | null = cfg.printerName;

  if (!printerName) {
    printerName = getDefaultPrinterName();
  }

  if (!printerName) {
    if (printers.length === 0) {
      const cupsHint =
        process.platform === 'linux'
          ? ' Instale CUPS (sudo apt install cups cups-client) y agregue la impresora térmica.'
          : '';
      throw new Error(
        `No se encontró ninguna impresora instalada en ${osLabel()}. Conecte la impresora térmica${cupsHint}`,
      );
    }
    throw new Error(
      `No hay impresora predeterminada en ${osLabel()}. Abra ${UI_URL} y elija una impresora, o defina una predeterminada en el sistema.`,
    );
  }

  return {
    printerName,
    printers,
    configPrinterName: cfg.printerName,
  };
}
