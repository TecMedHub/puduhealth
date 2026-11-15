// Motor de reglas determinista: estado → alertas → semáforo por riesgo.

import { RIESGOS } from './datos.js';
import { REGLAS } from './reglas.js';

// Niveles del semáforo, de menor a mayor. 'info' (consejo preventivo) no es un nivel del semáforo:
// se muestra como alerta pero nunca cambia el color del riesgo.
export const NIVELES = ['verde', 'ambar', 'rojo'];
export const NIVEL_INFO = 'info';
const rango = (nivel) => (nivel === NIVEL_INFO ? -1 : NIVELES.indexOf(nivel));

const OPERADORES = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
};

// Devuelve true/false; sin datos suficientes, la condición no se cumple.
export function evaluarCondicion(c, estado) {
  if (c.todas) return c.todas.every((sub) => evaluarCondicion(sub, estado));
  if (c.cualquiera) return c.cualquiera.some((sub) => evaluarCondicion(sub, estado));
  if (c.desviada) return Boolean(estado.variables?.[c.desviada]?.desviada);

  const op = OPERADORES[c.op];
  if (!op) throw new Error(`Operador desconocido: ${c.op}`);
  const a = estado[c.var];
  const b = c.ref !== undefined ? estado[c.ref] * (c.factor ?? 1) : c.valor;
  if (a === null || a === undefined || b === null || b === undefined || Number.isNaN(b)) return false;
  return op(a, b);
}

function variablesUsadas(c, out = new Set()) {
  if (c.todas || c.cualquiera) (c.todas ?? c.cualquiera).forEach((s) => variablesUsadas(s, out));
  else if (c.desviada) out.add(c.desviada);
  else {
    out.add(c.var);
    if (c.ref) out.add(c.ref);
  }
  return out;
}

export function evaluarReglas(estado, reglas = REGLAS) {
  const alertas = [];
  for (const regla of reglas) {
    if (!evaluarCondicion(regla.condicion, estado)) continue;
    const evidencia = {};
    for (const v of variablesUsadas(regla.condicion)) {
      evidencia[v] = estado.variables?.[v]?.ultimo ?? estado[v];
    }
    alertas.push({
      id: regla.id,
      riesgo: regla.riesgo,
      nivel: regla.nivel,
      clinica: Boolean(regla.clinica),
      recomendacion: regla.recomendacion,
      fuente: regla.fuente,
      evidencia,
    });
  }
  return alertas.sort((a, b) => rango(b.nivel) - rango(a.nivel)); // rojo, ámbar, info
}

export function semaforo(alertas) {
  const resultado = Object.fromEntries(RIESGOS.map((r) => [r, 'verde']));
  for (const a of alertas) {
    if (a.nivel === NIVEL_INFO) continue;
    if (!NIVELES.includes(a.nivel)) throw new Error(`Nivel desconocido: ${a.nivel}`);
    if (rango(a.nivel) > rango(resultado[a.riesgo])) resultado[a.riesgo] = a.nivel;
  }
  return resultado;
}
