import * as http from 'http';
import { readUserConfig, writeUserConfig } from './config-store';
import { listPrinters } from './printers';

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
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
  <title>Maxy — Configuración de impresora</title>
  <style>
    :root { font-family: system-ui, Segoe UI, sans-serif; color: #1e293b; }
    body { max-width: 520px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    p.sub { color: #64748b; font-size: 0.9rem; margin-top: 0; }
    label { display: block; font-weight: 600; margin: 1.25rem 0 0.5rem; }
    select { width: 100%; padding: 0.6rem 0.75rem; font-size: 1rem; border-radius: 8px; border: 1px solid #cbd5e1; }
    .radio-group { display: flex; gap: 1rem; margin-top: 0.25rem; }
    .radio-group label { display: flex; align-items: center; gap: 0.4rem; font-weight: 400; margin: 0; cursor: pointer; }
    .info-box { margin-top: 0.5rem; padding: 0.6rem 0.75rem; border-radius: 8px; font-size: 0.85rem; line-height: 1.45; }
    .info-thermal { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .info-regular { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    button { margin-top: 1.25rem; padding: 0.65rem 1.25rem; font-size: 0.95rem; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; background: #7c3aed; color: #fff; }
    button:hover { background: #6d28d9; }
    .ok { margin-top: 1rem; padding: 0.75rem; background: #ecfdf5; color: #047857; border-radius: 8px; display: none; }
    .err { margin-top: 1rem; padding: 0.75rem; background: #fef2f2; color: #b91c1c; border-radius: 8px; display: none; }
    .hint { font-size: 0.85rem; color: #64748b; margin-top: 1.5rem; line-height: 1.4; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>Configuración de impresora</h1>
  <p class="sub">Elija la impresora y su tipo. No hace falta configurar nada más.</p>

  <label for="printer">Impresora</label>
  <select id="printer"></select>

  <label>Tipo de impresora</label>
  <div class="radio-group">
    <label><input type="radio" name="printerType" value="thermal" checked /> Térmica (ESC/POS)</label>
    <label><input type="radio" name="printerType" value="regular" /> Láser / Inkjet</label>
  </div>
  <div id="info-thermal" class="info-box info-thermal">
    Impresora de tickets por calor. Recibe datos ESC/POS directamente. Ideal para Epson TM, Bixolon, Star, Xprinter, etc.
  </div>
  <div id="info-regular" class="info-box info-regular" style="display:none">
    Impresora de oficina (láser, inkjet). El panel enviará el ticket como PDF y se imprimirá vía Microsoft Edge. Requiere Edge instalado (incluido en Windows 10/11).
  </div>

  <label>Ticket a imprimir automáticamente</label>
  <div class="radio-group">
    <label><input type="radio" name="autoTicketType" value="full" checked /> Ticket Completo</label>
    <label><input type="radio" name="autoTicketType" value="kitchen" /> Ticket de Cocina</label>
    <label><input type="radio" name="autoTicketType" value="both" /> Ambos</label>
  </div>
  <div class="info-box info-thermal" style="margin-top:0.5rem">
    <span id="info-auto-ticket">Se imprimirá el Ticket Completo (con totales y datos del cliente).</span>
  </div>

  <div>
    <button type="button" id="save">Guardar</button>
  </div>
  <div class="ok" id="ok">Guardado correctamente. Puede cerrar esta ventana y usar el panel en Operaciones para imprimir pedidos.</div>
  <div class="err" id="err"></div>

  <p class="hint">
    La configuración se guarda localmente (sin variables de entorno).<br />
    Windows: <code>%APPDATA%\\MaxyPrintBridge\\config.json</code><br />
    macOS / Linux: <code>~/.maxy-print-bridge/config.json</code><br /><br />
    Si elige «Predeterminada del sistema», se usa la impresora predeterminada del sistema operativo.
  </p>

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
    }

    document.getElementById('save').onclick = async () => {
      ok.style.display = 'none';
      err.style.display = 'none';
      try {
        const r = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ printerName: sel.value || '', printerType: getSelectedType(), autoTicketType: getSelectedAutoTicketType() }),
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
  onConfigSaved?: () => void,
): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      html(res, 200, SETTINGS_PAGE);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/config') {
      json(res, 200, readUserConfig());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/printers') {
      const printers = listPrinters();
      json(res, 200, { printers });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw || '{}') as { printerName?: string; printerType?: string; autoTicketType?: string };
        const printerName =
          typeof body.printerName === 'string' && body.printerName.trim() !== ''
            ? body.printerName.trim()
            : null;
        const printerType = body.printerType === 'regular' ? 'regular' : 'thermal';
        const validAutoTypes = ['full', 'kitchen', 'both'] as const;
        const autoTicketType = validAutoTypes.includes(body.autoTicketType as (typeof validAutoTypes)[number])
          ? (body.autoTicketType as 'full' | 'kitchen' | 'both')
          : 'full';
        writeUserConfig({ printerName, printerType, autoTicketType });
        onConfigSaved?.();
        json(res, 200, { ok: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        json(res, 400, { ok: false, error: msg });
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
