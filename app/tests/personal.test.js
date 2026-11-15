import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaDeFecha, escenarioPersonal, calibracion, sumarDias, hoyISO, DIAS_CALIBRACION, PERSONA, exportarPersonal } from '../js/personal.js';
import { faseDelDia } from '../js/escenario.js';
import { aRegistros, leerTexto } from '../js/entrada.js';
import { indexar, calcularEstado } from '../js/estado.js';
import { evaluarReglas } from '../js/motor.js';

test('los primeros 7 días son calibración y el octavo es el día 0', () => {
  assert.equal(diaDeFecha('2026-11-15', '2026-11-15'), -DIAS_CALIBRACION);
  assert.equal(diaDeFecha('2026-11-15', '2026-11-22'), 0);
  assert.equal(diaDeFecha('2026-12-30', '2027-01-02'), 3 - DIAS_CALIBRACION); // cruza el año
  assert.deepEqual(calibracion(-7), { lista: false, dia: 1, total: 7 });
  assert.deepEqual(calibracion(-1), { lista: false, dia: 7, total: 7 });
  assert.equal(calibracion(0).lista, true);
});

test('el escenario personal marca la calibración como línea base y llega hasta hoy', () => {
  const esc = escenarioPersonal('2026-11-15', '2026-11-25');
  assert.equal(esc.inicio, sumarDias('2026-11-15', 7));
  assert.equal(esc.diaInicial, 3);
  assert.equal(esc.diasMision, 4);
  assert.equal(faseDelDia(esc, -3), 'tierra');
  assert.equal(faseDelDia(esc, 3), 'seguimiento');
  assert.equal(hoyISO(new Date(2026, 10, 5)), '2026-11-05');
});

test('con 7 días de FC en calibración, un alza sostenida después dispara la alerta personal', () => {
  const esc = escenarioPersonal('2026-11-01', '2026-11-12');
  const fc = [58, 60, 59, 61, 60, 59, 60, 70, 71, 72, 71];
  const m = fc.map((valor, i) => ({ tipo: 'fc_reposo', valor, dia: i - 7 }));
  const { registros, errores } = aRegistros(m, { persona: PERSONA, dia: esc.diaInicial, escenario: esc });
  assert.deepEqual(errores, []);
  const estado = calcularEstado(indexar(registros), PERSONA, esc.diaInicial, esc);
  assert.equal(estado.variables.fc_reposo.base.n, 7);
  assert.equal(estado.variables.fc_reposo.desviada, true);
  assert.ok(evaluarReglas(estado).some((a) => a.riesgo === 'cardiovascular'));
  assert.ok(Number.isFinite(estado.dosis_proyectada));
});

test('lo exportado se vuelve a importar igual', () => {
  const esc = escenarioPersonal('2026-11-01', '2026-11-12');
  const { registros } = aRegistros([{ tipo: 'sueno', valor: 7.5, dia: 2 }], { persona: PERSONA, dia: 4, escenario: esc });
  const vuelta = aRegistros(leerTexto(exportarPersonal(registros)), { persona: PERSONA, dia: 4, escenario: esc });
  assert.deepEqual(vuelta.registros.map((r) => [r.tipo, r.valor, r.dia]), [['sueno', 7.5, 2]]);
});
