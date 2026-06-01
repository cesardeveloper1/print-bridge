/**
 * Copia el binario pkg a maxy-print-bridge-win.exe (sin rcedit ni firma de código).
 */
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const releaseDir = join(root, 'release');
const unsignedPath = join(releaseDir, 'maxy-print-bridge-win-unsigned.exe');
const finalPath = join(releaseDir, 'maxy-print-bridge-win.exe');

if (process.platform !== 'win32') {
  console.log('publish-win-exe: omitido (solo Windows)');
  process.exit(0);
}

mkdirSync(releaseDir, { recursive: true });

if (!existsSync(unsignedPath)) {
  console.error(`Falta ${unsignedPath}. Ejecute npm run pkg:win de nuevo.`);
  process.exit(1);
}

copyFileSync(unsignedPath, finalPath);

try {
  unlinkSync(unsignedPath);
} catch {
  /* ignore */
}

console.log(`Listo: ${finalPath}`);
