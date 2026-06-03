import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function assertCupsPlatform(): void {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error('Impresión CUPS solo está disponible en Linux y macOS.');
  }
}

/** Envía bytes ESC/POS RAW a una impresora CUPS (`lp -d NOMBRE -o raw`). */
export async function sendRawToCupsPrinter(
  printerName: string,
  data: Buffer,
): Promise<void> {
  assertCupsPlatform();

  const dir = path.join(os.tmpdir(), 'MaxyPrintBridge', 'spool');
  fs.mkdirSync(dir, { recursive: true });
  const binPath = path.join(dir, `job-${Date.now()}.bin`);
  fs.writeFileSync(binPath, data);

  try {
    await execFileAsync(
      'lp',
      ['-d', printerName, '-o', 'raw', binPath],
      { timeout: 20000 },
    );
  } catch (err: unknown) {
    const e = err as {
      killed?: boolean;
      stderr?: string;
      message?: string;
      code?: string;
    };
    if (e.killed) {
      throw new Error('Tiempo agotado al enviar datos a la impresora CUPS.');
    }
    if (e.code === 'ENOENT') {
      throw new Error(
        'No se encontró el comando lp. Instale CUPS (p. ej. sudo apt install cups cups-client).',
      );
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
