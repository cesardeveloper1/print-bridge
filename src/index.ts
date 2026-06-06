import { startBridge } from './bridge';
import { fileLog } from './file-logger';
import { exitWithConsolePause } from './console-exit';
import { isBridgeAlreadyRunning } from './bridge-probe';
import { applyProcessBranding } from './process-branding';
import { BRIDGE_HOST, UI_PORT, WS_PORT } from './ports';

applyProcessBranding();

process.on('uncaughtException', (err) => {
  fileLog.error(`uncaughtException: ${err.message}`);
  exitWithConsolePause(1, err.message);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  fileLog.error(`unhandledRejection: ${msg}`);
  exitWithConsolePause(1, msg);
});

async function main() {
  const host = BRIDGE_HOST;
  const preUp = await isBridgeAlreadyRunning(host, WS_PORT);
  if (preUp) {
    // eslint-disable-next-line no-console
    console.log(
      '[maxy-print-bridge] El programa ya está en ejecución.\n' +
        `  Abra http://${host}:${UI_PORT} para la impresora.`,
    );
    exitWithConsolePause(0);
    return;
  }

  const bridge = await startBridge({ packaged: false });

  bridge.on('status', (s) => {
    if (s.state === 'error' && s.lastError) {
      fileLog.error(`bridge error: ${s.lastError}`);
    }
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[maxy-print-bridge]', e);
  fileLog.error(`fatal: ${(e as Error)?.message || String(e)}`);
  exitWithConsolePause(1, (e as Error)?.message || String(e));
});
