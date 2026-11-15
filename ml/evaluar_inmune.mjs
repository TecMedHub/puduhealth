// Evaluación de las reglas inmunes sobre misiones simuladas: cuántas enfermedades del simulador
// detectan, con cuántos días de retraso y cuántos días alertan sin una enfermedad en curso.
//
// Uso: node ml/evaluar_inmune.mjs [n_semillas]
//
// Límite: la enfermedad la define el propio simulador (FC, temperatura y síntomas). Esto verifica
// que la lógica responde al escenario; no es una validación clínica de detección de infecciones.

import { simularTripulacion } from '../app/js/simulador.js';
import { ESCENARIOS } from '../app/js/escenario.js';
import { indexar, calcularEstado } from '../app/js/estado.js';
import { evaluarReglas } from '../app/js/motor.js';
import { REGLAS } from '../app/js/reglas.js';

const N = Number(process.argv[2] ?? 30);
const MARGEN = 3; // días tras la enfermedad en que una alerta todavía se le atribuye

// Regla anterior a esta evaluación, para comparar.
const ANTERIOR = {
  id: 'IN-01 anterior', riesgo: 'inmune', nivel: 'ambar', fuente: '-', recomendacion: {},
  condicion: { todas: [{ var: 'sintomas_3d', op: '>', valor: 0 }, { var: 'factores_inmunes', op: '>=', valor: 2 }] },
};
const reglas = [ANTERIOR, ...REGLAS.filter((r) => r.riesgo === 'inmune'), ...REGLAS.filter((r) => r.id === 'CV-03')];
const GRUPOS = {
  'IN-01 anterior': ['IN-01 anterior'],
  'IN-01': ['IN-01'],
  'IN-02': ['IN-02'],
  'IN-03': ['IN-03'],
  'IN-04': ['IN-04'],
  'IN-05 (consejo)': ['IN-05'],
  'IN-01..04 (semáforo inmune)': ['IN-01', 'IN-02', 'IN-03', 'IN-04'],
  'CV-03 (referencia)': ['CV-03'],
};

const res = Object.fromEntries(Object.keys(GRUPOS).map((g) => [g, { detectadas: 0, retrasos: [], dias: 0, fuera: 0 }]));
let enfermedades = 0;
let lesiones = 0;
let diasPersona = 0;

for (let s = 0; s < N; s++) {
  const sim = simularTripulacion(`eval-${s}`, ESCENARIOS.transito);
  const idx = indexar(sim.registros);
  const dias = sim.escenario.diasMision;
  for (const p of sim.personas) {
    const activas = [];
    for (let d = 0; d < dias; d++) {
      activas.push(new Set(evaluarReglas(calcularEstado(idx, p.id, d, sim.escenario), reglas).map((a) => a.id)));
    }
    const piel = new Set(sim.registros.filter((r) => r.persona === p.id && r.tipo === 'sintoma_piel').map((r) => r.dia));
    const enfs = p.eventos.filter((e) => e.tipo === 'enfermedad');
    // Una alerta está justificada si hay una enfermedad en curso (más el margen) o una lesión en la piel reciente.
    const justificada = (d) => enfs.some((e) => d >= e.inicio && d < e.inicio + e.duracion + MARGEN)
      || [0, 1, 2].some((k) => piel.has(d - k));
    const evaluables = enfs.filter((e) => e.inicio + e.duracion + MARGEN <= dias);
    enfermedades += evaluables.length;
    diasPersona += dias;
    for (let d = 0; d < dias; d++) if (piel.has(d) && !piel.has(d - 1)) lesiones++;

    for (const [g, idsGrupo] of Object.entries(GRUPOS)) {
      const hay = (d) => idsGrupo.some((id) => activas[d].has(id));
      for (let d = 0; d < dias; d++) {
        if (!hay(d)) continue;
        res[g].dias++;
        if (!justificada(d)) res[g].fuera++;
      }
      for (const e of evaluables) {
        for (let d = e.inicio; d < e.inicio + e.duracion + MARGEN; d++) {
          if (hay(d)) { res[g].detectadas++; res[g].retrasos.push(d - e.inicio); break; }
        }
      }
    }
  }
}

const mediana = (v) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : null);
console.log(`${N} misiones · ${diasPersona} días-persona · ${enfermedades} enfermedades · ${lesiones} episodios de lesión en la piel\n`);
console.table(Object.fromEntries(Object.entries(res).map(([g, r]) => [g, {
  'enfermedades detectadas': `${r.detectadas} (${Math.round((100 * r.detectadas) / enfermedades)} %)`,
  'retraso mediano (días)': mediana(r.retrasos),
  'días con alerta': r.dias,
  'sin enfermedad ni lesión': `${r.fuera} (${(100 * r.fuera / diasPersona).toFixed(2)} % de los días)`,
}])));
