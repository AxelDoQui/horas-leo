import test from 'node:test';
import assert from 'node:assert/strict';
import { esMasNueva, leerRelease } from '../www/actualizar.js';

test('esMasNueva compara número a número, no como texto', () => {
  assert.equal(esMasNueva('1.1.0', 'v1.1.1'), true);
  assert.equal(esMasNueva('1.1.0', '1.10.0'), true);
  assert.equal(esMasNueva('1.1.0', 'v1.1.0'), false);
  assert.equal(esMasNueva('1.2.0', '1.1.9'), false);
  assert.equal(esMasNueva('1.1.0', 'basura'), false);
});

test('leerRelease saca versión y enlace del APK, o null si no hay APK', () => {
  const r = { tag_name: 'v1.2.0', html_url: 'https://x/r', assets: [
    { name: 'otro.txt', browser_download_url: 'https://x/o' },
    { name: 'Horas Leo.apk', browser_download_url: 'https://x/a.apk' }] };
  assert.deepEqual(leerRelease(r), { version: '1.2.0', apk: 'https://x/a.apk', pagina: 'https://x/r' });
  assert.equal(leerRelease({ tag_name: 'v1.2.0', assets: [] }).apk, null);
  assert.equal(leerRelease(null), null);
});
