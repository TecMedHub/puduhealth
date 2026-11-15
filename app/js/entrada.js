// Entrada universal de datos. Cualquier fuente (sensor, wearable, celular, otro sistema) entrega
// mediciones con este formato y la app las trata igual: la línea base, las reglas y el semáforo no
// saben de dónde vienen. La cámara del celular es el primer adaptador. Ver docs/conexion.md.
//
// Una medición: { tipo, valor, persona?, dia?, t?, fuente?, calidad?, unidad? }
//   tipo y valor son obligatorios; tipo es uno de TIPOS (datos.js).
//   persona y dia, si faltan, son los que se están viendo en la app.
//   unidad es opcional, pero si viene debe coincidir con la del tipo: así no entra una
//   temperatura en °F ni una dosis en mGy por error.

import { crearRegistro, fechaDeDia, TIPOS } from './datos.js';
import { faseDelDia } from './escenario.js';

export const FORMATO = 'puduhealth/v1';

// contexto: { persona, dia, escenario }. Devuelve { registros, errores } sin lanzar.
export function aRegistros(entrada, contexto) {
  const lista = Array.isArray(entrada) ? entrada : entrada?.mediciones ?? [entrada];
  const registros = [];
  const errores = [];
  lista.forEach((m, i) => {
    try {
      if (!m || typeof m !== 'object') throw new Error('no es un objeto');
      const def = TIPOS[m.tipo];
      if (!def) throw new Error(`tipo desconocido: ${m.tipo}`);
      if (m.unidad !== undefined && m.unidad !== '' && m.unidad !== def.unidad) {
        throw new Error(`unidad ${m.unidad} para ${m.tipo}; se espera ${def.unidad}`);
      }
      const dia = m.dia === undefined || m.dia === '' ? contexto.dia : Number(m.dia);
      if (!Number.isInteger(dia)) throw new Error(`día inválido: ${m.dia}`);
      const calidad = m.calidad === undefined || m.calidad === '' ? null : Number(m.calidad);
      registros.push(crearRegistro({
        persona: m.persona || contexto.persona,
        tipo: m.tipo,
        valor: Number(m.valor),
        dia,
        t: m.t || fechaDeDia(contexto.escenario.inicio, dia),
        fase: faseDelDia(contexto.escenario, dia),
        fuente: m.fuente || 'externo',
        calidad: Number.isFinite(calidad) ? calidad : null,
      }));
    } catch (e) {
      errores.push(`#${i + 1}: ${e.message}`);
    }
  });
  return { registros, errores };
}

// Texto de un archivo: JSON (una medición, una lista o { formato, mediciones }), JSON Lines
// (una medición por línea) o CSV con encabezado (tipo,valor,persona,dia,...).
export function leerTexto(texto) {
  const limpio = texto.trim().replace(/^﻿/, '');
  if (!limpio) return [];
  if (limpio.startsWith('{') || limpio.startsWith('[')) {
    try {
      return JSON.parse(limpio);
    } catch {
      return limpio.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    }
  }
  const [cabecera, ...filas] = limpio.split(/\r?\n/).filter((l) => l.trim());
  const columnas = cabecera.split(',').map((c) => c.trim());
  return filas.map((f) => Object.fromEntries(f.split(',').map((v, i) => [columnas[i], v.trim()])));
}

// Medición de 60 s con la cámara → registros de FC y VFC en reposo. Sólo si la medición es válida.
export function desdeCamara(resultado) {
  if (!resultado?.valida) return [];
  const m = [{ tipo: 'fc_reposo', valor: Math.round(resultado.bpm), fuente: 'celular-ppg', calidad: resultado.calidad }];
  if (resultado.rmssd) m.push({ tipo: 'vfc_rmssd', valor: Math.round(resultado.rmssd), fuente: 'celular-ppg', calidad: resultado.calidad });
  return m;
}
