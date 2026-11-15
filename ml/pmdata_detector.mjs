// Corre el detector de la app (app/js/lineabase.js, sin cambios) sobre datos reales de PMData.
// Los primeros 21 días de cada persona hacen de línea base; el resto, de "misión".
//
// Uso: node ml/pmdata_detector.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineaBase, analizarSerie } from '../app/js/lineabase.js';
import { TIPOS } from '../app/js/datos.js';

const raiz = dirname(fileURLToPath(import.meta.url));
const DIAS_BASE = 21;
const VARIABLES = ['fc_reposo', 'sueno'];

const [cabecera, ...lineas] = readFileSync(join(raiz, 'cache', 'pmdata_diario.csv'), 'utf8').trim().split('\n');
const columnas = cabecera.split(',');
const filas = lineas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [columnas[i], v])));

const porPersona = new Map();
for (const f of filas) {
  if (!porPersona.has(f.persona)) porPersona.set(f.persona, []);
  porPersona.get(f.persona).push(f);
}

const salida = [['persona', 'fecha', 'dia', ...VARIABLES.flatMap((v) => [`z_${v}`, `ewma_${v}`, `desviada_${v}`]), 'noches_cortas_7d'].join(',')];
const fmt = (x) => (x === null || x === undefined || Number.isNaN(x) ? '' : Math.round(x * 1000) / 1000);

for (const [persona, dias] of porPersona) {
  dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const t0 = Date.parse(dias[0].fecha);
  const dia = (f) => Math.round((Date.parse(f.fecha) - t0) / 86400000) - DIAS_BASE;

  const series = {};
  for (const v of VARIABLES) {
    series[v] = dias
      .filter((f) => f[v] !== '')
      .map((f) => ({ dia: dia(f), valor: Number(f[v]), fase: dia(f) < 0 ? 'tierra' : 'transito' }));
  }
  const bases = Object.fromEntries(VARIABLES.map((v) => [v, lineaBase(series[v].filter((r) => r.dia < 0), v)]));

  for (const f of dias) {
    const d = dia(f);
    if (d < 0) continue;
    const celdas = [persona, f.fecha, d];
    for (const v of VARIABLES) {
      const hasta = series[v].filter((r) => r.dia <= d);
      const a = analizarSerie(hasta, bases[v], TIPOS[v].direccionMala);
      const hoy = hasta.at(-1)?.dia === d;
      celdas.push(hoy ? fmt(a.z) : '', fmt(a.ewma), a.base && hoy ? Number(a.desviada) : '');
    }
    const cortas = series.sueno.filter((r) => r.dia > d - 7 && r.dia <= d && r.valor < 7).length;
    celdas.push(cortas);
    salida.push(celdas.join(','));
  }
}

writeFileSync(join(raiz, 'cache', 'pmdata_detector.csv'), salida.join('\n') + '\n');
console.log(`→ ml/cache/pmdata_detector.csv (${salida.length - 1} días evaluados, ${porPersona.size} personas)`);
