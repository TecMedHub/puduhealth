// Calibración del detector de línea base:
//   - falsas alarmas: % de días con alerta sobre datos reales de PMData (vida diaria, sin vuelo espacial);
//   - sensibilidad: anticipación de la alerta en la misión simulada de la demo.
//
// Uso: node ml/calibrar_detector.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineaBase, analizarSerie, PARAMETROS, DE_MINIMA } from '../app/js/lineabase.js';
import { simularTripulacion } from '../app/js/simulador.js';
import { indexar, calcularEstado } from '../app/js/estado.js';
import { evaluarReglas } from '../app/js/motor.js';
import { SEMILLA_DEMO, ESCENARIOS } from '../app/js/escenario.js';

const raiz = dirname(fileURLToPath(import.meta.url));
const DIAS_BASE = 21;

const [cab, ...lineas] = readFileSync(join(raiz, 'cache', 'pmdata_diario.csv'), 'utf8').trim().split('\n');
const cols = cab.split(',');
const filas = lineas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
const personas = [...new Set(filas.map((f) => f.persona))];

function falsasAlarmas(variable) {
  let dias = 0;
  let alertas = 0;
  for (const p of personas) {
    const propias = filas.filter((f) => f.persona === p && f[variable] !== '');
    if (!propias.length) continue;
    const t0 = Date.parse(filas.find((f) => f.persona === p).fecha);
    const serie = propias.map((f) => ({ dia: Math.round((Date.parse(f.fecha) - t0) / 864e5) - DIAS_BASE, valor: Number(f[variable]) }));
    const base = lineaBase(serie.filter((r) => r.dia < 0), variable);
    if (!base) continue;
    for (let i = 0; i < serie.length; i++) {
      if (serie[i].dia < 0) continue;
      dias++;
      if (analizarSerie(serie.slice(0, i + 1), base, variable === 'sueno' ? 'baja' : 'alta').desviada) alertas++;
    }
  }
  return alertas / dias;
}

// Sensibilidad sobre ruido real: alza sostenida de FC desde el día 30; días hasta la primera alerta.
function demoraDeteccion(alza) {
  const demoras = [];
  for (const p of personas) {
    const propias = filas.filter((f) => f.persona === p && f.fc_reposo !== '');
    if (!propias.length) continue;
    const t0 = Date.parse(filas.find((f) => f.persona === p).fecha);
    const serie = propias.map((f) => {
      const dia = Math.round((Date.parse(f.fecha) - t0) / 864e5) - DIAS_BASE;
      return { dia, valor: Number(f.fc_reposo) + (dia >= 30 ? alza : 0) };
    });
    const base = lineaBase(serie.filter((r) => r.dia < 0), 'fc_reposo');
    if (!base || !serie.some((r) => r.dia >= 30)) continue;
    let demora = null;
    for (let i = 0; i < serie.length && demora === null; i++) {
      if (serie[i].dia >= 30 && analizarSerie(serie.slice(0, i + 1), base, 'alta').desviada) demora = serie[i].dia - 30;
    }
    demoras.push(demora ?? Infinity);
  }
  demoras.sort((a, b) => a - b);
  return demoras[Math.floor(demoras.length / 2)];
}

function simulador() {
  // Anticipación de la primera alerta ámbar de la comandante respecto del rojo de VO2max,
  // y % de días con CV-03 en el resto de la tripulación (falsas alarmas simuladas).
  const sim = simularTripulacion(SEMILLA_DEMO, ESCENARIOS.transito);
  const idx = indexar(sim.registros);
  let ambar = null;
  let rojo = null;
  for (let d = 120; d < sim.escenario.diasMision; d++) {
    const a = evaluarReglas(calcularEstado(idx, 'P01', d, sim.escenario));
    if (ambar === null && a.some((x) => x.nivel === 'ambar')) ambar = d;
    if (rojo === null && a.some((x) => x.id === 'CV-01')) rojo = d;
  }
  let dias = 0;
  let cv03 = 0;
  for (const p of ['P02', 'P03', 'P04']) {
    for (let d = 0; d < sim.escenario.diasMision; d += 3) {
      dias++;
      if (evaluarReglas(calcularEstado(idx, p, d, sim.escenario)).some((x) => x.id === 'CV-03')) cv03++;
    }
  }
  return { anticipacion: rojo !== null && ambar !== null ? rojo - ambar : null, cv03: cv03 / dias };
}

const original = { ...PARAMETROS, deFc: DE_MINIMA.fc_reposo };
const pct = (x) => `${(100 * x).toFixed(1)} %`;
console.log('deFc  zAlerta  ewma  sostenidas | FA FC real | FA sueño real | demora +5 lpm | demora +8 lpm | anticipación demo');
for (const deFc of [2, 3, 4]) {
  for (const zAlerta of [2, 2.5]) {
    for (const ewmaAlerta of [1, 1.5]) {
      for (const sostenidas of [7, 10]) {
        DE_MINIMA.fc_reposo = deFc;
        Object.assign(PARAMETROS, { zAlerta, ewmaAlerta, medicionesSostenidas: sostenidas });
        const s = simulador();
        console.log(`${deFc}     ${zAlerta}      ${ewmaAlerta}   ${sostenidas}         | ${pct(falsasAlarmas('fc_reposo')).padStart(9)} | ${pct(falsasAlarmas('sueno')).padStart(12)} | ${String(demoraDeteccion(5)).padStart(8)} días | ${String(demoraDeteccion(8)).padStart(8)} días | ${s.anticipacion} días`);
      }
    }
  }
}
Object.assign(PARAMETROS, { zAlerta: original.zAlerta, ewmaAlerta: original.ewmaAlerta, medicionesSostenidas: original.medicionesSostenidas });
DE_MINIMA.fc_reposo = original.deFc;
