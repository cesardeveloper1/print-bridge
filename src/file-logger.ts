import * as fs from 'fs';
import * as path from 'path';
import { configDir } from './config-store';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function logFilePath(): string {
  return path.join(configDir(), 'bridge.log');
}

function rotateIfNeeded(logPath: string): void {
  try {
    const stat = fs.statSync(logPath);
    if (stat.size >= MAX_BYTES) {
      fs.renameSync(logPath, logPath + '.1');
    }
  } catch {
    /* file doesn't exist yet — ignore */
  }
}

export function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  try {
    const dir = configDir();
    fs.mkdirSync(dir, { recursive: true });
    const logPath = logFilePath();
    rotateIfNeeded(logPath);
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    /* never throw from logger */
  }
}

export const fileLog = {
  info: (msg: string) => writeLog('INFO', msg),
  warn: (msg: string) => writeLog('WARN', msg),
  error: (msg: string) => writeLog('ERROR', msg),
};
