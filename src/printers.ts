import { execSync } from 'child_process';

export type PrinterRow = { name: string; isDefault: boolean };

// ─── Windows ────────────────────────────────────────────────────────────────

function listWindowsPrinters(): PrinterRow[] {
  try {
    const script =
      'Get-CimInstance Win32_Printer | Select-Object Name, Default | ConvertTo-Json -Compress';
    const out = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
    if (!out) return [];
    const parsed = JSON.parse(out) as
      | { Name?: string; Default?: boolean }
      | Array<{ Name?: string; Default?: boolean }>;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((x) => x && typeof x.Name === 'string' && x.Name.length > 0)
      .map((x) => ({ name: String(x.Name), isDefault: !!x.Default }));
  } catch {
    return [];
  }
}

function getWindowsDefaultPrinterName(): string | null {
  const def = listWindowsPrinters().find((p) => p.isDefault);
  if (def) return def.name;
  try {
    const cmd =
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true }).Name"';
    const name = execSync(cmd, { encoding: 'utf8' }).trim();
    return name || null;
  } catch {
    return null;
  }
}

// ─── CUPS (macOS + Linux) ────────────────────────────────────────────────────

function listCupsPrinters(): PrinterRow[] {
  try {
    const out = execSync('lpstat -a 2>/dev/null', {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }).trim();
    if (!out) return [];

    let defaultName: string | null = null;
    try {
      const d = execSync('lpstat -d 2>/dev/null', { encoding: 'utf8' }).trim();
      // "system default destination: HP_LaserJet" → tomar tras ": "
      const match = d.match(/destination:\s+(.+)/);
      if (match) defaultName = match[1].trim();
    } catch {
      /* no default set */
    }

    return out
      .split('\n')
      .map((line) => {
        // línea: "HP_LaserJet accepting requests since..."
        // el nombre CUPS puede contener guiones pero no espacios (normalizado por CUPS)
        const name = line.split(' ')[0]?.trim();
        return name ? { name, isDefault: name === defaultName } : null;
      })
      .filter((r): r is PrinterRow => r !== null);
  } catch {
    return [];
  }
}

function getCupsDefaultPrinterName(): string | null {
  try {
    const out = execSync('lpstat -d 2>/dev/null', { encoding: 'utf8' }).trim();
    const match = out.match(/destination:\s+(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function listPrinters(): PrinterRow[] {
  if (process.platform === 'win32') return listWindowsPrinters();
  if (process.platform === 'darwin' || process.platform === 'linux')
    return listCupsPrinters();
  return [];
}

export function getDefaultPrinterName(): string | null {
  if (process.platform === 'win32') return getWindowsDefaultPrinterName();
  if (process.platform === 'darwin' || process.platform === 'linux')
    return getCupsDefaultPrinterName();
  return null;
}
