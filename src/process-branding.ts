/** Nombre visible en título de terminal, Activity Monitor, etc. */
export const BRIDGE_DISPLAY_NAME = 'Maxy Print Bridge';

export function applyProcessBranding(): void {
  process.title = BRIDGE_DISPLAY_NAME;
}

export function isPackagedBinary(): boolean {
  return !!(process as NodeJS.Process & { pkg?: unknown }).pkg;
}
