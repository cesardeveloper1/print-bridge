import * as http from 'http';
import { readUserConfig, writeUserConfig } from './config-store';
import { listPrinters } from './printers';
import { UI_URL } from './ports';
import { isOriginAllowed } from './allowed-origins';
import { PRINT_BRIDGE_SHARED_TOKEN } from './bridge-token';
import { fileLog } from './file-logger';

/** UI_URL (http://127.0.0.1:17881) es el origen de la propia página de settings — el navegador
 *  manda Origin en sus POST same-origin y hay que aceptarlo aunque no sea el panel. */
function isSettingsOriginAllowed(origin: string | undefined): boolean {
  if (origin === UI_URL) return true;
  return isOriginAllowed(origin, true);
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allowed = isSettingsOriginAllowed(origin);
  return allowed && origin
    ? {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin, Access-Control-Request-Private-Network',
      }
    : {};
}

function privateNetworkHeaders(req: http.IncomingMessage, origin: string | undefined): Record<string, string> {
  const isPnaPreflight = req.headers['access-control-request-private-network'] === 'true';
  return isPnaPreflight && isSettingsOriginAllowed(origin)
    ? { 'Access-Control-Allow-Private-Network': 'true' }
    : {};
}

function json(res: http.ServerResponse, code: number, body: unknown, origin?: string) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...corsHeaders(origin),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function html(res: http.ServerResponse, code: number, body: string) {
  res.writeHead(code, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const SETTINGS_PAGE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Maxy Print Bridge</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #1e293b; background: #f8fafc; }
    body { max-width: 480px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }

    /* Header */
    .header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid #e2e8f0; }
    .header-icon { width: 36px; height: 36px; background: #7c3aed; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .header-icon svg { width: 20px; height: 20px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .header h1 { font-size: 1.1rem; font-weight: 700; margin: 0; line-height: 1.2; }
    .header p  { font-size: 0.8rem; color: #64748b; margin: 0.1rem 0 0; }

    /* Cards */
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 0.75rem; }
    .card-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin: 0 0 0.85rem; }

    /* Select */
    select { width: 100%; padding: 0.55rem 0.75rem; font-size: 0.95rem; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #1e293b; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.75rem center; cursor: pointer; }
    select:focus { outline: 2px solid #7c3aed; outline-offset: 1px; border-color: transparent; }

    /* Chip radio buttons */
    .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .chips input[type=radio] { position: absolute; opacity: 0; width: 0; height: 0; }
    .chips label { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; border-radius: 999px; border: 1.5px solid #e2e8f0; font-size: 0.85rem; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s; user-select: none; margin: 0; }
    .chips label:hover { border-color: #a78bfa; color: #6d28d9; }
    .chips input[type=radio]:checked + label { background: #ede9fe; border-color: #7c3aed; color: #6d28d9; font-weight: 600; }

    /* Info boxes */
    .info { margin-top: 0.85rem; padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.82rem; line-height: 1.5; }
    .info-green  { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .info-blue   { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .info-purple { background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; }

    /* Status row */
    .status-row { display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.82rem; color: #64748b; }
    .status-row strong { color: #1e293b; }
    .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; background: #ede9fe; color: #6d28d9; font-size: 0.75rem; font-weight: 700; font-family: monospace; }

    /* Save button */
    .save-row { margin-top: 1rem; display: flex; align-items: center; gap: 1rem; }
    button#save { padding: 0.6rem 1.5rem; font-size: 0.95rem; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; background: #7c3aed; color: #fff; transition: background 0.15s; }
    button#save:hover { background: #6d28d9; }
    .ok  { font-size: 0.85rem; color: #047857; display: none; }
    .err { font-size: 0.85rem; color: #b91c1c; display: none; }

    /* Footer */
    .footer { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.78rem; color: #94a3b8; line-height: 1.6; }
    code { background: #f1f5f9; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.8em; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">
      <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    </div>
    <div>
      <h1>Maxy Print Bridge</h1>
      <p>Configuración de impresora local</p>
    </div>
  </div>

  <!-- Impresora -->
  <div class="card">
    <p class="card-title">Impresora</p>
    <select id="printer"></select>
  </div>

  <!-- Tipo -->
  <div class="card">
    <p class="card-title">Tipo de impresora</p>
    <div class="chips">
      <input type="radio" name="printerType" value="thermal" id="pt-thermal" checked />
      <label for="pt-thermal">🖨️ Térmica (ESC/POS)</label>
      <input type="radio" name="printerType" value="regular" id="pt-regular" />
      <label for="pt-regular">🖨 Láser / Inkjet</label>
    </div>
    <div id="info-thermal" class="info info-green">
      Impresora de tickets por calor. Ideal para Epson TM, Bixolon, Star, Xprinter, etc.
    </div>
    <div id="info-regular" class="info info-blue" style="display:none">
      Impresora de oficina. El panel enviará el ticket como PDF e imprimirá vía Microsoft Edge (incluido en Windows 10/11).
    </div>
  </div>

  <!-- Ancho del papel -->
  <div class="card">
    <p class="card-title">Ancho del papel</p>
    <div class="chips">
      <input type="radio" name="lineWidth" value="48" id="lw-80" checked />
      <label for="lw-80">80 mm · 48 caracteres</label>
      <input type="radio" name="lineWidth" value="32" id="lw-58" />
      <label for="lw-58">58 mm · 32 caracteres</label>
      <input type="radio" name="lineWidth" value="64" id="lw-112" />
      <label for="lw-112">112 mm · 64 caracteres</label>
    </div>
  </div>

  <!-- Ticket automático -->
  <div class="card">
    <p class="card-title">Ticket automático al recibir pedido</p>
    <div class="chips">
      <input type="radio" name="autoTicketType" value="full"    id="at-full"    checked />
      <label for="at-full">Ticket Completo</label>
      <input type="radio" name="autoTicketType" value="kitchen" id="at-kitchen" />
      <label for="at-kitchen">Ticket de Cocina</label>
      <input type="radio" name="autoTicketType" value="both"    id="at-both"    />
      <label for="at-both">Ambos</label>
    </div>
    <div class="info info-purple">
      <span id="info-auto-ticket">Se imprimirá el Ticket Completo (con totales y datos del cliente).</span>
    </div>
  </div>

  <!-- Guardar -->
  <div class="save-row">
    <button type="button" id="save">Guardar cambios</button>
    <span class="ok"  id="ok">✓ Guardado correctamente</span>
    <span class="err" id="err"></span>
  </div>

  <!-- Footer info -->
  <div class="footer">
    <div class="status-row" style="margin-bottom:0.85rem">
      <span>Puerto WebSocket</span>
      <span class="badge" id="ws-port">17880</span>
    </div>
    Config: <code>%APPDATA%\\MaxyPrintBridge\\config.json</code><br />
    macOS/Linux: <code>~/.maxy-print-bridge/config.json</code>
  </div>

  <script>
    const sel = document.getElementById('printer');
    const ok = document.getElementById('ok');
    const err = document.getElementById('err');
    const infoThermal = document.getElementById('info-thermal');
    const infoRegular = document.getElementById('info-regular');

    const AUTO_TICKET_LABELS = {
      full:    'Se imprimirá el Ticket Completo (con totales y datos del cliente).',
      kitchen: 'Se imprimirá el Ticket de Cocina (solo ítems, sin precios).',
      both:    'Se imprimirán ambos tickets: Completo y de Cocina.',
    };

    function getSelectedType() {
      return document.querySelector('input[name="printerType"]:checked').value;
    }

    function getSelectedAutoTicketType() {
      return document.querySelector('input[name="autoTicketType"]:checked').value;
    }

    function getSelectedLineWidth() {
      return parseInt(document.querySelector('input[name="lineWidth"]:checked').value, 10);
    }

    document.querySelectorAll('input[name="printerType"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const isThermal = getSelectedType() === 'thermal';
        infoThermal.style.display = isThermal ? 'block' : 'none';
        infoRegular.style.display = isThermal ? 'none' : 'block';
      });
    });

    document.querySelectorAll('input[name="autoTicketType"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.getElementById('info-auto-ticket').textContent =
          AUTO_TICKET_LABELS[getSelectedAutoTicketType()];
      });
    });

    async function load() {
      const [cfgRes, listRes] = await Promise.all([
        fetch('/api/config'),
        fetch('/api/printers'),
      ]);
      const cfg = await cfgRes.json();
      const list = await listRes.json();
      sel.innerHTML = '';
      const optDef = document.createElement('option');
      optDef.value = '';
      optDef.textContent = 'Predeterminada del sistema';
      sel.appendChild(optDef);
      for (const p of list.printers || []) {
        const o = document.createElement('option');
        o.value = p.name;
        o.textContent = p.isDefault ? p.name + ' (predeterminada)' : p.name;
        sel.appendChild(o);
      }
      const want = cfg.printerName || '';
      sel.value = want;
      const match = Array.from(sel.options).some((o) => o.value === want);
      if (!match && want) {
        const o = document.createElement('option');
        o.value = want;
        o.textContent = want + ' (no listada; guardada antes)';
        sel.appendChild(o);
        sel.value = want;
      }
      // Restore printer type
      const savedType = cfg.printerType === 'regular' ? 'regular' : 'thermal';
      document.querySelector('input[name="printerType"][value="' + savedType + '"]').checked = true;
      infoThermal.style.display = savedType === 'thermal' ? 'block' : 'none';
      infoRegular.style.display = savedType === 'regular' ? 'block' : 'none';
      // Restore auto ticket type
      const savedAuto = cfg.autoTicketType || 'full';
      document.querySelector('input[name="autoTicketType"][value="' + savedAuto + '"]').checked = true;
      document.getElementById('info-auto-ticket').textContent = AUTO_TICKET_LABELS[savedAuto];
      // Restore line width
      const savedWidth = cfg.lineWidth === 32 ? '32' : cfg.lineWidth === 64 ? '64' : '48';
      document.querySelector('input[name="lineWidth"][value="' + savedWidth + '"]').checked = true;
      // Show WS port
      if (cfg.wsPort) document.getElementById('ws-port').textContent = cfg.wsPort;
    }

    document.getElementById('save').onclick = async () => {
      ok.style.display = 'none';
      err.style.display = 'none';
      try {
        const r = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '__BRIDGE_TOKEN__', printerName: sel.value || '', printerType: getSelectedType(), autoTicketType: getSelectedAutoTicketType(), lineWidth: getSelectedLineWidth() }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Error al guardar');
        ok.style.display = 'block';
      } catch (e) {
        err.textContent = e.message || String(e);
        err.style.display = 'block';
      }
    };

    load().catch((e) => {
      err.textContent = 'No se pudo cargar: ' + (e.message || e);
      err.style.display = 'block';
    });
  </script>
</body>
</html>`;

export function startSettingsServer(
  port: number,
  host: string,
  wsPort: number,
  onConfigSaved?: () => void,
): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}`);
    const origin = req.headers.origin;

    if (origin && !isSettingsOriginAllowed(origin)) {
      fileLog.error(`settings-server rechazado: origin no permitido "${origin}" (${req.method} ${url.pathname})`);
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Origin no permitido');
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...corsHeaders(origin),
        ...privateNetworkHeaders(req, origin),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      html(res, 200, SETTINGS_PAGE.replace('__BRIDGE_TOKEN__', PRINT_BRIDGE_SHARED_TOKEN));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      json(res, 200, { ...readUserConfig(), wsPort }, origin);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/printers') {
      const printers = listPrinters();
      json(res, 200, { printers }, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}') as { token?: string; printerName?: string; printerType?: string; autoTicketType?: string; lineWidth?: number };
        if (body.token !== PRINT_BRIDGE_SHARED_TOKEN) {
          fileLog.error('settings-server: POST /api/config rechazado (token inválido)');
          json(res, 401, { ok: false, error: 'No autorizado' }, origin);
          return;
        }
        const printerName =
          typeof body.printerName === 'string' && body.printerName.trim() !== ''
            ? body.printerName.trim()
            : null;
        const printerType = body.printerType === 'regular' ? 'regular' : 'thermal';
        const validAutoTypes = ['full', 'kitchen', 'both'] as const;
        const autoTicketType = validAutoTypes.includes(body.autoTicketType as (typeof validAutoTypes)[number])
          ? (body.autoTicketType as 'full' | 'kitchen' | 'both')
          : 'full';
        const lineWidth: 32 | 48 | 64 = body.lineWidth === 32 ? 32 : body.lineWidth === 64 ? 64 : 48;
        writeUserConfig({ printerName, printerType, autoTicketType, lineWidth });
        onConfigSaved?.();
        json(res, 200, { ok: true }, origin);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        json(res, 400, { ok: false, error: msg }, origin);
      }
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    server.emit('maxy-settings-error', err);
  });

  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[maxy-print-bridge] Configuración en http://${host}:${port} (elija la impresora aquí)`,
    );
  });

  return server;
}
