// Extrae indicadores de cada ventana de BVP con el mismo ppg.js que usa la app.
//
// Uso: node ml/extraer_ppg.mjs [--invertir]
//   --invertir: invierte el BVP antes de analizar (ppg.js espera la convención de la
//               cámara, donde cada latido oscurece la imagen).

import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const PPG = createRequire(import.meta.url)('../pulsometro/assets/ppg.js');

const invertir = process.argv.includes('--invertir');
const origen = join(raiz, 'cache', 'wesad');
const destino = join(raiz, 'cache', invertir ? 'wesad_ppg_inv.csv' : 'wesad_ppg.csv');

const columnas = ['sujeto', 'etiqueta', 'inicio', 'bpm', 'bpm_tiempo', 'bpm_frec', 'rmssd', 'sdnn', 'latidos', 'calidad', 'concentracion', 'cv'];
const filas = [columnas.join(',')];
const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? '' : Math.round(v * 1000) / 1000);

for (const archivo of readdirSync(origen).filter((f) => f.endsWith('.json')).sort()) {
  const { sujeto, fs, bvp, ventanas } = JSON.parse(readFileSync(join(origen, archivo), 'utf8'));
  for (const v of ventanas) {
    const r = bvp.slice(v.i0, v.i1).map((x) => (invertir ? -x : x));
    const t = r.map((_, i) => i / fs);
    const a = PPG.analizar(t, r);
    if (!a) continue;
    filas.push([
      sujeto, v.etiqueta, v.inicio, a.bpm, a.bpmTiempo, a.bpmFrec, a.rmssd, a.sdnn,
      a.latidos, a.calidad.puntaje, a.concentracion, a.calidad.cv,
    ].map((x) => (typeof x === 'number' ? fmt(x) : x ?? '')).join(','));
  }
  console.log(`${sujeto}: ${ventanas.length} ventanas`);
}

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, filas.join('\n') + '\n');
console.log(`→ ${destino} (${filas.length - 1} filas)`);
