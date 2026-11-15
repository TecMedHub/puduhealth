import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simularTripulacion } from '../js/simulador.js';
import { TIPOS, FASES } from '../js/datos.js';
import { ESCENARIO } from '../js/escenario.js';

test('misma semilla produce la misma tripulación', () => {
  const a = simularTripulacion('x');
  const b = simularTripulacion('x');
  assert.deepEqual(a.registros, b.registros);
});

test('semillas distintas producen datos distintos', () => {
  const a = simularTripulacion('x');
  const b = simularTripulacion('y');
  assert.notDeepEqual(a.registros.slice(0, 50), b.registros.slice(0, 50));
});

test('todos los registros cumplen el formato común', () => {
  const { registros } = simularTripulacion('formato');
  for (const r of registros) {
    assert.ok(TIPOS[r.tipo], r.tipo);
    assert.equal(r.unidad, TIPOS[r.tipo].unidad);
    assert.ok(FASES[r.fase]);
    assert.ok(Number.isFinite(r.valor));
    assert.match(r.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-03:00$/);
    assert.equal(r.fase === 'tierra', r.dia < 0);
  }
});

test('cubre línea base y misión completas', () => {
  const { registros, personas } = simularTripulacion('cobertura');
  assert.equal(personas.length, ESCENARIO.tamanoTripulacion);
  const dias = registros.filter((r) => r.persona === 'P01' && r.tipo === 'fc_reposo').map((r) => r.dia);
  assert.equal(Math.min(...dias), -ESCENARIO.diasLineaBase);
  assert.equal(Math.max(...dias), ESCENARIO.diasMision - 1);
});

test('agregar una persona no cambia los datos de las demás', () => {
  const tres = simularTripulacion('estable', { tamanoTripulacion: 3 });
  const cuatro = simularTripulacion('estable', { tamanoTripulacion: 4 });
  const p02 = (sim) => sim.registros.filter((r) => r.persona === 'P02');
  assert.deepEqual(p02(tres), p02(cuatro));
});

test('la dosis de tránsito sigue la tasa de MSL RAD', () => {
  const { registros } = simularTripulacion('dosis');
  const transito = registros.filter((r) => r.persona === 'P01' && r.tipo === 'dosis_radiacion' && r.fase === 'transito');
  const valores = transito.map((r) => r.valor).sort((a, b) => a - b);
  const mediana = valores[Math.floor(valores.length / 2)];
  assert.ok(Math.abs(mediana - ESCENARIO.radiacion.transito_mSv_dia) < 0.1);
});

test('las tormentas solares son las cinco medidas por MSL RAD en el crucero de Curiosity', async () => {
  const { eventosSolares } = await import('../js/simulador.js');
  const { ESCENARIOS } = await import('../js/escenario.js');
  const solares = eventosSolares(ESCENARIOS.transito);
  const total = [...solares.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 24.7) < 1e-9); // 4,0 + 19,5 + 1,2 mSv
  assert.deepEqual([...solares.keys()].filter((d) => d < 100), [58, 59, 60, 61, 62, 63, 64]); // 23 al 29 de enero
  assert.ok(solares.has(102) && solares.has(110) && solares.has(173) && solares.has(174));
  assert.ok(Math.max(...solares.keys()) < ESCENARIOS.transito.diasMision);
});

test('misión a Marte: crucero en la ida y el regreso, y la tormenta de superficie del sol 242', async () => {
  const { eventosSolares } = await import('../js/simulador.js');
  const solares = eventosSolares(ESCENARIO);
  const total = (desde, hasta) => [...solares].filter(([d]) => d >= desde && d < hasta).reduce((a, [, v]) => a + v, 0);
  assert.ok(Math.abs(total(0, 180) - 24.7) < 1e-9);
  assert.ok(Math.abs(total(180, 680) - 0.025) < 1e-9);
  assert.equal(solares.get(429), 0.025); // 12-4-2013, 249 días después del aterrizaje
  assert.ok(Math.abs(total(680, 860) - 24.7) < 1e-9);
});
