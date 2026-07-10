/**
 * Genera src/bridge-token.ts a partir de PRINT_BRIDGE_TOKEN en .env.
 * Corre automáticamente antes de dev/build/build:electron (ver package.json).
 * src/bridge-token.ts está en .gitignore — nunca se commitea el token.
 *
 * Uso: node scripts/generate-bridge-token.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'src', 'bridge-token.ts');

function readTokenFromEnv() {
  if (!fs.existsSync(envPath)) return null;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== 'PRINT_BRIDGE_TOKEN') continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}

const token = readTokenFromEnv();

if (!token) {
  console.error('[generate-bridge-token] Falta PRINT_BRIDGE_TOKEN en .env');
  console.error('  Agregá la línea: PRINT_BRIDGE_TOKEN=<valor> a .env (ver .env.example)');
  console.error('  Debe coincidir byte a byte con VITE_PRINT_BRIDGE_TOKEN del panel.');
  process.exit(1);
}

const content = `// Generado automáticamente por scripts/generate-bridge-token.mjs a partir de PRINT_BRIDGE_TOKEN en .env
// NO editar a mano — este archivo está en .gitignore y se regenera en cada dev/build.
// Para cambiar el token: editá .env y volvé a correr npm run dev / build / build:electron.

/**
 * Debe coincidir exactamente con VITE_PRINT_BRIDGE_TOKEN horneado en el build del panel.
 * No es secreto criptográfico fuerte (vive en el bundle JS del panel) — es defensa
 * en profundidad sobre el allowlist de Origin, no el control principal.
 */
export const PRINT_BRIDGE_SHARED_TOKEN = ${JSON.stringify(token)};
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('[generate-bridge-token] src/bridge-token.ts generado desde .env');
