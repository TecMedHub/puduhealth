import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarReglas, semaforo } from '../js/motor.js';
import { simularTripulacion } from '../js/simulador.js';
import { indexar, calcularEstado } from '../js/estado.js';
import { crearRegistro, TIPOS_SINTOMA } from '../js/datos.js';

// Estado mínimo: sólo las variables que usan las reglas inmunes.
const estado = (cambios = {}) => ({
  variables: {},
  dias_sintomas_seguidos: 0,
  senales_infeccion: 0,
  temperatura_hoy: 36.6,
  temperatura_z_hoy: 0,
  sintomas_piel_3d: 0,
  factores_inmunes: 0,
  sintomas_3d: 0,
  ...cambios,
});
const ids = (e) => evaluarReglas(e).filter((a) => a.riesgo === 'inmune').map((a) => a.id);

test('sin síntomas ni señales no hay alerta inmune', () => {
  assert.deepEqual(ids(estado()), []);
});

test('IN-01: un día con síntomas no alerta; dos seguidos sí', () => {
  assert.deepEqual(ids(estado({ dias_sintomas_seguidos: 1, sintomas_3d: 1 })), []);
  assert.deepEqual(ids(estado({ dias_sintomas_seguidos: 2, sintomas_3d: 2 })), ['IN-01']);
});

test('IN-02: una señal aislada no alerta; dos que coinciden sí', () => {
  assert.deepEqual(ids(estado({ senales_infeccion: 1 })), []);
  assert.deepEqual(ids(estado({ senales_infeccion: 2 })), ['IN-02']);
});

test('IN-03: 38,0 °C o más sobre el rango personal es rojo y abre la pantalla clínica', () => {
  assert.deepEqual(ids(estado({ temperatura_hoy: 37.9, temperatura_z_hoy: 6 })), []);
  const alertas = evaluarReglas(estado({ temperatura_hoy: 38, temperatura_z_hoy: 6 }));
  assert.deepEqual(alertas.map((a) => a.id), ['IN-03']);
  assert.equal(semaforo(alertas).inmune, 'rojo');
  assert.equal(alertas[0].clinica, true);
});

test('IN-03: 38,0 °C dentro del rango de vuelo (alza de adaptación) no es rojo', () => {
  assert.deepEqual(ids(estado({ temperatura_hoy: 38, temperatura_z_hoy: 0.5 })), []);
});

test('temperatura: la línea base móvil absorbe el alza lenta del vuelo y detecta una fiebre aguda', () => {
  // Alza de 1 °C repartida en 75 días de vuelo (Stahn et al. 2017), sin ruido.
  const reg = (valor, dia) => crearRegistro({ persona: 'P', tipo: 'temperatura', valor, dia, t: '', fase: dia < 0 ? 'tierra' : 'transito', fuente: 'prueba' });
  const regs = [];
  for (let d = -30; d <= 100; d++) regs.push(reg(36.6 + (d > 0 ? Math.min(1, d / 75) : 0), d));
  const sano = calcularEstado(indexar(regs), 'P', 100);
  assert.equal(sano.variables.temperatura.desviada, false);
  assert.ok(sano.temperatura_z_hoy < 2);
  // Fiebre aguda en los días 99 y 100.
  const conFiebre = regs.map((r) => (r.dia >= 99 ? { ...r, valor: 38.8 } : r));
  const enfermo = calcularEstado(indexar(conFiebre), 'P', 100);
  assert.equal(enfermo.variables.temperatura.desviada, true);
  assert.deepEqual(evaluarReglas(enfermo).filter((a) => a.id === 'IN-03').length, 1);
});

test('IN-03: sin medición de temperatura no alerta', () => {
  assert.deepEqual(ids(estado({ temperatura_hoy: null })), []);
});

test('IN-04: una lesión en la piel alerta por sí sola', () => {
  assert.deepEqual(ids(estado({ sintomas_piel_3d: 1, sintomas_3d: 1 })), ['IN-04']);
});

test('IN-05: el consejo preventivo no cambia el semáforo y se retira si hay síntomas', () => {
  const alertas = evaluarReglas(estado({ factores_inmunes: 2 }));
  assert.deepEqual(alertas.map((a) => a.id), ['IN-05']);
  assert.equal(semaforo(alertas).inmune, 'verde');
  assert.deepEqual(ids(estado({ factores_inmunes: 2, sintomas_3d: 1 })), []);
});

