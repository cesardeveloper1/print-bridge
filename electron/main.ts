import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  app,
  Menu,
  Tray,
  Notification,
  shell,
  clipboard,
  dialog,
} from 'electron';
import { startBridge } from '../src/bridge';
import type { BridgeHandle, BridgeStatus } from '../src/bridge';
import { configDir, configFilePath, readUserConfig, writeUserConfig } from '../src/config-store';
import { UI_URL, BRIDGE_HOST, WS_PORT } from '../src/ports';
import { printThermalPayload } from '../src/format-ticket';
import { resolvePrinterForPrint } from '../src/resolve-printer';
import { buildTestPrintPayload } from '../src/test-print';
import { fileLog } from '../src/file-logger';
import { applyStatusToTray, getIconForState } from './tray-state';
import { checkForUpdates } from './update-check';

app.setAppUserModelId('com.maxy.print-bridge');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  dialog.showErrorBox(
    'Maxy Print Bridge ya está abierto',
    'El programa ya está ejecutándose en este equipo.\n\nBusca el ícono de Maxy en la bandeja del sistema (esquina inferior derecha).',
  );
  app.quit();
}

app.on('second-instance', () => {
  const notification = new Notification({
    title: 'Maxy Print Bridge',
    body: 'Ya está en ejecución. Busque el icono en la bandeja del sistema.',
  });
  notification.show();
  void shell.openExternal(UI_URL);
});

// Tray app: don't quit when all windows are closed
app.on('window-all-closed', () => { /* keep running in tray */ });

let tray: Tray | null = null;
let bridge: BridgeHandle | null = null;
let lastStatus: BridgeStatus | null = null;
let isQuitting = false;

/** Puerto real del WS (puede diferir de WS_PORT si el preferido estaba ocupado). */
function currentWsUrl(): string {
  return `ws://${BRIDGE_HOST}:${lastStatus?.wsPort ?? WS_PORT}`;
}

function showNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const cfg = readUserConfig();
  if (cfg.showNotifications === false) return;
  new Notification({ title, body }).show();
}

