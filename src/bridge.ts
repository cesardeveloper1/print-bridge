import { WebSocketServer } from 'ws';
import type { WebSocket as WSClient } from 'ws';
import type { PrintJobMessage, ThermalPrintPayload } from './types';
import { printThermalPayload } from './format-ticket';
import { startSettingsServer } from './settings-server';
import { fileLog } from './file-logger';
import { resolvePrinterForPrint } from './resolve-printer';
import { toUserFacingPrintError } from './print-errors';
import { SerialPrintQueue } from './print-queue';
import { BRIDGE_HOST, UI_PORT, WS_PORT } from './ports';
import { warmupSendRawPrintScript } from './send-raw-print-script';
import { logPackagedStartupBanner } from './console-exit';
import { readUserConfig } from './config-store';
import { isOriginAllowed } from './allowed-origins';
import { PRINT_BRIDGE_SHARED_TOKEN } from './bridge-token';
import { BridgeEventBus } from './bridge-events';
import type { BridgeStatus, BridgeNotification } from './bridge-events';

export type { BridgeStatus, BridgeNotification };
export type { BridgeState } from './bridge-events';

export interface BridgeHandle {
  getStatus(): BridgeStatus;
  stop(): Promise<void>;
  on(event: 'status', listener: (s: BridgeStatus) => void): void;
  on(event: 'notification', listener: (n: BridgeNotification) => void): void;
}

function resolveTicketJobs(payload: ThermalPrintPayload): ThermalPrintPayload[] {
  const { autoTicketType } = readUserConfig();
  if (autoTicketType === 'kitchen') {
    return [{ ...payload, ticketType: 'kitchen' }];
  }
  if (autoTicketType === 'both') {
    return [
      { ...payload, ticketType: 'full' },
      { ...payload, ticketType: 'kitchen' },
    ];
  }
  return [{ ...payload, ticketType: 'full' }];
}

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

