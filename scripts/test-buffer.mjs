import os from 'os';
import path from 'path';
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';

const tmp = path.join(os.tmpdir(), 'maxy-bridge-test.bin').replace(/\\/g, '/');
const p = new ThermalPrinter({ type: PrinterTypes.EPSON, interface: `file://${tmp}` });
p.println('hello');
p.cut();
const buf = p.getBuffer();
console.log('buffer', buf ? buf.length : null);
