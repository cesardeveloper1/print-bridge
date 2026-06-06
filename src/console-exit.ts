import * as readline from 'readline';
import { spawnSync } from 'child_process';
import { BRIDGE_DISPLAY_NAME, isPackagedBinary } from './process-branding';

/** Devuelve true si el proceso corre dentro de Electron (main o renderer). */
export function isElectronMode(): boolean {
  return !!process.versions?.electron || process.env.MAXY_BRIDGE_ELECTRON === '1';
}

function pauseWindowsConsole(): void {
  if (process.platform !== 'win32') return;
  try {
    spawnSync('cmd.exe', ['/c', 'pause'], { stdio: 'inherit' });
  } catch {
    /* ignore */
  }
}

function pauseUnixConsole(): void {
  if (process.platform === 'win32') return;
  try {
    spawnSync('sh', ['-c', 'read -r -p "Pulse Enter para cerrar... " _'], {
      stdio: 'inherit',
    });
  } catch {
    /* ignore */
  }
}

function shouldPauseBeforeExit(): boolean {
  return isPackagedBinary() || !process.stdin.isTTY;
}

/** Evita que la terminal desaparezca al salir (doble clic / sin TTY). En modo Electron es no-op. */
export function exitWithConsolePause(code: number, reason?: string): void {
  if (isElectronMode()) {
    process.exit(code);
    return;
  }
  if (reason) {
    // eslint-disable-next-line no-console
    console.error(`\n[${BRIDGE_DISPLAY_NAME}] ${reason}`);
  }
  if (!shouldPauseBeforeExit()) {
    process.exit(code);
    return;
  }
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('\nPulse Enter para cerrar...', () => {
      rl.close();
      process.exit(code);
    });
  } catch {
    if (process.platform === 'win32') {
      pauseWindowsConsole();
    } else {
      pauseUnixConsole();
    }
    process.exit(code);
  }
}

/** Mensaje al arrancar binario empaquetado (ventana debe quedar abierta). En modo Electron es no-op. */
export function logPackagedStartupBanner(
  host: string,
  uiPort: number,
  wsPort: number,
): void {
  if (isElectronMode() || !isPackagedBinary()) return;
  // eslint-disable-next-line no-console
  console.log(
    `\n[${BRIDGE_DISPLAY_NAME}] Deje esta ventana abierta mientras usa el panel.\n` +
      `  Impresora: http://${host}:${uiPort}  |  WebSocket: ws://${host}:${wsPort}\n`,
  );
}