test('estado: cuenta los días seguidos con síntomas hasta hoy', () => {
  const reg = (tipo, valor, dia) => crearRegistro({ persona: 'P', tipo, valor, dia, t: '', fase: dia < 0 ? 'tierra' : 'transito', fuente: 'prueba' });
  const registros = [0, 1, 0, 2, 1, 1].map((v, i) => reg('sintomas', v, i + 10));
  const idx = indexar(registros);
  assert.equal(calcularEstado(idx, 'P', 15).dias_sintomas_seguidos, 3);
  assert.equal(calcularEstado(idx, 'P', 12).dias_sintomas_seguidos, 0);
  assert.equal(calcularEstado(idx, 'P', 11).dias_sintomas_seguidos, 1);
});

test('estado: FC y temperatura sobre el rango personal son dos señales de infección', () => {
  const reg = (tipo, valor, dia) => crearRegistro({ persona: 'P', tipo, valor, dia, t: '', fase: dia < 0 ? 'tierra' : 'transito', fuente: 'prueba' });
  const registros = [];
  for (let d = -10; d < 0; d++) registros.push(reg('fc_reposo', 58 + (d % 2), d), reg('temperatura', 36.6, d));
  for (let d = 0; d < 2; d++) registros.push(reg('fc_reposo', 70, d), reg('temperatura', 37.6, d));
  const e = calcularEstado(indexar(registros), 'P', 1);
  assert.equal(e.senales_infeccion, 2);
  assert.deepEqual(ids(e), ['IN-02']);
});

test('simulador: los síntomas tipificados cuadran con el total del día', () => {
  const { registros } = simularTripulacion('tipos');
  const total = new Map();
  const porTipo = new Map();
  for (const r of registros) {
    const clave = `${r.persona}:${r.dia}`;
    if (r.tipo === 'sintomas') total.set(clave, r.valor);
    if (TIPOS_SINTOMA.includes(r.tipo)) porTipo.set(clave, (porTipo.get(clave) ?? 0) + r.valor);
  }
  for (const [clave, n] of total) assert.equal(porTipo.get(clave) ?? 0, n, clave);
});

test('simulador: la temperatura sube durante una enfermedad', () => {
  const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const enfermo = [];
  const sano = [];
  for (const semilla of ['a', 'b', 'c', 'd', 'e']) {
    const sim = simularTripulacion(semilla);
    for (const p of sim.personas) {
      const enDia = (d) => p.eventos.some((ev) => ev.tipo === 'enfermedad' && d >= ev.inicio && d < ev.inicio + ev.duracion);
      for (const r of sim.registros) {
        if (r.persona === p.id && r.tipo === 'temperatura') (enDia(r.dia) ? enfermo : sano).push(r.valor);
      }
    }
  }
  assert.ok(enfermo.length > 0);
  assert.ok(media(enfermo) - media(sano) > 0.8);
  assert.ok(media(sano) > 36 && media(sano) < 37.2);
});

test('explicaciones: cada indicador explicado tiene todas las secciones en ambos idiomas', async () => {
  const { EXPLICACIONES } = await import('../js/explicaciones.js');
  const { TEXTOS } = await import('../js/i18n.js');
  const tarjetas = ['vo2max', 'fc_reposo', 'vfc_rmssd', 'sueno', 'resistencia', 'actividad', 'dosis', 'osea', 'phq9', 'temperatura', 'sintomas'];
  for (const clave of tarjetas) assert.ok(EXPLICACIONES[clave], `tarjeta sin explicación: ${clave}`);
  for (const [clave, ex] of Object.entries(EXPLICACIONES)) {
    for (const lang of ['es', 'en']) {
      for (const k of ['titulo', 'que', 'como', 'porque', 'cuando', 'accion', 'fuentes']) {
        assert.ok(ex[lang][k], `${clave}.${lang}.${k}`);
      }
      for (const p of ex.peligros) assert.ok(TEXTOS[lang].peligros[p], `peligro ${p} sin texto en ${lang}`);
    }
  }
});
