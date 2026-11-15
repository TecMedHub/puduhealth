import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aRegistros, leerTexto, desdeCamara } from '../js/entrada.js';
import { ESCENARIOS } from '../js/escenario.js';

const ctx = { persona: 'P01', dia: 300, escenario: ESCENARIOS.marte };

test('entrada: completa persona, día, fecha y fase desde lo que se está viendo', () => {
  const { registros, errores } = aRegistros({ tipo: 'fc_reposo', valor: 61, fuente: 'banda-ble' }, ctx);
  assert.deepEqual(errores, []);
  const [r] = registros;
  assert.equal(r.persona, 'P01');
  assert.equal(r.dia, 300);
  assert.equal(r.fase, 'superficie');
  assert.equal(r.unidad, 'lpm');
  assert.equal(r.fuente, 'banda-ble');
  assert.match(r.t, /^\d{4}-\d{2}-\d{2}T07:00:00-03:00$/);
});

test('entrada: rechaza tipos desconocidos y unidades que no coinciden, sin perder las válidas', () => {
  const { registros, errores } = aRegistros({
    formato: 'puduhealth/v1',
    mediciones: [
      { tipo: 'temperatura', valor: 98.6, unidad: '°F' },
      { tipo: 'glucosa', valor: 110 },
      { tipo: 'temperatura', valor: 36.8, unidad: '°C', persona: 'P02', dia: 12 },
    ],
  }, ctx);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].persona, 'P02');
  assert.equal(registros[0].fase, 'transito');
  assert.equal(errores.length, 2);
  assert.match(errores[0], /unidad °F/);
  assert.match(errores[1], /tipo desconocido/);
});

test('entrada: lee JSON, JSON Lines y CSV con encabezado', () => {
  const json = leerTexto('[{"tipo":"sueno","valor":6.5}]');
  const jsonl = leerTexto('{"tipo":"sueno","valor":6.5}\n{"tipo":"kss","valor":4}\n');
  const csv = leerTexto('tipo,valor,dia,fuente\nfc_reposo,58,10,reloj\nfc_reposo,60,11,reloj\n');
  assert.equal(json.length, 1);
  assert.equal(jsonl.length, 2);
  assert.equal(csv.length, 2);
  const { registros, errores } = aRegistros(csv, ctx);
  assert.deepEqual(errores, []);
  assert.deepEqual(registros.map((r) => [r.dia, r.valor, r.fuente]), [[10, 58, 'reloj'], [11, 60, 'reloj']]);
});

test('cámara: una medición válida entra como FC y VFC del día; una inválida, no', () => {
  const m = desdeCamara({ valida: true, bpm: 63.4, rmssd: 41.7, calidad: 82 });
  assert.deepEqual(m.map((x) => [x.tipo, x.valor, x.fuente]), [['fc_reposo', 63, 'celular-ppg'], ['vfc_rmssd', 42, 'celular-ppg']]);
  assert.deepEqual(desdeCamara({ valida: false, bpm: 63, calidad: 20 }), []);
});
