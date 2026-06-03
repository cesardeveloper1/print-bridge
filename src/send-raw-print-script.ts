import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileLog } from './file-logger';

const SCRIPT_NAME = 'send-raw-print.ps1';

// Contenido embebido para que el .exe no dependa del filesystem virtual de pkg
// ni de dónde fue lanzado el proceso.
const EMBEDDED_PS1 = `param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Archivo de datos no encontrado: $FilePath"
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
if ($bytes.Length -eq 0) {
  throw 'El ticket está vacío.'
}

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFO di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void Send(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "OpenPrinter failed");
    }
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = "Maxy Print Bridge";
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) {
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "StartDocPrinter failed");
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "StartPagePrinter failed");
        }
        try {
          int written;
          if (!WritePrinter(hPrinter, bytes, bytes.Length, out written) || written != bytes.Length) {
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "WritePrinter failed");
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@

try {
  [RawPrinterHelper]::Send($PrinterName, $bytes)
  Write-Output 'OK'
} catch {
  throw $_.Exception.Message
}
`;

/** Ruta estable en disco real donde PowerShell puede leer el script. */
export function getTempScriptPath(): string {
  return path.join(os.tmpdir(), 'MaxyPrintBridge', SCRIPT_NAME);
}

const DEV_DISK_CANDIDATES = [
  path.join(__dirname, '..', 'scripts', SCRIPT_NAME),
  path.join(__dirname, '..', '..', 'scripts', SCRIPT_NAME),
  path.join(process.cwd(), 'scripts', SCRIPT_NAME),
  path.join(path.dirname(process.execPath), 'scripts', SCRIPT_NAME),
];

let cachedScriptPath: string | null = null;

function writeTempCopy(): string {
  const dest = getTempScriptPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, EMBEDDED_PS1, 'utf8');
  return dest;
}

/**
 * Ruta real al .ps1 para impresión RAW en Windows.
 * En .exe (pkg): siempre extrae el contenido embebido a %TEMP%\MaxyPrintBridge\.
 * En dev: usa el archivo real de disco si existe, si no extrae igualmente.
 */
export function ensureSendRawPrintScript(): string {
  if (cachedScriptPath && fs.existsSync(cachedScriptPath)) {
    return cachedScriptPath;
  }

  const isPkg = Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);

  if (!isPkg) {
    for (const p of DEV_DISK_CANDIDATES) {
      if (fs.existsSync(p)) {
        cachedScriptPath = p;
        return p;
      }
    }
  }

  const tempPath = getTempScriptPath();
  if (fs.existsSync(tempPath)) {
    cachedScriptPath = tempPath;
    return tempPath;
  }

  cachedScriptPath = writeTempCopy();
  fileLog.info(
    `send-raw-print.ps1 listo en ${cachedScriptPath}${isPkg ? ' (embebido en .exe)' : ''}`,
  );
  return cachedScriptPath;
}

/** Precalienta el script al arrancar (evita fallo en la primera impresión). */
export function warmupSendRawPrintScript(): void {
  if (process.platform !== 'win32') return;
  try {
    ensureSendRawPrintScript();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fileLog.warn(`warmup send-raw-print.ps1: ${msg}`);
  }
}
