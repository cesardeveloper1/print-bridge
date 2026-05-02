import { execSync } from 'child_process';

export type WindowsPrinterRow = { name: string; isDefault: boolean };

/**
 * Lista impresoras instaladas en Windows (Win32_Printer).
 */
export function listWindowsPrinters(): WindowsPrinterRow[] {
  if (process.platform !== 'win32') {
    return [];
  }
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
      .map((x) => ({
        name: String(x.Name),
        isDefault: !!x.Default,
      }));
  } catch {
    return [];
  }
}

export function getWindowsDefaultPrinterName(): string | null {
  const list = listWindowsPrinters();
  const d = list.find((p) => p.isDefault);
  if (d) return d.name;
  try {
    const cmd =
      'powershell -NoProfile -Command "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true }).Name"';
    const name = execSync(cmd, { encoding: 'utf8' }).trim();
    return name || null;
  } catch {
    return null;
  }
}
