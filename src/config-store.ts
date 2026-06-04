import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BridgeUserConfig {
  /** Nombre exacto de la impresora en Windows, o null para usar la predeterminada del sistema */
  printerName: string | null;
  /** thermal = impresora térmica ESC/POS (default); regular = láser/inkjet vía PDF */
  printerType: 'thermal' | 'regular';
}

export function configDir(): string {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'MaxyPrintBridge');
  }
  return path.join(os.homedir(), '.maxy-print-bridge');
}

export function configFilePath(): string {
  return path.join(configDir(), 'config.json');
}

export function readUserConfig(): BridgeUserConfig {
  try {
    const p = configFilePath();
    if (!fs.existsSync(p)) {
      return { printerName: null, printerType: 'thermal' };
    }
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw) as Partial<BridgeUserConfig>;
    const name = j.printerName;
    const printerType = j.printerType === 'regular' ? 'regular' : 'thermal';
    if (typeof name === 'string' && name.trim() !== '') {
      return { printerName: name.trim(), printerType };
    }
    return { printerName: null, printerType };
  } catch {
    return { printerName: null, printerType: 'thermal' };
  }
}

export function writeUserConfig(cfg: BridgeUserConfig): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  const toWrite: BridgeUserConfig = {
    printerName:
      typeof cfg.printerName === 'string' && cfg.printerName.trim() !== ''
        ? cfg.printerName.trim()
        : null,
    printerType: cfg.printerType === 'regular' ? 'regular' : 'thermal',
  };
  fs.writeFileSync(configFilePath(), JSON.stringify(toWrite, null, 2), 'utf8');
}