export async function startBridge(options?: {
  /** false en entry CLI con consola */
  packaged?: boolean;
}): Promise<BridgeHandle> {
  const bus = new BridgeEventBus();
  const queue = new SerialPrintQueue();
  const host = BRIDGE_HOST;

  const initialCfg = readUserConfig();
  let status: BridgeStatus = {
    state: initialCfg.printerName ? 'ready' : 'no-printer',
    wsPort: WS_PORT,
    uiPort: UI_PORT,
    printerName: initialCfg.printerName,
    printerType: initialCfg.printerType,
    lastPrintAt: null,
    lastPrintOrderId: null,
    lastError: null,
    queuePending: 0,
  };

  function setStatus(patch: Partial<BridgeStatus>): void {
    status = { ...status, ...patch };
    bus.emitStatus({ ...status });
  }

  function notify(n: BridgeNotification): void {
    const cfg = readUserConfig();
    if (cfg.showNotifications === false) return;
    bus.emitNotification(n);
  }

  warmupSendRawPrintScript();
  fileLog.info(`iniciando maxy-print-bridge ws=${host}:${WS_PORT} ui=${host}:${UI_PORT}`);

  const suppressConsole = options?.packaged !== false && !!process.versions?.electron;

  if (!suppressConsole) {
    // eslint-disable-next-line no-console
    console.log(
      `[maxy-print-bridge] Impresión: ws://${host}:${WS_PORT} (el panel envía los trabajos aquí)`,
    );
    logPackagedStartupBanner(host, UI_PORT, WS_PORT);
  }

  const settingsServer = startSettingsServer(UI_PORT, host, () => {
    const newCfg = readUserConfig();
    setStatus({
      state: newCfg.printerName ? 'ready' : 'no-printer',
      printerName: newCfg.printerName,
      printerType: newCfg.printerType,
      lastError: null,
    });
  });

  settingsServer.on('maxy-settings-error', (err: NodeJS.ErrnoException) => {
    fileLog.error(`settings server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      setStatus({ state: 'error', lastError: `Puerto ${UI_PORT} en uso` });
      notify({
        kind: 'error',
        title: 'Error de puerto',
        body: `El puerto ${UI_PORT} está en uso por otro programa.`,
      });
    }
  });

  const wss = new WebSocketServer({
    host,
    port: WS_PORT,
    verifyClient: (info, cb) => {
      if (isOriginAllowed(info.origin, suppressConsole)) return cb(true);
      fileLog.error(`WS rechazado: origin no permitido "${info.origin}"`);
      cb(false, 403, 'Origin no permitido');
    },
  });

  wss.on('error', (err: NodeJS.ErrnoException) => {
    fileLog.error(`websocket server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      setStatus({ state: 'error', lastError: `Puerto ${WS_PORT} en uso` });
      notify({
        kind: 'error',
        title: 'Error de puerto',
        body: `El puerto ${WS_PORT} está en uso por otro programa.`,
      });
    }
  });

  wss.on('listening', () => {
    const cfg = readUserConfig();
    setStatus({
      state: cfg.printerName ? 'ready' : 'no-printer',
      printerName: cfg.printerName,
      printerType: cfg.printerType,
    });
    if (!cfg.printerName) {
      notify({
        kind: 'info',
        title: 'Maxy Print Bridge',
        body: 'Configure su impresora en el navegador.',
      });
    }
  });

  wss.on('connection', (socket: WSClient) => {
    socket.on('message', (raw) => {
      let text: string;
      try {
        text = typeof raw === 'string' ? raw : (raw as Buffer).toString('utf8');
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
            error: 'Mensaje inválido; espere { type: "print", version: 1, thermalPrint }',
          }),
        );
        return;
      }

      if (msg.token !== PRINT_BRIDGE_SHARED_TOKEN) {
        fileLog.error(`WS mensaje rechazado: token inválido (order=${msg.thermalPrint?.orderId})`);
        socket.send(JSON.stringify({ ok: false, error: 'No autorizado' }));
        return;
      }

      const jobs = resolveTicketJobs(msg.thermalPrint);
      setStatus({ state: 'printing', queuePending: queue.pendingCount + jobs.length });

      void Promise.all(
        jobs.map((jobPayload) =>
          queue.add(async () => {
            const resolved = resolvePrinterForPrint();
            await printThermalPayload(jobPayload, resolved.printerName);
          }),
        ),
      )
        .then(() => {
          const now = new Date().toISOString();
          setStatus({
            state: 'ready',
            lastPrintAt: now,
            lastPrintOrderId: msg.thermalPrint.orderId,
            lastError: null,
            queuePending: queue.pendingCount,
          });
          socket.send(JSON.stringify({ ok: true }));
          const cfg = readUserConfig();
          if (cfg.notifyOnSuccess) {
            notify({
              kind: 'success',
              title: 'Ticket impreso',
              body: `Pedido ${msg.thermalPrint.orderId} impreso correctamente.`,
            });
          }
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
            /* keep raw */
          }
          fileLog.error(
            `error imprimiendo order=${msg.thermalPrint.orderId}: ${err?.message || String(err)} → ${userMessage}`,
          );
          setStatus({
            state: 'error',
            lastError: userMessage,
            queuePending: queue.pendingCount,
          });
          socket.send(JSON.stringify({ ok: false, error: userMessage }));
          const cfg = readUserConfig();
          if (cfg.notifyOnError !== false) {
            notify({
              kind: 'error',
              title: 'Error al imprimir',
              body: userMessage,
            });
          }
        });
    });
  });

  const handle: BridgeHandle = {
    getStatus: () => ({ ...status }),
    stop: () =>
      new Promise((resolve) => {
        wss.close(() => {
          settingsServer.close(() => resolve());
        });
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on: ((event: string, listener: (arg: any) => void) => {
      bus.on(event, listener);
    }) as BridgeHandle['on'],
  };

  return handle;
}
