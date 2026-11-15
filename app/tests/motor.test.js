import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarCondicion, evaluarReglas, semaforo } from '../js/motor.js';
import { lineaBase, analizarSerie } from '../js/lineabase.js';
import { REGLAS } from '../js/reglas.js';
import { simularTripulacion } from '../js/simulador.js';
import { indexar, calcularEstado } from '../js/estado.js';
import { SEMILLA_DEMO, ESCENARIOS } from '../js/escenario.js';

const serie = (valores, desde = 0) => valores.map((valor, i) => ({ valor, dia: desde + i }));

test('línea base aplica la desviación estándar mínima', () => {
  const base = lineaBase(serie([60, 60, 60]), 'fc_reposo');
  assert.equal(base.media, 60);
  assert.equal(base.de, 3);
});

test('una medición aislada fuera de rango no alerta; dos seguidas sí', () => {
  const base = { media: 60, de: 2 };
  assert.equal(analizarSerie(serie([60, 60, 65]), base, 'alta').desviada, false);
  assert.equal(analizarSerie(serie([60, 65, 65]), base, 'alta').desviada, true);
});

test('una tendencia sostenida alerta aunque ninguna medición llegue a z = 2', () => {
  const base = { media: 60, de: 2 };
  const valores = Array.from({ length: 30 }, () => 63.8); // z = 1,9 sostenido
  assert.equal(analizarSerie(serie(valores), base, 'alta').desviada, true);
});

test('la dirección desfavorable importa', () => {
  const base = { media: 60, de: 2 };
  assert.equal(analizarSerie(serie([55, 55]), base, 'alta').desviada, false);
  assert.equal(analizarSerie(serie([55, 55]), base, 'baja').desviada, true);
});

test('condiciones: valor, referencia, compuestas y datos faltantes', () => {
  const estado = { vo2max: 30, vo2max_linea_base: 40, phq9: null, variables: { fc_reposo: { desviada: true } } };
  assert.equal(evaluarCondicion({ var: 'vo2max', op: '<', ref: 'vo2max_linea_base', factor: 0.8 }, estado), true);
  assert.equal(evaluarCondicion({ var: 'vo2max', op: '<', valor: 32.9 }, estado), true);
  assert.equal(evaluarCondicion({ var: 'phq9', op: '>=', valor: 10 }, estado), false);
  assert.equal(evaluarCondicion({ desviada: 'fc_reposo' }, estado), true);
  assert.equal(evaluarCondicion({ todas: [{ desviada: 'fc_reposo' }, { var: 'vo2max', op: '>', valor: 50 }] }, estado), false);
  assert.equal(evaluarCondicion({ cualquiera: [{ desviada: 'vfc_rmssd' }, { var: 'vo2max', op: '<', valor: 50 }] }, estado), true);
});

test('toda regla tiene fuente y recomendación en ambos idiomas', () => {
  const ids = new Set();
  for (const r of REGLAS) {
    assert.ok(!ids.has(r.id), `id repetido ${r.id}`);
    ids.add(r.id);
    assert.ok(r.fuente);
    assert.ok(r.recomendacion.es && r.recomendacion.en);
    assert.ok(['info', 'ambar', 'rojo'].includes(r.nivel));
  }
});

test('semáforo toma el peor nivel por riesgo', () => {
  const s = semaforo([
    { riesgo: 'cardiovascular', nivel: 'ambar' },
    { riesgo: 'cardiovascular', nivel: 'rojo' },
    { riesgo: 'hueso', nivel: 'ambar' },
  ]);
  assert.equal(s.cardiovascular, 'rojo');
  assert.equal(s.hueso, 'ambar');
  assert.equal(s.inmune, 'verde');
});

test('demostración: alerta temprana antes del umbral rojo de VO2max', () => {
  const sim = simularTripulacion(SEMILLA_DEMO, ESCENARIOS.transito);
  const idx = indexar(sim.registros);
  let primeraAmbar = null;
  let primeraCv01 = null;
  for (let dia = 120; dia < sim.escenario.diasMision; dia++) {
    const alertas = evaluarReglas(calcularEstado(idx, 'P01', dia, sim.escenario));
    if (primeraAmbar === null && alertas.some((a) => a.nivel === 'ambar')) primeraAmbar = dia;
    if (primeraCv01 === null && alertas.some((a) => a.id === 'CV-01')) primeraCv01 = dia;
  }
  assert.ok(primeraCv01 !== null, 'la comandante debe cruzar el umbral de VO2max');
  assert.ok(primeraCv01 - primeraAmbar >= 21, `anticipación insuficiente: ${primeraCv01 - primeraAmbar} días`);
});

test('semáforo: un nivel desconocido es un error, no se ignora', () => {
  assert.throws(() => semaforo([{ riesgo: 'inmune', nivel: 'amarillo' }]), /Nivel desconocido/);
});
