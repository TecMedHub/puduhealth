import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCENARIOS, ESCENARIO, faseDelDia, sinEnlace } from '../js/escenario.js';
import { simularTripulacion } from '../js/simulador.js';
import { indexar, calcularEstado } from '../js/estado.js';
import { evaluarReglas } from '../js/motor.js';

const marte = ESCENARIOS.marte;
const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

test('la misión a Marte es el escenario por defecto y sus fases suman la misión', () => {
  assert.equal(ESCENARIO, marte);
  for (const esc of Object.values(ESCENARIOS)) {
    assert.equal(esc.fases.reduce((a, f) => a + f.dias, 0), esc.diasMision, esc.id);
  }
});

test('fases de la misión a Marte: ida, superficie y regreso', () => {
  assert.equal(faseDelDia(marte, -1), 'tierra');
  assert.equal(faseDelDia(marte, 179), 'transito');
  assert.equal(faseDelDia(marte, 180), 'superficie');
  assert.equal(faseDelDia(marte, 679), 'superficie');
  assert.equal(faseDelDia(marte, 680), 'regreso');
  assert.equal(faseDelDia(ESCENARIOS.transito, 209), 'transito');
});

test('conjunción solar: sin enlace dos semanas durante la estadía; nunca en el viaje de ida', () => {
  assert.equal(sinEnlace(marte, marte.conjuncion.inicio), true);
  assert.equal(sinEnlace(marte, marte.conjuncion.inicio + marte.conjuncion.dias), false);
  assert.equal(faseDelDia(marte, marte.conjuncion.inicio), 'superficie');
  for (let d = 0; d < 210; d++) assert.equal(sinEnlace(ESCENARIOS.transito, d), false);
});

test('la dosis diaria sigue las tasas de MSL RAD en cada fase', () => {
  const { registros } = simularTripulacion('fases');
  const dosis = (fase) => registros.filter((r) => r.persona === 'P01' && r.tipo === 'dosis_radiacion' && r.fase === fase).map((r) => r.valor);
  assert.ok(Math.abs(mediana(dosis('transito')) - marte.radiacion.transito_mSv_dia) < 0.1);
  assert.ok(Math.abs(mediana(dosis('regreso')) - marte.radiacion.transito_mSv_dia) < 0.1);
  assert.ok(Math.abs(mediana(dosis('superficie')) - marte.radiacion.superficie_mSv_dia) < 0.05);
});

test('la misión completa supera el límite de carrera: primero ámbar, luego rojo', () => {
  const sim = simularTripulacion('limite');
  const idx = indexar(sim.registros);
  let ambar = null;
  let rojo = null;
  for (let d = 0; d < marte.diasMision; d += 5) {
    const ids = evaluarReglas(calcularEstado(idx, 'P01', d, sim.escenario)).map((a) => a.id);
    if (ambar === null && ids.includes('RA-01')) ambar = d;
    if (rojo === null && ids.includes('RA-02')) rojo = d;
  }
  assert.ok(ambar !== null && rojo !== null && ambar < rojo, `RA-01 ${ambar}, RA-02 ${rojo}`);
  assert.ok(calcularEstado(idx, 'P01', marte.diasMision - 1, sim.escenario).dosis_acumulada > marte.radiacion.limiteCarrera_mSv);
});

test('proyección de dosis: suma la tasa de cada fase y anticipa el día del límite', () => {
  const sim = simularTripulacion('proyeccion');
  const e = calcularEstado(indexar(sim.registros), 'P01', 0, sim.escenario);
  const esperada = 360 * marte.radiacion.transito_mSv_dia + 500 * marte.radiacion.superficie_mSv_dia;
  assert.ok(Math.abs(e.dosis_proyectada - esperada) < 15, `${e.dosis_proyectada} vs ${esperada}`);
  assert.ok(e.dia_limite_proyectado > 500 && e.dia_limite_proyectado < 680, `${e.dia_limite_proyectado}`);
  const fin = calcularEstado(indexar(sim.registros), 'P01', marte.diasMision - 1, sim.escenario);
  assert.equal(fin.dosis_proyectada, fin.dosis_acumulada);
  assert.equal(fin.dia_limite_proyectado, null);
});
