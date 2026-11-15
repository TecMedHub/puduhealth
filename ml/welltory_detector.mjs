// Corre el detector de la app (app/js/lineabase.js, sin cambios) sobre infecciones reales:
// conjunto abierto de Welltory, personas con COVID-19 que midieron su FC antes y durante la enfermedad.
// Responde: ¿la señal "FC en reposo sobre el rango personal" (parte de IN-02 y CV-03) aparece en
// infecciones reales, y cada cuánto aparece en días sanos de las mismas personas?
//
// Uso: node ml/welltory_detector.mjs [--detalle]
//
// Diseño por persona y fuente (cámara del celular / reloj):
//   sana       días hasta 7 días antes de los síntomas. La primera mitad (5 a 21 días) es la línea base;
//              el resto mide falsas alarmas.
//   previa     6 a 1 días antes de los síntomas: no cuenta como sana ni como enferma.
//   enfermedad días 0 a 14 desde el inicio de los síntomas.
// Grupo secundario (sin datos previos): línea base con los días desde el 30 tras los síntomas
// (convalecencia); sólo informa detección.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineaBase, analizarSerie } from '../app/js/lineabase.js';

const raiz = dirname(fileURLToPath(import.meta.url));
const DETALLE = process.argv.includes('--detalle');
const MIN_SANOS = 8;
const MIN_ENFERMOS = 2;
const MIN_CONVALECIENTES = 5;

const [cabecera, ...lineas] = readFileSync(join(raiz, 'cache', 'welltory_diario.csv'), 'utf8').trim().split('\n');
const columnas = cabecera.split(',');
const filas = lineas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [columnas[i], v])));

const grupos = new Map();
for (const f of filas) {
  const clave = `${f.fuente}:${f.persona}`;
  if (!grupos.has(clave)) grupos.set(clave, []);
  grupos.get(clave).push({ rel: Number(f.rel), valor: Number(f.fc) });
}

const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const mediana = (v) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : null);

// Evalúa el detector día a día: los días de base llevan dia < 0, como la línea base en tierra de la app.
function evaluar(base, dias) {
  const serie = [
    ...base.map((d, i) => ({ dia: i - base.length, valor: d.valor })),
    ...dias.map((d, i) => ({ dia: i, valor: d.valor })),
  ];
  const lb = lineaBase(serie.filter((r) => r.dia < 0), 'fc_reposo');
  return dias.map((d, i) => ({ ...d, desviada: analizarSerie(serie.filter((r) => r.dia <= i), lb, 'alta').desviada }));
}

const res = { camara: { principal: [], secundario: [] }, reloj: { principal: [], secundario: [] } };

for (const [clave, dias] of grupos) {
  const [fuente, persona] = clave.split(':');
  dias.sort((a, b) => a.rel - b.rel);
  const sanos = dias.filter((d) => d.rel <= -7);
  const enfermos = dias.filter((d) => d.rel >= 0 && d.rel <= 14);
  if (enfermos.length < MIN_ENFERMOS) continue;

  if (sanos.length >= MIN_SANOS) {
    const nBase = Math.max(5, Math.min(21, Math.floor(sanos.length / 2)));
    const base = sanos.slice(0, nBase);
    const ev = evaluar(base, dias.filter((d) => d.rel > base.at(-1).rel && d.rel <= 14));
    const sanosEv = ev.filter((d) => d.rel <= -7);
    const enfEv = ev.filter((d) => d.rel >= 0);
    const primera = ev.find((d) => d.rel >= -6 && d.desviada);
    res[fuente].principal.push({
      persona, base: nBase, sanos: sanosEv.length, sanosAlerta: sanosEv.filter((d) => d.desviada).length,
      enfermos: enfEv.length, enfermosAlerta: enfEv.filter((d) => d.desviada).length,
      primera: primera?.rel ?? null,
      delta: media(enfermos.map((d) => d.valor)) - media(base.map((d) => d.valor)),
    });
    continue;
  }

  const conv = dias.filter((d) => d.rel >= 30);
  if (conv.length >= MIN_CONVALECIENTES) {
    const ev = evaluar(conv, dias.filter((d) => d.rel >= -6 && d.rel <= 14));
    const enfEv = ev.filter((d) => d.rel >= 0);
    res[fuente].secundario.push({
      persona, base: conv.length, enfermos: enfEv.length, enfermosAlerta: enfEv.filter((d) => d.desviada).length,
      primera: ev.find((d) => d.desviada)?.rel ?? null,
      delta: media(enfermos.map((d) => d.valor)) - media(conv.map((d) => d.valor)),
    });
  }
}

const pct = (a, b) => (b ? `${a}/${b} (${Math.round((100 * a) / b)} %)` : '—');
for (const [fuente, r] of Object.entries(res)) {
  const p = r.principal;
  const s = r.secundario;
  const sanos = p.reduce((a, x) => a + x.sanos, 0);
  const sanosAlerta = p.reduce((a, x) => a + x.sanosAlerta, 0);
  console.log(`\n== ${fuente} ==`);
  console.log(`Línea base previa a la enfermedad: ${p.length} personas`);
  console.log(`  infecciones con FC sobre el rango personal (días 0–14): ${pct(p.filter((x) => x.enfermosAlerta > 0).length, p.length)}`);
  console.log(`  días sanos con alerta: ${pct(sanosAlerta, sanos)}`);
  console.log(`  FC en la enfermedad menos línea base: mediana ${mediana(p.map((x) => x.delta))?.toFixed(1)} lpm; sube en ${pct(p.filter((x) => x.delta > 0).length, p.length)}`);
  console.log(`  primera alerta (día respecto de los síntomas): ${p.filter((x) => x.primera !== null).map((x) => x.primera).join(', ') || '—'}`);
  console.log(`Línea base en convalecencia: ${s.length} personas`);
  console.log(`  infecciones con FC sobre el rango personal (días 0–14): ${pct(s.filter((x) => x.enfermosAlerta > 0).length, s.length)}`);
  console.log(`  FC en la enfermedad menos línea base: mediana ${mediana(s.map((x) => x.delta))?.toFixed(1)} lpm; sube en ${pct(s.filter((x) => x.delta > 0).length, s.length)}`);
  if (DETALLE) {
    console.table(p.map((x) => ({ ...x, delta: x.delta.toFixed(1) })));
    console.table(s.map((x) => ({ ...x, delta: x.delta.toFixed(1) })));
  }
}
