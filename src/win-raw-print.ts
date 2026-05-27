import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function resolvePsScriptPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'scripts', 'send-raw-print.ps1'),
    path.join(process.cwd(), 'scripts', 'send-raw-print.ps1'),
    path.join(path.dirname(process.execPath), 'scripts', 'send-raw-print.ps1'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    'No se encontró send-raw-print.ps1. Reinstale el programa de impresión.',
  );
}

export async function sendRawToWindowsPrinter(
  printerName: string,
  data: Buffer,
): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Impresión RAW solo está disponible en Windows.');
  }

  const dir = path.join(os.tmpdir(), 'MaxyPrintBridge', 'spool');
  fs.mkdirSync(dir, { recursive: true });
  const binPath = path.join(dir, `job-${Date.now()}.bin`);
  fs.writeFileSync(binPath, data);

  const scriptPath = resolvePsScriptPath();

  try {
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-PrinterName',
        printerName,
        '-FilePath',
        binPath,
      ],
      { timeout: 20000, windowsHide: true },
    );
    if (stderr?.trim()) {
      throw new Error(stderr.trim());
    }
    if (!String(stdout).includes('OK')) {
      throw new Error(stderr?.trim() || 'La impresora no confirmó el trabajo.');
    }
  } catch (err: unknown) {
    const e = err as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (e.killed) {
      throw new Error('Tiempo agotado al enviar datos a la impresora.');
    }
    const msg = e.stderr?.trim() || (err instanceof Error ? err.message : String(err));
    throw new Error(msg);
  } finally {
    try {
      fs.unlinkSync(binPath);
    } catch {
      /* ignore */
    }
  }
}
