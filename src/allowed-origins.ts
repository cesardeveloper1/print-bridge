export const ALLOWED_ORIGINS = [
  'https://admin.agiliza360.ai', // panel en producción
  'http://localhost:8080',       // panel — Vite dev server
];

export function isOriginAllowed(origin: string | undefined, packaged: boolean): boolean {
  if (!origin) {
    // wscat y pruebas manuales no mandan Origin; solo permitir en dev (no empaquetado)
    return !packaged;
  }
  return ALLOWED_ORIGINS.includes(origin);
}
