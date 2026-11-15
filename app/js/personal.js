// Mi registro: la app con los datos de una persona real, guardados sólo en este dispositivo.
//
// Los primeros DIAS_CALIBRACION días desde que se empieza son la línea base personal: sus registros
// llevan fase 'tierra', igual que los días previos al despegue en la misión simulada, así que la
// línea base, las reglas y el semáforo funcionan sin cambios. Desde el día siguiente se compara.

import { ESCENARIOS } from './escenario.js';
import { FORMATO } from './entrada.js';
import { leerCifrado, escribirCifrado, olvidarBoveda } from './cifrado.js';

export const DIAS_CALIBRACION = 7;
export const PERSONA = 'YO';

const CLAVES = { inicio: 'puduhealth.inicio', registros: 'puduhealth.registros', modo: 'puduhealth.modo', baseFc: 'puduhealth.base-fc' };

// Fecha local de hoy como 'AAAA-MM-DD' (no UTC: el día cambia a medianoche donde está la persona).
export function hoyISO(ahora = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

const utc = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
export const diasEntre = (desde, hasta) => Math.round((utc(hasta) - utc(desde)) / 86400000);
export const sumarDias = (iso, n) => new Date(utc(iso) + n * 86400000).toISOString().slice(0, 10);

// Día de la app para una fecha: negativo durante la calibración, 0 el primer día de seguimiento.
export const diaDeFecha = (inicio, fecha) => diasEntre(inicio, fecha) - DIAS_CALIBRACION;

// Escenario de la app personal: mismos parámetros de referencia que la misión (prescripción de
// contramedidas, límite de dosis, pérdida ósea), sin fases de vuelo ni guion de eventos.
export function escenarioPersonal(inicio, hoy = hoyISO()) {
  const diaHoy = diaDeFecha(inicio, hoy);
  return {
    ...ESCENARIOS.marte,
    id: 'personal',
    inicio: sumarDias(inicio, DIAS_CALIBRACION), // día 0
    diasLineaBase: DIAS_CALIBRACION,
    diasMision: Math.max(diaHoy, 0) + 1,
    fases: [{ fase: 'seguimiento', dias: Number.MAX_SAFE_INTEGER }],
    conjuncion: null,
    diaInicial: diaHoy,
    guion: [],
  };
}

// Progreso de la calibración: día n de 7, o lista.
export function calibracion(dia) {
  const n = dia + DIAS_CALIBRACION + 1;
  return { lista: dia >= 0, dia: Math.min(n, DIAS_CALIBRACION), total: DIAS_CALIBRACION };
}

// ---------- almacenamiento local (nada sale del dispositivo) ----------

const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };
const escribir = (clave, valor) => { try { localStorage.setItem(clave, valor); return true; } catch { return false; } };
const borrar = (clave) => { try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } };

export const leerModo = () => leer(CLAVES.modo);
export const guardarModo = (modo) => escribir(CLAVES.modo, modo);

// Devuelve { inicio, registros, baseFc }; la primera vez, empieza hoy y sin registros.
// `llave` es la llave de datos de la bóveda (cifrado.js); null si el navegador no permite cifrar.
export async function cargarPersonal(llave, hoy = hoyISO()) {
  let inicio = leer(CLAVES.inicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio ?? '')) {
    inicio = hoy;
    escribir(CLAVES.inicio, inicio);
  }
  const registros = await leerCifrado(llave, CLAVES.registros).catch(() => null);
  const baseFc = await leerCifrado(llave, CLAVES.baseFc).catch(() => null);
  return {
    inicio,
    registros: Array.isArray(registros) ? registros.filter((r) => r?.persona === PERSONA) : [],
    baseFc: Array.isArray(baseFc) ? baseFc : [],
  };
}

export const guardarPersonal = (llave, registros) =>
  escribirCifrado(llave, CLAVES.registros, registros.filter((r) => r.persona === PERSONA));

export const guardarBaseFc = (llave, lista) => escribirCifrado(llave, CLAVES.baseFc, lista);

// Borra todo lo personal de este dispositivo, incluida la llave (y con ella el PIN).
export function borrarPersonal() {
  borrar(CLAVES.inicio);
  borrar(CLAVES.registros);
  borrar(CLAVES.baseFc);
  olvidarBoveda();
}

// Archivo para respaldar o llevar los datos a otro sistema; la app lo vuelve a importar.
export const exportarPersonal = (registros) =>
  JSON.stringify({ formato: FORMATO, mediciones: registros.filter((r) => r.persona === PERSONA) }, null, 1);
