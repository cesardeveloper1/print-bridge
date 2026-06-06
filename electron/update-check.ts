import { app, Notification, shell } from 'electron';
import { fileLog } from '../src/file-logger';

const GITHUB_REPO = 'cesardeveloper1/print-bridge';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

interface GitHubRelease {
  tag_name: string;
  html_url: string;
}

function parseVersion(tag: string): [number, number, number] {
  const clean = tag.replace(/^print-bridge-v?/, '');
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function isNewer(remote: [number, number, number], local: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (remote[i] > local[i]) return true;
    if (remote[i] < local[i]) return false;
  }
  return false;
}

export async function checkForUpdates(silent = false): Promise<void> {
  try {
    const res = await fetch(RELEASES_API, {
      headers: {
        'User-Agent': `Maxy-Print-Bridge/${app.getVersion()}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API devolvió ${res.status}`);
    }

    const release = (await res.json()) as GitHubRelease;
    const remoteVer = parseVersion(release.tag_name);
    const localVer = parseVersion(`print-bridge-${app.getVersion()}`);

    if (isNewer(remoteVer, localVer)) {
      const n = new Notification({
        title: 'Actualización disponible',
        body: `Versión ${release.tag_name.replace(/^print-bridge-v?/, '')} disponible. Haga clic para descargar.`,
      });
      n.on('click', () => void shell.openExternal(release.html_url));
      n.show();
    } else if (!silent) {
      new Notification({
        title: 'Maxy Print Bridge',
        body: 'Ya tienes la versión más reciente.',
      }).show();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fileLog.warn(`update check failed: ${msg}`);
    if (!silent) {
      new Notification({
        title: 'Maxy Print Bridge',
        body: `No se pudo verificar actualizaciones: ${msg}`,
      }).show();
    }
  }
}
