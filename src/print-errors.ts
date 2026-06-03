import type { WindowsPrinterRow } from './windows-printers';
import { UI_URL } from './ports';

export type PrintErrorContext = {
  printerName: string;
  printers: WindowsPrinterRow[];
  configPrinterName: string | null;
};

/** Mensaje en español para el panel / operador */
export function toUserFacingPrintError(
  err: unknown,
  ctx: PrintErrorContext,
): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const name = ctx.printerName;

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

  if (
    lower.includes('no hay impresora predeterminada') ||
    lower.includes('no se encontró ninguna impresora')
  ) {
    return (
      `No hay impresora configurada. Abra ${UI_URL}, elija una impresora y guarde, ` +
      'o defina una predeterminada en Windows.'
    );
  }

  if (!installed && ctx.printers.length === 0) {
    return (
      'Windows no reporta impresoras instaladas. Conecte la impresora térmica, instale su driver ' +
      `y vuelva a abrir ${UI_URL} para elegirla.`
    );
  }

  if (!installed) {
    return (
      `La impresora "${name}" ya no está en Windows (fue eliminada o renombrada). ` +
      `Abra ${UI_URL} y elija la impresora correcta.`
    );
  }

  if (row?.workOffline) {
    return (
      `La impresora "${name}" está marcada como fuera de línea en Windows. ` +
      'Verifique que esté encendida, conectada por USB o red, y que no esté en "Usar impresora sin conexión".'
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
      'Use una impresora ESC/POS instalada en Windows, no solo "Microsoft Print to PDF".'
    );
  }

  if (lower.includes('tiempo agotado') || lower.includes('timeout')) {
    return `La impresora "${name}" no respondió a tiempo. ¿Está encendida y con papel?`;
  }

  return `No se pudo imprimir en "${name}": ${raw}`;
}
