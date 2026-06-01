import * as readline from 'readline';
import { spawnSync } from 'child_process';

function isPackagedExe(): boolean {
  return !!(process as NodeJS.Process & { pkg?: unknown }).pkg;
}

/** Pausa la consola en Windows antes de salir (doble clic en .exe). */
function pauseWindowsConsole(): void {
  if (process.platform !== 'win32') return;
  try {
    spawnSync('cmd.exe', ['/c', 'pause'], { stdio: 'inherit' });
  } catch {
    /* ignore */
  }
}

/** En Windows (doble clic en .exe) evita que la consola desaparezca sin leer el error. */
export function exitWithConsolePause(code: number, reason?: string): void {
  if (reason) {
    // eslint-disable-next-line no-console
    console.error(`\n[maxy-print-bridge] ${reason}`);
  }
  const needsPause =
    process.platform === 'win32' && (isPackagedExe() || !process.stdin.isTTY);
  if (!needsPause) {
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
    pauseWindowsConsole();
    process.exit(code);
  }
}

/** Mensaje al arrancar el .exe empaquetado (ventana debe quedar abierta). */
export function logPackagedStartupBanner(host: string, uiPort: number, wsPort: number): void {
  if (!isPackagedExe()) return;
  // eslint-disable-next-line no-console
  console.log(
    '\n[maxy-print-bridge] Deje esta ventana abierta mientras usa el panel.\n' +
      `  Impresora: http://${host}:${uiPort}  |  WebSocket: ws://${host}:${wsPort}\n`,
  );
}
