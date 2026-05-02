import { execSync } from 'child_process';
import { WebSocketServer } from 'ws';
import PQueue from 'p-queue';
import type { PrintJobMessage, ThermalPrintPayload } from './types';
import { printThermalPayload } from './format-ticket';

const PORT = Number(process.env.PRINT_BRIDGE_PORT || 8080);
const HOST = process.env.PRINT_BRIDGE_HOST || '127.0.0.1';

function getWindowsDefaultPrinterName(): string | null {
  if (process.platform !== 'win32') return null;
  try {
    const cmd =
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true }).Name"';
    const name = execSync(cmd, { encoding: 'utf8' }).trim();
    return name || null;
  } catch {
    return null;
  }
}

function resolvePrinterName(): string {
  const fromEnv = process.env.PRINT_BRIDGE_PRINTER_NAME?.trim();
  if (fromEnv) return fromEnv;
  const def = getWindowsDefaultPrinterName();
  if (def) return def;
  throw new Error(
    'Defina PRINT_BRIDGE_PRINTER_NAME o establezca una impresora predeterminada en Windows',
  );
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

async function main() {
  const queue = new PQueue({ concurrency: 1 });
  const wss = new WebSocketServer({ host: HOST, port: PORT });

  // eslint-disable-next-line no-console
  console.log(
    `[maxy-print-bridge] escuchando en ws://${HOST}:${PORT} (cola serializada)`,
  );

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
            error: 'Mensaje inválido; espere { type: "print", version: 1, thermalPrint }',
          }),
        );
        return;
      }

      void queue
        .add(async () => {
          const printerName = resolvePrinterName();
          await printThermalPayload(msg.thermalPrint, printerName);
        })
        .then(() => {
          socket.send(JSON.stringify({ ok: true }));
        })
        .catch((err: Error) => {
          socket.send(
            JSON.stringify({
              ok: false,
              error: err?.message || String(err),
            }),
          );
        });
    });
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[maxy-print-bridge]', e);
  process.exit(1);
});
