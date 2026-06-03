import WebSocket from 'ws';
import { BRIDGE_HOST, WS_PORT } from './ports';

/** Comprueba si ya hay un bridge escuchando en el puerto WebSocket. */
export function isBridgeAlreadyRunning(
  host = BRIDGE_HOST,
  port = WS_PORT,
  timeoutMs = 2000,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };

    const ws = new WebSocket(`ws://${host}:${port}`);
    const timer = setTimeout(() => finish(false), timeoutMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    ws.on('message', (raw) => {
      try {
        const j = JSON.parse(String(raw)) as { ok?: boolean; type?: string };
        if (j.ok === true && j.type === 'pong') {
          finish(true);
        }
      } catch {
        /* ignore */
      }
    });

    ws.on('error', () => finish(false));
  });
}
