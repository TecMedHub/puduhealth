// Formato común de datos. El celular, el simulador y el hardware futuro
// producen exactamente este registro; la aplicación no distingue la fuente.
//
// { persona, tipo, valor, unidad, dia, t, fase, fuente, calidad }
//   dia: día de misión (negativo = línea base en tierra, 0 = despegue)

export const RIESGOS = ['cardiovascular', 'hueso', 'conductual', 'inmune', 'radiacion'];

export const FASES = {
  tierra: { gravedad: 1 },
  transito: { gravedad: 0 },
  superficie: { gravedad: 0.38 },
  regreso: { gravedad: 0 },
  seguimiento: { gravedad: 1 }, // app personal (Mi registro): días después de la calibración
};

// direccionMala: hacia dónde se aleja un valor cuando empeora (null = sin dirección).
export const TIPOS = {
  fc_reposo: { unidad: 'lpm', riesgo: 'cardiovascular', direccionMala: 'alta' },
  vfc_rmssd: { unidad: 'ms', riesgo: 'cardiovascular', direccionMala: 'baja' },
  vo2max: { unidad: 'ml/kg/min', riesgo: 'cardiovascular', direccionMala: 'baja' },
  ejercicio_aerobico: { unidad: 'min', riesgo: 'cardiovascular', direccionMala: null },
  ejercicio_resistencia: { unidad: 'min', riesgo: 'hueso', direccionMala: null },
  sueno: { unidad: 'h', riesgo: 'conductual', direccionMala: 'baja' },
  animo_valencia: { unidad: '1-9', riesgo: 'conductual', direccionMala: 'baja' },
  animo_activacion: { unidad: '1-9', riesgo: 'conductual', direccionMala: null },
  kss: { unidad: '1-9', riesgo: 'conductual', direccionMala: 'alta' },
  phq9: { unidad: 'puntos', riesgo: 'conductual', direccionMala: 'alta' },
  sintomas: { unidad: 'n', riesgo: 'inmune', direccionMala: null },
  sintoma_respiratorio: { unidad: '0-1', riesgo: 'inmune', direccionMala: null },
  sintoma_digestivo: { unidad: '0-1', riesgo: 'inmune', direccionMala: null },
  sintoma_fatiga: { unidad: '0-1', riesgo: 'inmune', direccionMala: null },
  sintoma_piel: { unidad: '0-1', riesgo: 'inmune', direccionMala: null },
  temperatura: { unidad: '°C', riesgo: 'inmune', direccionMala: 'alta' },
  dosis_radiacion: { unidad: 'mSv', riesgo: 'radiacion', direccionMala: null },
};

// Síntomas tipificados: un registro con valor 1 por cada tipo presente en el día.
// `sintomas` conserva el total del día.
export const TIPOS_SINTOMA = ['sintoma_respiratorio', 'sintoma_digestivo', 'sintoma_fatiga', 'sintoma_piel'];

export function crearRegistro({ persona, tipo, valor, dia, t, fase, fuente, calidad = null }) {
  const def = TIPOS[tipo];
  if (!def) throw new Error(`Tipo de registro desconocido: ${tipo}`);
  if (!FASES[fase]) throw new Error(`Fase desconocida: ${fase}`);
  if (!Number.isFinite(valor)) throw new Error(`Valor inválido para ${tipo}: ${valor}`);
  return { persona, tipo, valor, unidad: def.unidad, dia, t, fase, fuente, calidad };
}

// Fecha ISO (hora local de Chile continental) para un día relativo al despegue.
export function fechaDeDia(inicio, dia, hora = '07:00') {
  const [a, m, d] = inicio.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dia)).toISOString().slice(0, 10);
  return `${fecha}T${hora}:00-03:00`;
}