function buildContextMenu(): Electron.Menu {
  const status = lastStatus;
  const cfg = readUserConfig();
  const version = app.getVersion();

  const stateEmoji: Record<string, string> = {
    ready: '●',
    'no-printer': '⚠',
    printing: '⟳',
    error: '✕',
    starting: '○',
  };
  const stateLabel: Record<string, string> = {
    ready: 'Activo',
    'no-printer': 'Sin impresora',
    printing: 'Imprimiendo…',
    error: 'Error',
    starting: 'Iniciando…',
  };

  const state = status?.state ?? 'starting';
  const printerName = status?.printerName ?? 'Sin configurar';
  const printerType = status?.printerType ?? 'thermal';

  const lastTicketLabel = status?.lastPrintOrderId
    ? (() => {
        const ago = status.lastPrintAt
          ? Math.round((Date.now() - new Date(status.lastPrintAt).getTime()) / 60000)
          : null;
        return `${status.lastPrintOrderId}${ago !== null ? ` (hace ${ago} min)` : ''}`;
      })()
    : '—';

  return Menu.buildFromTemplate([
    { label: `Maxy Print Bridge v${version}`, enabled: false },
    { type: 'separator' },
    {
      label: `${stateEmoji[state] ?? '○'} ${stateLabel[state] ?? state} — ${currentWsUrl()}`,
      enabled: false,
    },
    { label: `Impresora: ${printerName} (${printerType})`, enabled: false },
    { label: `Último ticket: ${lastTicketLabel}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Abrir configuración de impresora',
      click: () => void shell.openExternal(UI_URL),
    },
    {
      label: 'Imprimir ticket de prueba',
      enabled: !!status?.printerName,
      click: () => void handleTestPrint(),
    },
    { type: 'separator' },
    {
      label: 'Abrir carpeta de logs',
      click: () => void shell.openPath(configDir()),
    },
    {
      label: 'Copiar información de soporte',
      click: () => copySupportInfo(),
    },
    { type: 'separator' },
    {
      label: getOpenAtLoginLabel(),
      type: 'checkbox',
      checked: cfg.openAtLogin ?? false,
      click: (item) => toggleOpenAtLogin(item.checked),
    },
    {
      label: 'Mostrar notificaciones',
      type: 'checkbox',
      checked: cfg.showNotifications !== false,
      click: (item) => {
        writeUserConfig({ showNotifications: item.checked });
      },
    },
    {
      label: 'Avisar cuando imprime OK',
      type: 'checkbox',
      checked: cfg.notifyOnSuccess ?? false,
      enabled: cfg.showNotifications !== false,
      click: (item) => {
        writeUserConfig({ notifyOnSuccess: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: 'Buscar actualizaciones…',
      click: () => void checkForUpdates(false),
    },
    {
      label: 'Acerca de…',
      click: () => {
        void dialog.showMessageBox({
          type: 'info',
          title: 'Maxy Print Bridge',
          message: `Maxy Print Bridge v${version}`,
          detail:
            `WebSocket: ${currentWsUrl()}\n` +
            `Configuración: ${UI_URL}\n` +
            `Config guardada: ${configFilePath()}`,
          buttons: ['Cerrar'],
        });
      },
    },
    {
      label: 'Salir',
      click: () => void handleQuit(),
    },
  ]);
}

function refreshTrayMenu(): void {
  if (!tray) return;
  tray.setContextMenu(buildContextMenu());
}

// ── Linux autostart via .desktop file ────────────────────────────────────────

function linuxAutostartPath(): string {
  return path.join(os.homedir(), '.config', 'autostart', 'maxy-print-bridge.desktop');
}

function setLinuxLoginItem(enabled: boolean): void {
  const desktopPath = linuxAutostartPath();
  if (enabled) {
    fs.mkdirSync(path.dirname(desktopPath), { recursive: true });
    fs.writeFileSync(
      desktopPath,
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Maxy Print Bridge',
        `Exec=${process.execPath} --no-sandbox`,
        'Terminal=false',
        'Hidden=false',
        'X-GNOME-Autostart-enabled=true',
      ].join('\n') + '\n',
      'utf8',
    );
  } else {
    try { fs.unlinkSync(desktopPath); } catch { /* ya no existe */ }
  }
}

function getOpenAtLoginLabel(): string {
  if (process.platform === 'win32') return 'Iniciar con Windows';
  if (process.platform === 'darwin') return 'Iniciar con macOS';
  return 'Iniciar con el sistema';
}

function toggleOpenAtLogin(enabled: boolean): void {
  if (process.platform === 'linux') {
    setLinuxLoginItem(enabled);
  } else {
    app.setLoginItemSettings({ openAtLogin: enabled });
  }
  writeUserConfig({ openAtLogin: enabled });
  refreshTrayMenu();
}

function copySupportInfo(): void {
  const status = lastStatus;
  const version = app.getVersion();
  const info = [
    `Maxy Print Bridge ${version}`,
    `OS: ${process.platform} ${os.release()}`,
    `Impresora: ${status?.printerName ?? 'Sin configurar'} (${status?.printerType ?? 'thermal'})`,
    `Config: ${configFilePath()}`,
    `WS: ${currentWsUrl()} — ${status?.state === 'error' ? 'ERROR' : 'OK'}`,
    `UI: ${UI_URL}`,
    `Último error: ${status?.lastError ?? 'ninguno'}`,
    `Log: ${path.join(configDir(), 'bridge.log')}`,
  ].join('\n');
  clipboard.writeText(info);
}

async function handleTestPrint(): Promise<void> {
  try {
    const resolved = resolvePrinterForPrint();
    const payload = buildTestPrintPayload();
    await printThermalPayload(payload, resolved.printerName);
    showNotification('Ticket de prueba', `Impreso en ${resolved.printerName}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fileLog.error(`test print error: ${msg}`);
    void dialog.showErrorBox('Error al imprimir ticket de prueba', msg);
  }
}

async function handleQuit(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;
  if (bridge) {
    try {
      await bridge.stop();
    } catch {
      /* ignore on quit */
    }
  }
  app.quit();
}

app.whenReady().then(() => {
  // Sync login item state with saved config
  const cfg = readUserConfig();
  if (process.platform === 'linux') {
    setLinuxLoginItem(cfg.openAtLogin ?? false);
  } else {
    app.setLoginItemSettings({ openAtLogin: cfg.openAtLogin ?? false });
  }

  // Create tray with initial icon
  tray = new Tray(getIconForState('starting'));
  tray.setToolTip('Maxy Print Bridge — Iniciando…');
  tray.setContextMenu(buildContextMenu());

  // Left click opens config UI
  tray.on('click', () => void shell.openExternal(UI_URL));

  // Start bridge
  startBridge()
    .then((b) => {
      bridge = b;

      const applyBridgeStatus = (s: BridgeStatus) => {
        lastStatus = s;
        if (tray) applyStatusToTray(tray, s);
        refreshTrayMenu();
      };

      b.on('status', (s: BridgeStatus) => {
        applyBridgeStatus(s);
      });

      // startBridge() emits its initial status before resolving. Apply the
      // snapshot as well so the tray never remains at its placeholder state.
      applyBridgeStatus(b.getStatus());

      b.on('notification', (n) => {
        showNotification(n.title, n.body);
      });
    })
    .catch((err: Error) => {
      fileLog.error(`fatal al iniciar bridge: ${err.message}`);
      void dialog.showErrorBox('Maxy Print Bridge — Error fatal', err.message);
      app.quit();
    });

}).catch((err: Error) => {
  fileLog.error(`electron ready error: ${err.message}`);
  app.quit();
});
