import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const aqui = new URL('../', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, aqui), 'utf8');

test('sin conexión: el service worker guarda todos los archivos que usa la app', () => {
  const lista = leer('sw.js').match(/const ARCHIVOS = \[([\s\S]*?)\]/)[1];
  const archivos = new Set([...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const esperados = [
    'index.html',
    ...readdirSync(new URL('js/', aqui)).map((f) => `js/${f}`),
    ...readdirSync(new URL('css/', aqui)).map((f) => `css/${f}`),
    ...readdirSync(new URL('modelos/', aqui)).map((f) => `modelos/${f}`),
    ...[...leer('index.html').matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)].map((m) => m[1]),
  ];
  for (const f of esperados) assert.ok(archivos.has(f), `falta en sw.js: ${f}`);
  for (const f of archivos) if (f !== './') assert.doesNotThrow(() => leer(f), `no existe: ${f}`);
});
