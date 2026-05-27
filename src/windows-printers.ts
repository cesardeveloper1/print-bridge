import { execSync } from 'child_process';

export type WindowsPrinterRow = {
  name: string;
  isDefault: boolean;
  /** Win32_Printer.PrinterStatus (7 = Offline) */
  printerStatus?: number;
  workOffline?: boolean;
};

/**
 * Lista impresoras instaladas en Windows (Win32_Printer).
 */
export function listWindowsPrinters(): WindowsPrinterRow[] {
  if (process.platform !== 'win32') {
    return [];
  }
  try {
    const script =
      'Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus, WorkOffline | ConvertTo-Json -Compress';
    const out = execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
    if (!out) return [];
    const parsed = JSON.parse(out) as
      | { Name?: string; Default?: boolean; PrinterStatus?: number; WorkOffline?: boolean }
      | Array<{
          Name?: string;
          Default?: boolean;
          PrinterStatus?: number;
          WorkOffline?: boolean;
        }>;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((x) => x && typeof x.Name === 'string' && x.Name.length > 0)
      .map((x) => ({
        name: String(x.Name),
        isDefault: !!x.Default,
        printerStatus:
          typeof x.PrinterStatus === 'number' ? x.PrinterStatus : undefined,
        workOffline: !!x.WorkOffline,
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
