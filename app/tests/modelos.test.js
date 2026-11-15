import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predecirLogistica, estimarEstres } from '../js/modelos.js';

const MODELO = {
  entradas: [{ nombre: 'd_bpm' }, { nombre: 'd_ln_rmssd' }, { nombre: 'd_ln_sdnn' }],
  media: [0, 0, 0],
  escala: [10, 0.5, 0.5],
  coeficientes: [1.5, -1, -0.5],
  intercepto: -1,
  umbral: 0.5,
  calidad_minima: 40,
};

test('regresión logística: intercepto solo cuando las entradas están en la media', () => {
  const p = predecirLogistica(MODELO, { d_bpm: 0, d_ln_rmssd: 0, d_ln_sdnn: 0 });
  assert.ok(Math.abs(p - 1 / (1 + Math.exp(1))) < 1e-12);
});

test('falta una entrada → sin predicción', () => {
  assert.equal(predecirLogistica(MODELO, { d_bpm: 5 }), null);
});

test('FC más alta y VFC más baja que la línea base suben la probabilidad de estrés', () => {
  const base = { bpm: 60, rmssd: 50, sdnn: 60 };
  const reposo = estimarEstres(MODELO, { bpm: 60, rmssd: 50, sdnn: 60 }, base);
  const tenso = estimarEstres(MODELO, { bpm: 85, rmssd: 25, sdnn: 35 }, base);
  assert.ok(tenso.probabilidad > reposo.probabilidad);
  assert.equal(tenso.estres, true);
});

test('una medición de mala calidad no se interpreta', () => {
  const base = { bpm: 60, rmssd: 50, sdnn: 60 };
  assert.equal(estimarEstres(MODELO, { bpm: 90, rmssd: 20, sdnn: 30, calidad: 20 }, base), null);
});

test('modelo exportado: carga y responde a la FC sobre la línea base', async () => {
  const { readFile } = await import('node:fs/promises');
  const modelo = JSON.parse(await readFile(new URL('../modelos/estres.json', import.meta.url)));
  const base = { bpm: 62 };
  const igual = estimarEstres(modelo, { bpm: 62, calidad: 80 }, base);
  const alta = estimarEstres(modelo, { bpm: 80, calidad: 80 }, base);
  assert.equal(igual.estres, false);
  assert.equal(alta.estres, true);
  assert.ok(modelo.validacion.ecg.auc_media > 0.85);
});
