import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { configDir } from './config-store';
import { fileLog } from './file-logger';

const execFileAsync = promisify(execFile);

// SumatraPDF portable — open source (GPLv3), sin dependencias, sin GPU.
// CLI: SumatraPDF.exe -print-to "Printer Name" -silent file.pdf
const SUMATRA_EXE = 'SumatraPDF.exe';

// Obtiene la versión del último release de SumatraPDF desde GitHub
// (el tag es ej. "3.6.1rel") y construye la URL de descarga oficial.
// SumatraPDF distribuye en su propio CDN: sumatrapdfreader.org/dl/rel/{ver}/SumatraPDF-{ver}-64.exe
function getSumatraDownloadUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/sumatrapdfreader/sumatrapdf/releases/latest',
      headers: { 'User-Agent': 'maxy-print-bridge' },
      timeout: 10000,
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += String(chunk); });
      res.on('end', () => {
        try {
          const release = JSON.parse(data) as { tag_name?: string };
          const tag = release.tag_name ?? '';
          // Tag es "3.6.1rel" → versión "3.6.1"
          const version = tag.replace(/rel$/i, '').trim();
          if (!version || !/^\d+\.\d+/.test(version)) {
            reject(new Error(`Tag de release inesperado: "${tag}"`));
            return;
          }
          resolve(
            `https://www.sumatrapdfreader.org/dl/rel/${version}/SumatraPDF-${version}-64.exe`,
          );
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout consultando versión de SumatraPDF'));
    });
  });
}

// Sigue redirecciones HTTP (GitHub redirect → objects.githubusercontent.com)
function downloadWithRedirects(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl: string, redirectsLeft: number) => {
      const mod = currentUrl.startsWith('https') ? https : require('http') as typeof https;
      const req = mod.get(currentUrl, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error('Demasiadas redirecciones al descargar SumatraPDF'));
            return;
          }
          attempt(res.headers.location, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Descarga falló con código ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout descargando SumatraPDF')); });
    };
    attempt(url, 5);
  });
}

async function ensureSumatraPdf(): Promise<string> {
  const dest = path.join(configDir(), SUMATRA_EXE);
  if (fs.existsSync(dest)) return dest;

  fileLog.info('Descargando SumatraPDF para impresión PDF (primera vez, ~6 MB)...');
  const url = await getSumatraDownloadUrl();
  fileLog.info(`SumatraPDF URL: ${url}`);
  const tmp = dest + '.tmp';
  try {
    await downloadWithRedirects(url, tmp);
    fs.renameSync(tmp, dest);
    fileLog.info(`SumatraPDF listo en ${dest}`);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }
  return dest;
}

export async function sendPdfToPrinter(
  printerName: string,
  pdfBase64: string,
): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Impresión PDF solo está disponible en Windows.');
  }

  const spoolDir = path.join(os.tmpdir(), 'MaxyPrintBridge', 'spool');
  fs.mkdirSync(spoolDir, { recursive: true });
  const pdfPath = path.join(spoolDir, `job-${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, Buffer.from(pdfBase64, 'base64'));

  let sumatraPath: string;
  try {
    sumatraPath = await ensureSumatraPdf();
  } catch (err) {
    throw new Error(
      `No se pudo obtener SumatraPDF para imprimir: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const { stderr } = await execFileAsync(
      sumatraPath,
      ['-print-to', printerName, '-silent', pdfPath],
      { timeout: 60000, windowsHide: true },
    );

    if (stderr?.trim()) {
      throw new Error(stderr.trim());
    }

    fileLog.info(`PDF impreso en "${printerName}" vía SumatraPDF`);
  } catch (err: unknown) {
    const e = err as { killed?: boolean; stderr?: string; message?: string; code?: number };
    if (e.killed) {
      throw new Error('Tiempo agotado al enviar el PDF a la impresora.');
    }
    // SumatraPDF exit code 1 = error, pero el mensaje ya viene en stderr
    const msg = e.stderr?.trim() || (err instanceof Error ? err.message : String(err));
    throw new Error(msg);
  } finally {
    try { fs.unlinkSync(pdfPath); } catch { /* ignore */ }
  }
}
