/**
 * Pre-popula el cache de winCodeSign de electron-builder saltando symlinks de macOS.
 * Necesario en Windows sin Developer Mode habilitado.
 * Ejecutar una sola vez: node scripts/setup-win-build-cache.mjs
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, createWriteStream, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir, homedir } from 'os';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION = 'winCodeSign-2.6.0';
const DOWNLOAD_URL =
  `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`;

const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
const cacheDir = join(localAppData, 'electron-builder', 'Cache', 'winCodeSign', VERSION);
const tempFile = join(tmpdir(), `${VERSION}.7z`);
const sevenZa = join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');

if (existsSync(cacheDir)) {
  console.log(`[setup-win-build-cache] Cache ya existe: ${cacheDir}`);
  console.log('Nada que hacer. Puedes ejecutar: npm run dist:win');
  process.exit(0);
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    function get(u) {
      https.get(u, { headers: { 'User-Agent': 'node' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} al descargar ${u}`));
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    }
    get(url);
  });
}

console.log(`[setup-win-build-cache] Descargando ${VERSION}.7z (~5.6 MB)...`);
await downloadFile(DOWNLOAD_URL, tempFile);
console.log('[setup-win-build-cache] Extrayendo (omitiendo symlinks de macOS)...');

mkdirSync(cacheDir, { recursive: true });

// 7-zip retorna código 2 (warning) cuando hay symlinks que no puede crear en Windows.
// Los archivos win/ SÍ se extraen correctamente — solo fallan los symlinks de macOS/linux
// que no necesitamos. Aceptamos código 0 y 2 como éxito.
const result = spawnSync(sevenZa, ['x', '-bd', tempFile, `-o${cacheDir}`], {
  stdio: 'inherit',
});

if (result.status !== 0 && result.status !== 2) {
  console.error(`\n[setup-win-build-cache] Error: 7-zip salió con código ${result.status}`);
  process.exit(result.status ?? 1);
}

// Verificar que los binarios de Windows se extrajeron
const winDir = join(cacheDir, 'win');
if (!existsSync(winDir)) {
  console.error(`\n[setup-win-build-cache] Error: no se encontró ${winDir}`);
  console.error('Prueba ejecutando la terminal como Administrador.');
  process.exit(1);
}

try { unlinkSync(tempFile); } catch { /* ignore */ }

console.log(`\n[setup-win-build-cache] Listo → ${cacheDir}`);
console.log('Los symlinks de macOS/linux se omitieron (no los necesitas para compilar en Windows).');
console.log('Ahora puedes ejecutar: npm run dist:win');
