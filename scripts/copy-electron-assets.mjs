import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcAssets = path.join(root, 'assets');
const destAssets = path.join(root, 'dist', 'electron', 'assets');

if (!fs.existsSync(srcAssets)) {
  console.error(`[copy-electron-assets] assets/ not found at ${srcAssets}`);
  console.error('  Run: node scripts/create-placeholder-icons.mjs');
  process.exit(1);
}

fs.mkdirSync(destAssets, { recursive: true });

let copied = 0;
for (const file of fs.readdirSync(srcAssets)) {
  fs.copyFileSync(path.join(srcAssets, file), path.join(destAssets, file));
  console.log(`  copied ${file}`);
  copied++;
}

console.log(`[copy-electron-assets] ${copied} file(s) → dist/electron/assets/`);
