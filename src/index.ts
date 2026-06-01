import { WebSocketServer } from 'ws';
import type { PrintJobMessage } from './types';
import { printThermalPayload } from './format-ticket';
import { startSettingsServer } from './settings-server';
import { fileLog } from './file-logger';
import { resolvePrinterForPrint } from './resolve-printer';
import { toUserFacingPrintError } from './print-errors';
import { isBridgeAlreadyRunning } from './bridge-probe';
import { exitWithConsolePause, logPackagedStartupBanner } from './console-exit';
import { applyProcessBranding } from './process-branding';
import { SerialPrintQueue } from './print-queue';

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

async function handlePortInUse(
  which: 'settings' | 'websocket',
  err: NodeJS.ErrnoException,
): Promise<void> {
  if (err.code !== 'EADDRINUSE') {
    exitWithConsolePause(1, err.message);
    return;
  }
  const already = await isBridgeAlreadyRunning(HOST, WS_PORT);
  if (already) {
    // eslint-disable-next-line no-console
    console.log(
      '[maxy-print-bridge] El programa ya está en ejecución en este equipo.\n' +
        `  Configuración: http://${HOST}:${UI_PORT}\n` +
        '  No abra una segunda copia; use la ventana que ya está abierta.',
    );
    exitWithConsolePause(0);
    return;
  }
  const port = which === 'settings' ? UI_PORT : WS_PORT;
  exitWithConsolePause(
    1,
    `El puerto ${port} está en uso por otro programa. Cierre esa aplicación o reinicie el equipo.`,
  );
}

/** Puerto WebSocket: panel → bridge (fijo; no requiere configuración en la PC del cliente). */
const WS_PORT = 8080;
/** Página web local para elegir impresora. */
const UI_PORT = 8081;
const HOST = '127.0.0.1';

function parseMessage(text: string): PrintJobMessage | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    if (o.type !== 'print' || o.version !== 1) return null;
    if (!o.thermalPrint || typeof o.thermalPrint !== 'object') return null;
    return data as PrintJobMessage;
  } catch {
    return null;
  }
}

async function main() {
  const preUp = await isBridgeAlreadyRunning(HOST, WS_PORT);
  if (preUp) {
    // eslint-disable-next-line no-console
    console.log(
      '[maxy-print-bridge] El programa ya está en ejecución.\n' +
        `  Abra http://${HOST}:${UI_PORT} para la impresora.`,
    );
    exitWithConsolePause(0);
    return;
  }

  fileLog.info(`iniciando maxy-print-bridge ws=${HOST}:${WS_PORT} ui=${HOST}:${UI_PORT}`);
  const settingsServer = startSettingsServer(UI_PORT, HOST);
  settingsServer.on('maxy-settings-error', (err: NodeJS.ErrnoException) => {
    fileLog.error(`settings server error: ${err.message}`);
    void handlePortInUse('settings', err);
  });

  const queue = new SerialPrintQueue();
  const wss = new WebSocketServer({ host: HOST, port: WS_PORT });

  wss.on('error', (err: NodeJS.ErrnoException) => {
    fileLog.error(`websocket server error: ${err.message}`);
    void handlePortInUse('websocket', err);
  });

  // eslint-disable-next-line no-console
  console.log(
    `[maxy-print-bridge] Impresión: ws://${HOST}:${WS_PORT} (el panel envía los trabajos aquí)`,
  );
  logPackagedStartupBanner(HOST, UI_PORT, WS_PORT);

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      let text: string;
      try {
        text = typeof raw === 'string' ? raw : raw.toString('utf8');
      } catch {
        socket.send(JSON.stringify({ ok: false, error: 'Cuerpo inválido' }));
        return;
      }

      try {
        const maybePing = JSON.parse(text) as { type?: string };
        if (maybePing?.type === 'ping') {
          socket.send(JSON.stringify({ ok: true, type: 'pong' }));
          return;
        }
      } catch {
        /* sigue como print */
      }

      const msg = parseMessage(text);
      if (!msg) {
        socket.send(
          JSON.stringify({
            ok: false,
            error:
              'Mensaje inválido; espere { type: "print", version: 1, thermalPrint }',
          }),
        );
        return;
      }

      void queue
        .add(async () => {
          const resolved = resolvePrinterForPrint();
          await printThermalPayload(msg.thermalPrint, resolved.printerName);
        })
        .then(() => {
          socket.send(JSON.stringify({ ok: true }));
        })
        .catch((err: Error) => {
          let userMessage = err?.message || String(err);
          try {
            const resolved = resolvePrinterForPrint();
            userMessage = toUserFacingPrintError(err, {
              printerName: resolved.printerName,
              printers: resolved.printers,
              configPrinterName: resolved.configPrinterName,
            });
          } catch {
            /* keep raw if resolve fails */
          }
          fileLog.error(
            `error imprimiendo order=${msg.thermalPrint.orderId}: ${err?.message || String(err)} → ${userMessage}`,
          );
          socket.send(
            JSON.stringify({
              ok: false,
              error: userMessage,
            }),
          );
        });
    });
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[maxy-print-bridge]', e);
  fileLog.error(`fatal: ${(e as Error)?.message || String(e)}`);
  exitWithConsolePause(1, (e as Error)?.message || String(e));
});
