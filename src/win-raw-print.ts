import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { ensureSendRawPrintScript } from './send-raw-print-script';

const execFileAsync = promisify(execFile);

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

  const scriptPath = ensureSendRawPrintScript();

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
