import type { PrinterRow } from './printers';
import { UI_URL } from './ports';

export type PrintErrorContext = {
  printerName: string;
  printers: PrinterRow[];
  configPrinterName: string | null;
};

function osLabel(): string {
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'linux') return 'Linux';
  if (process.platform === 'darwin') return 'macOS';
  return 'el sistema';
}

/** Mensaje en español para el panel / operador */
export function toUserFacingPrintError(
  err: unknown,
  ctx: PrintErrorContext,
): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const name = ctx.printerName;
  const sys = osLabel();

  const installed = ctx.printers.some(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  const row = ctx.printers.find(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );

  if (lower.includes('no driver set')) {
    return (
      'El programa de impresión no está configurado correctamente. ' +
      'Descargue la versión más reciente del bridge o contacte a soporte.'
    );
  }

  if (lower.includes('no se encontró el comando lp')) {
    return (
      'CUPS no está instalado o lp no está en PATH. En Ubuntu/Debian: sudo apt install cups cups-client'
    );
  }

  if (
    lower.includes('unable to locate printer') ||
    lower.includes('unknown destination') ||
    lower.includes('does not exist')
  ) {
    return (
      `La impresora "${name}" no existe en CUPS. Abra ${UI_URL} y elija la impresora correcta (lpstat -a).`
    );
  }

  if (
    lower.includes('no hay impresora predeterminada') ||
    lower.includes('no se encontró ninguna impresora')
  ) {
    return (
      `No hay impresora configurada. Abra ${UI_URL}, elija una impresora y guarde, ` +
      `o defina una predeterminada en ${sys}.`
    );
  }

  if (!installed && ctx.printers.length === 0) {
    const cupsHint =
      process.platform === 'linux'
        ? ' Instale CUPS y verifique con lpstat -a.'
        : '';
    return (
      `${sys} no reporta impresoras instaladas. Conecte la impresora térmica${cupsHint} ` +
      `y vuelva a abrir ${UI_URL} para elegirla.`
    );
  }

  if (!installed) {
    return (
      `La impresora "${name}" ya no está en ${sys} (fue eliminada o renombrada). ` +
      `Abra ${UI_URL} y elija la impresora correcta.`
    );
  }

  if (row?.workOffline) {
    return (
      `La impresora "${name}" está marcada como fuera de línea. ` +
      'Verifique que esté encendida y conectada por USB o red.'
    );
  }

  if (row?.printerStatus === 7) {
    return (
      `La impresora "${name}" aparece desconectada o apagada. Enciéndala y revise el cable USB o la red.`
    );
  }

  if (
    lower.includes('openprinter failed') ||
    lower.includes('unable to open') ||
    lower.includes('printer error')
  ) {
    return (
      `No se pudo enviar el ticket a "${name}". Compruebe que la impresora esté encendida, ` +
      `conectada y seleccionada en ${UI_URL}.`
    );
  }

  if (lower.includes('raw-only') || lower.includes('could not be detected')) {
    return (
      `No se detecta una impresora térmica compatible con "${name}". ` +
      'Use una impresora ESC/POS instalada en el sistema, no solo "Print to PDF".'
    );
  }

  if (lower.includes('tiempo agotado') || lower.includes('timeout')) {
    return `La impresora "${name}" no respondió a tiempo. ¿Está encendida y con papel?`;
  }

  return `No se pudo imprimir en "${name}": ${raw}`;
}
