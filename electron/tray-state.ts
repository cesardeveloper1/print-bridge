import * as path from 'path';
import { nativeImage, type Tray } from 'electron';
import type { BridgeStatus, BridgeState } from '../src/bridge-events';

const ICON_NAMES: Record<BridgeState, string> = {
  starting:    'icon-tray-ready.png',
  ready:       'icon-tray-ready.png',
  'no-printer':'icon-tray-warn.png',
  printing:    'icon-tray-printing.png',
  error:       'icon-tray-error.png',
};

const STATE_LABELS: Record<BridgeState, string> = {
  starting:    'Iniciando…',
  ready:       'Activo',
  'no-printer':'Sin impresora configurada',
  printing:    'Imprimiendo…',
  error:       'Error — ver menú',
};

function assetsDir(): string {
  // In packaged app: resources/assets; in dev: project/assets
  if (process.env.NODE_ENV === 'development' || !process.resourcesPath) {
    return path.join(__dirname, '..', 'assets');
  }
  return path.join(process.resourcesPath, 'assets');
}

export function getIconForState(state: BridgeState): Electron.NativeImage {
  const iconFile = ICON_NAMES[state];
  const iconPath = path.join(assetsDir(), iconFile);
  const img = nativeImage.createFromPath(iconPath);
  // Fallback: empty image if file not found (avoids crash during development)
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

export function buildTooltip(status: BridgeStatus): string {
  const stateLabel = STATE_LABELS[status.state];
  const printer = status.printerName ?? 'Sin configurar';
  // Windows tooltip max ~128 chars — keep it short
  const base = `Maxy Print Bridge — ${stateLabel}`;
  const detail = `Impresora: ${printer}`;
  const full = `${base}\n${detail}`;
  return full.length > 127 ? `${full.slice(0, 124)}…` : full;
}

export function applyStatusToTray(tray: Tray, status: BridgeStatus): void {
  tray.setImage(getIconForState(status.state));
  tray.setToolTip(buildTooltip(status));
}
