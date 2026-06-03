/** WebSocket: panel → bridge (impresión). Evita conflicto con Vite/panel en 8080. */
export const WS_PORT = 17880;

/** HTTP local: elegir impresora (http://127.0.0.1:17881). */
export const UI_PORT = 17881;

export const BRIDGE_HOST = '127.0.0.1';

export const WS_URL = `ws://${BRIDGE_HOST}:${WS_PORT}`;

export const UI_URL = `http://${BRIDGE_HOST}:${UI_PORT}`;
