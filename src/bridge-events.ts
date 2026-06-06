import { EventEmitter } from 'events';

export type BridgeState = 'starting' | 'ready' | 'no-printer' | 'printing' | 'error';

export interface BridgeStatus {
  state: BridgeState;
  wsPort: number;
  uiPort: number;
  printerName: string | null;
  printerType: 'thermal' | 'regular';
  lastPrintAt: string | null;
  lastPrintOrderId: string | null;
  lastError: string | null;
  queuePending: number;
}

export interface BridgeNotification {
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
}

export class BridgeEventBus extends EventEmitter {
  emitStatus(status: BridgeStatus): void {
    this.emit('status', status);
  }

  emitNotification(n: BridgeNotification): void {
    this.emit('notification', n);
  }
}
