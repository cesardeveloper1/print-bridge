import * as path from 'path';
import { app, nativeImage, type Tray } from 'electron';
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
  // app.getAppPath() resolves to the project root in dev and to
  // resources/app.asar when packaged — assets/ sits at the root of both,
  // since electron-builder's `files` config bundles it inside the asar.
  // (process.resourcesPath + 'assets' is wrong: nothing copies assets there,
  // they end up inside app.asar instead.)
  return path.join(app.getAppPath(), 'assets');
}

export function getIconForState(state: BridgeState): Electron.NativeImage {
  const iconFile = ICON_NAMES[state];
  const iconPath = path.join(assetsDir(), iconFile);
  const img = nativeImage.createFromPath(iconPath);
  // Fallback: empty image if file not found (avoids crash during development)
  if (img.isEmpty()) return nativeImage.createEmpty();
  // Windows tray expects 16x16. Only resize when needed: Electron's resize()
  // can flatten transparent pixels to black on Windows, so avoid it on
  // sources that are already the right size.
  const { width, height } = img.getSize();
  if (width === 16 && height === 16) return img;
  return img.resize({ width: 16, height: 16, quality: 'best' });
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
