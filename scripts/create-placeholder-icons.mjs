/**
 * Genera iconos placeholder en assets/ para desarrollo.
 * Los iconos de producción deben reemplazarse con diseño real antes del release.
 *
 * Uso: node scripts/create-placeholder-icons.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

// ── PNG builder ───────────────────────────────────────────────────────────────

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function createSolidPng(width, height, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowBytes] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const i = y * rowBytes + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createIcoFromPng(pngBuf, width, height) {
  const iconDir = Buffer.allocUnsafe(6);
  iconDir.writeUInt16LE(0, 0);
  iconDir.writeUInt16LE(1, 2);
  iconDir.writeUInt16LE(1, 4);

  const imageOffset = 6 + 16;
  const entry = Buffer.allocUnsafe(16);
  entry[0] = width;
  entry[1] = height;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(imageOffset, 12);

  return Buffer.concat([iconDir, entry, pngBuf]);
}

// ── Generate icons ────────────────────────────────────────────────────────────

const ICONS = [
  { name: 'icon-tray-ready.png',    r: 34,  g: 197, b: 94  },  // green
  { name: 'icon-tray-warn.png',     r: 234, g: 179, b: 8   },  // amber
  { name: 'icon-tray-error.png',    r: 239, g: 68,  b: 68  },  // red
  { name: 'icon-tray-printing.png', r: 59,  g: 130, b: 246 },  // blue
  { name: 'icon-512.png',           r: 34,  g: 197, b: 94  },  // macOS/Linux app icon
];

fs.mkdirSync(assetsDir, { recursive: true });

for (const { name, r, g, b } of ICONS) {
  const size = name === 'icon-512.png' ? 512 : 16;
  const png = createSolidPng(size, size, r, g, b);
  fs.writeFileSync(path.join(assetsDir, name), png);
  console.log(`  created ${name}`);
}

// icon.ico — ICO con 3 tamaños: 16x16, 32x32, 256x256 (electron-builder requiere ≥256)
const ico16  = createSolidPng(16,  16,  34, 197, 94);
const ico32  = createSolidPng(32,  32,  34, 197, 94);
const ico256 = createSolidPng(256, 256, 34, 197, 94);

function createMultiIco(entries) {
  const count = entries.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * count;

  const header = Buffer.allocUnsafe(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let currentOffset = dataOffset;
  const entryBuffers = [];
  for (const { png, width, height } of entries) {
    const entry = Buffer.allocUnsafe(16);
    entry[0] = width === 256 ? 0 : width;   // 0 = 256 in ICO spec
    entry[1] = height === 256 ? 0 : height;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(currentOffset, 12);
    entryBuffers.push(entry);
    currentOffset += png.length;
  }

  return Buffer.concat([header, ...entryBuffers, ...entries.map(e => e.png)]);
}

const icoData = createMultiIco([
  { png: ico16,  width: 16,  height: 16  },
  { png: ico32,  width: 32,  height: 32  },
  { png: ico256, width: 256, height: 256 },
]);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoData);
console.log('  created icon.ico (16×16 + 32×32 + 256×256)');

console.log(`\n[create-placeholder-icons] Done → ${assetsDir}`);
console.log('  Replace with real icons before release.');
