// Aviso de versión nueva: mira la última Release de GitHub (repositorio público, sin claves).
// No instala nada solo: Android exige que la persona toque «Instalar» tras descargar el APK.
import { VERSION, REPO } from './version.js';

const numeros = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? m.slice(1).map(Number) : null;
};

export function esMasNueva(actual, remota) {
  const a = numeros(actual);
  const b = numeros(remota);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] > a[i];
  return false;
}

export function leerRelease(json) {
  if (!json || !json.tag_name) return null;
  const apk = (json.assets || []).find((x) => /\.apk$/i.test(x.name));
  return {
    version: String(json.tag_name).replace(/^v/, ''),
    apk: apk ? apk.browser_download_url : null,
    pagina: json.html_url || null,
  };
}

// Devuelve la release si es más nueva que esta versión; null si no, o si no hay red.
export async function buscarActualizacion(fetchFn = fetch) {
  try {
    const r = await fetchFn(`https://api.github.com/repos/${REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const rel = leerRelease(await r.json());
    return rel && esMasNueva(VERSION, rel.version) ? rel : null;
  } catch {
    return null;
  }
}
