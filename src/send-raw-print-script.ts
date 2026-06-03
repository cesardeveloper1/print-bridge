import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileLog } from './file-logger';

const SCRIPT_NAME = 'send-raw-print.ps1';

/** Copia estable en disco para PowerShell -File (requerido en .exe empaquetado con pkg). */
export function getTempScriptPath(): string {
  return path.join(os.tmpdir(), 'MaxyPrintBridge', SCRIPT_NAME);
}

const BUNDLE_RELATIVE = [
  path.join(__dirname, '..', 'scripts', SCRIPT_NAME),
  path.join(__dirname, '..', '..', 'scripts', SCRIPT_NAME),
];

const DISK_CANDIDATES = [
  ...BUNDLE_RELATIVE,
  path.join(process.cwd(), 'scripts', SCRIPT_NAME),
  path.join(path.dirname(process.execPath), 'scripts', SCRIPT_NAME),
];

let cachedScriptPath: string | null = null;

function readBundledScript(): Buffer | null {
  for (const src of BUNDLE_RELATIVE) {
    try {
      return fs.readFileSync(src);
    } catch {
      /* siguiente candidato (dev / pkg snapshot) */
    }
  }
  return null;
}

function writeTempCopy(content: Buffer): string {
  const dest = getTempScriptPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  return dest;
}

/**
 * Ruta real al .ps1 para impresión RAW en Windows.
 * En .exe: extrae el asset empaquetado a %TEMP%\\MaxyPrintBridge\\.
 */
export function ensureSendRawPrintScript(): string {
  if (cachedScriptPath && fs.existsSync(cachedScriptPath)) {
    return cachedScriptPath;
  }

  for (const p of DISK_CANDIDATES) {
    if (fs.existsSync(p)) {
      cachedScriptPath = p;
      return p;
    }
  }

  const tempPath = getTempScriptPath();
  if (fs.existsSync(tempPath)) {
    cachedScriptPath = tempPath;
    return tempPath;
  }

  const bundled = readBundledScript();
  if (!bundled) {
    throw new Error(
      'No se encontró send-raw-print.ps1. Reinstale el programa de impresión.',
    );
  }

  cachedScriptPath = writeTempCopy(bundled);
  const viaPkg = Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);
  fileLog.info(
    `send-raw-print.ps1 listo en ${cachedScriptPath}${viaPkg ? ' (extraído del .exe)' : ''}`,
  );
  return cachedScriptPath;
}

/** Precalienta el script al arrancar (evita fallo en la primera impresión). */
export function warmupSendRawPrintScript(): void {
  if (process.platform !== 'win32') return;
  try {
    ensureSendRawPrintScript();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fileLog.warn(`warmup send-raw-print.ps1: ${msg}`);
  }
}
