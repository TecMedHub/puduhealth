// Analiza grabaciones del pulsómetro o de la app (muestras [t, timestamp, R, G, B]) con ppg.js,
// en ventanas de 60 s como la medición de la app, y estima estrés contra una línea base.
//
// Uso: node ml/analizar_grabaciones.mjs --base descanso.json otra.json [...]
//   --base: grabación en reposo que define la línea base (mediana de sus ventanas válidas).

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { estimarEstres } from '../app/js/modelos.js';

const require = createRequire(import.meta.url);
const PPG = require('../pulsometro/assets/ppg.js');
const modelo = JSON.parse(readFileSync(new URL('../app/modelos/estres.json', import.meta.url)));

const VENTANA = 60;
const MAX_FRACCION_MOVIMIENTO = 0.1;
const PASO = 30;
const CALIDAD_MIN = modelo.calidad_minima;

const args = process.argv.slice(2);
const iBase = args.indexOf('--base');
const archivoBase = iBase >= 0 ? args.splice(iBase, 2)[1] : null;
const archivos = archivoBase ? [archivoBase, ...args] : args;

const mediana = (a) => {
  const o = [...a].sort((x, y) => x - y);
  const k = o.length >> 1;
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};
const f1 = (v) => (v === null || v === undefined ? '  —  ' : v.toFixed(1).padStart(5));

function analizar(ruta) {
  const d = JSON.parse(readFileSync(ruta, 'utf8'));
  // Cuadros duplicados (mismo instante): versiones del pulsómetro anteriores a la corrección
  // del ciclo de captura procesaban cada cuadro varias veces.
  const duplicados = d.muestras.filter((s, i) => i > 0 && s[0] === d.muestras[i - 1][0]).length;
  const m = d.muestras.filter((s, i) => i === 0 || s[0] !== d.muestras[i - 1][0]);
  const t = m.map((s) => s[0]);
  const dur = t.at(-1) - t[0];
  const difs = t.slice(1).map((x, i) => x - t[i]);
  const dedo = m.map((s) => PPG.dedoPresente(s[2], s[3], s[4]));

  console.log(`\n${basename(ruta)} · ${d.prueba ?? '?'} · ${(dur / 60).toFixed(1)} min · ${m.length} cuadros`);
  console.log(`  fps real ${(m.length / dur).toFixed(1)} · intervalo mediano ${(1000 * mediana(difs)).toFixed(1)} ms · ` +
    `máx ${(1000 * Math.max(...difs)).toFixed(0)} ms · duplicados descartados ${duplicados} · ` +
    `con dedo ${(100 * dedo.filter(Boolean).length / m.length).toFixed(0)} %`);

  const ventanas = [];
  for (let ini = t[0]; ini + VENTANA <= t.at(-1) + 0.5; ini += PASO) {
    const idx = t.map((x, i) => i).filter((i) => t[i] >= ini && t[i] < ini + VENTANA);
    const fracDedo = idx.filter((i) => dedo[i]).length / idx.length;
    // Movimiento (grabaciones con acelerómetro): fracción de segundos con RMS sobre el umbral.
    let fracMov = null;
    if (Array.isArray(d.movimiento) && d.movimiento.length) {
      const umbral = d.umbral_movimiento ?? 0.5;
      const ts0 = m[idx[0]][1];
      const ts1 = m[idx.at(-1)][1];
      const seg = d.movimiento.filter(([ts, rms]) => ts >= ts0 && ts <= ts1 && rms !== null);
      if (seg.length) fracMov = seg.filter(([, rms]) => rms > umbral).length / seg.length;
    }
    const a = PPG.analizar(idx.map((i) => t[i]), idx.map((i) => m[i][2]));
    ventanas.push({
      ini, fracDedo, fracMov,
      bpm: a?.bpm ?? null, calidad: a?.calidad.puntaje ?? 0, rmssd: a?.rmssd ?? null, sdnn: a?.sdnn ?? null,
      valida: Boolean(a?.bpm) && (a?.calidad.puntaje ?? 0) >= CALIDAD_MIN && fracDedo >= 0.9
        && !(fracMov !== null && fracMov > MAX_FRACCION_MOVIMIENTO),
    });
  }
  // Una grabación corta (< 60 s de ventana completa) se analiza entera.
  if (!ventanas.length) {
    const a = PPG.analizar(t, m.map((s) => s[2]));
    ventanas.push({ ini: t[0], fracDedo: dedo.filter(Boolean).length / m.length, bpm: a?.bpm ?? null, calidad: a?.calidad.puntaje ?? 0, rmssd: a?.rmssd ?? null, sdnn: a?.sdnn ?? null, valida: false });
  }
  return { ruta, d, ventanas };
}

const resultados = archivos.map(analizar);

let base = null;
if (archivoBase) {
  const validas = resultados[0].ventanas.filter((v) => v.valida);
  if (validas.length) {
    base = {
      bpm: mediana(validas.map((v) => v.bpm)),
      rmssd: mediana(validas.map((v) => v.rmssd).filter(Boolean)),
      sdnn: mediana(validas.map((v) => v.sdnn).filter(Boolean)),
    };
  }
  console.log(`\nLínea base (${basename(archivoBase)}): ${base ? `${base.bpm.toFixed(1)} lpm, ${validas.length} ventanas válidas` : 'sin ventanas válidas'}`);
}

for (const r of resultados) {
  console.log(`\n${basename(r.ruta)}`);
  console.log('  inicio  dedo   mov    FC     cal  RMSSD  válida  estrés');
  for (const v of r.ventanas) {
    const e = base && v.valida ? estimarEstres(modelo, { bpm: v.bpm, calidad: v.calidad }, base) : null;
    const mov = v.fracMov === null || v.fracMov === undefined ? '  —  ' : `${String(Math.round(100 * v.fracMov)).padStart(3)} %`;
    console.log(`  ${String(Math.round(v.ini)).padStart(5)}s ${String(Math.round(100 * v.fracDedo)).padStart(4)} % ${mov} ${f1(v.bpm)} ${String(v.calidad).padStart(5)} ${f1(v.rmssd)}  ${v.valida ? '  sí  ' : '  no  '}  ${e ? `${Math.round(100 * e.probabilidad)} %` : ''}`);
  }
  const validas = r.ventanas.filter((v) => v.valida);
  if (validas.length) console.log(`  → FC mediana ${mediana(validas.map((v) => v.bpm)).toFixed(1)} lpm en ${validas.length}/${r.ventanas.length} ventanas válidas`);
  else console.log(`  → ninguna ventana válida (calidad ≥ ${CALIDAD_MIN} y dedo ≥ 90 %)`);
}
