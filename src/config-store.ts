import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface BridgeUserConfig {
  /** Nombre exacto de la impresora en Windows, o null para usar la predeterminada del sistema */
  printerName: string | null;
  /** thermal = impresora térmica ESC/POS (default); regular = láser/inkjet vía PDF */
  printerType: 'thermal' | 'regular';
  /** Qué ticket imprimir automáticamente: full, kitchen o both (default: 'full') */
  autoTicketType?: 'full' | 'kitchen' | 'both';
  /** Persistido; sincronizado con app.setLoginItemSettings en Electron */
  openAtLogin?: boolean;
  /** Master switch de notificaciones nativas */
  showNotifications?: boolean;
  /** Toast al imprimir OK (default false — menos ruido en caja) */
  notifyOnSuccess?: boolean;
  /** Toast en error de impresión (default true) */
  notifyOnError?: boolean;
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
    const printerName =
      typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
    const validAutoTypes = ['full', 'kitchen', 'both'] as const;
    const autoTicketType = validAutoTypes.includes(j.autoTicketType as (typeof validAutoTypes)[number])
      ? (j.autoTicketType as 'full' | 'kitchen' | 'both')
      : 'full';
    return {
      printerName,
      printerType,
      autoTicketType,
      openAtLogin: j.openAtLogin ?? false,
      showNotifications: j.showNotifications ?? true,
      notifyOnSuccess: j.notifyOnSuccess ?? false,
      notifyOnError: j.notifyOnError ?? true,
    };
  } catch {
    return { printerName: null, printerType: 'thermal' };
  }
}

export function writeUserConfig(update: Partial<BridgeUserConfig>): void {
  const existing = readUserConfig();
  const merged = { ...existing, ...update };
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  const validAutoTypes = ['full', 'kitchen', 'both'] as const;
  const toWrite: BridgeUserConfig = {
    printerName:
      typeof merged.printerName === 'string' && merged.printerName.trim() !== ''
        ? merged.printerName.trim()
        : null,
    printerType: merged.printerType === 'regular' ? 'regular' : 'thermal',
    autoTicketType: validAutoTypes.includes(merged.autoTicketType as (typeof validAutoTypes)[number])
      ? (merged.autoTicketType as 'full' | 'kitchen' | 'both')
      : 'full',
    openAtLogin: merged.openAtLogin ?? false,
    showNotifications: merged.showNotifications ?? true,
    notifyOnSuccess: merged.notifyOnSuccess ?? false,
    notifyOnError: merged.notifyOnError ?? true,
  };
  fs.writeFileSync(configFilePath(), JSON.stringify(toWrite, null, 2), 'utf8');
}
