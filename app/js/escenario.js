// Parámetros del escenario de misión simulada.
// Los valores con fuente vienen de la literatura; el resto son supuestos del escenario.

export const SEMILLA_DEMO = 'mision-17';

// Parámetros comunes a los dos escenarios.
const COMUN = {
  inicio: '2027-03-01', // día 0 = despegue
  diasLineaBase: 21,
  tamanoTripulacion: 4,

  radiacion: {
    tierra_mSv_dia: 0.0066, // fondo natural ≈ 2,4 mSv/año (UNSCEAR)
    transito_mSv_dia: 1.84, // MSL RAD, crucero a Marte (Zeitlin et al. 2013)
    superficie_mSv_dia: 0.64, // MSL RAD, superficie de Marte (Hassler et al. 2014)
    limiteCarrera_mSv: 600, // NASA-STD-3001 Vol. 1
    // Tormentas solares reales: las cinco que registró MSL RAD en el crucero de Curiosity
    // (despegue 26-11-2011). Dosis equivalente total de cada período según Zeitlin et al. 2013
    // y Guo et al. 2015. El día de misión se cuenta desde el despegue; repartir el total en partes
    // iguales entre los días del período es un supuesto nuestro (se publican los totales).
    despegueMSL: '2011-11-26',
    eventosSolaresMSL: [
      { desde: '2012-01-23', hasta: '2012-01-29', total_mSv: 4.0 },
      { desde: '2012-03-07', hasta: '2012-03-15', total_mSv: 19.5 },
      { desde: '2012-05-17', hasta: '2012-05-18', total_mSv: 1.2 },
    ],
    // En la superficie, lo que vivió Curiosity desde su aterrizaje (6-8-2012). En su primer año
    // marciano RAD registró tres tormentas solares (soles 242, 420 y 504); sólo la primera tiene
    // dosis publicada, 0,025 mSv: la atmósfera frena casi todo (Hassler et al. 2014; Guo et al. 2015).
    // Las otras dos fueron menores y se omiten. Curiosity no volvió: el regreso repite el crucero.
    aterrizajeMSL: '2012-08-06',
    eventosSolaresSuperficieMSL: [
      { desde: '2013-04-12', hasta: '2013-04-12', total_mSv: 0.025 },
    ],
  },

  // Prescripción diaria de contramedidas del escenario.
  prescripcion: {
    resistenciaMinDia: 60,
    aerobicoMinDia: 45,
  },

  cardio: {
    caidaVo2maxSinEjercicio: 0.3, // pérdida de VO2max si no hay contramedidas
    eficaciaEjercicio: 0.85, // fracción de la pérdida que evita el cumplimiento total
    constanteDias: 30, // velocidad con que el VO2max sigue al cumplimiento
  },

  hueso: {
    perdidaMensualSinContramedidas: 0.015, // 1–2 %/mes en columna y cadera (OCHMO TB-030)
    eficaciaResistencia: 0.7,
  },

  // Inmune. Las probabilidades son supuestos del escenario, no tasas medidas.
  inmune: {
    temperaturaBase: [36.6, 0.15], // media y DE entre personas (°C)
    ruidoTemperatura: 0.15, // variación diaria (°C)
    // Lesión cutánea por reactivación de un virus latente (p. ej. varicela-zóster). En la ISS la
    // reactivación de EBV, VZV y CMV aumenta con la duración del vuelo (Mehta et al. 2017).
    reactivacionProbDia: 0.001,
    multiplicadorEstres: 6, // con sueño o ánimo afectados por un evento
    reactivacionDur: [5, 9],
  },

  // Eventos aleatorios: probabilidad diaria, duración en días y efectos.
  // Enfermedad, fc: +2 lpm es el alza mediana de la FC observada en infecciones reales
  // (COVID-19, conjunto abierto de Welltory; ml/welltory_detector.mjs).
  eventos: {
    enfermedad: { prob: 1 / 150, dur: [3, 7], efectos: { fc: 2, vfc: -0.15, sueno: -0.5, kss: 1.5, sintomas: 2, temperatura: 1.2, reduccionEjercicio: 0.7 } },
    insomnio: { prob: 1 / 120, dur: [4, 9], efectos: { sueno: -1.6, kss: 2, valencia: -0.8 } },
    conflicto: { prob: 1 / 160, dur: [5, 12], efectos: { valencia: -2, activacion: 1, phq: 4, vfc: -0.1, sueno: -0.5 } },
    lesion: { prob: 1 / 300, dur: [10, 20], efectos: { reduccionResistencia: 0.7, reduccionAerobico: 0.4 } },
  },
};

// Guion de la demostración: un deterioro gradual en una persona de la tripulación.
const GUION_DECLIVE = [
  {
    persona: 'P01',
    tipo: 'declive',
    inicio: 135,
    rampa: 50,
    duracion: 75,
    efectos: { valencia: -2.5, activacion: -1.5, phq: 9, sueno: -1.2, kss: 1.5, reduccionEjercicio: 0.65 },
  },
  ];

export const ESCENARIOS = {
  // Misión completa a Marte, de clase conjunción (NASA Mars Design Reference Architecture 5.0):
  // unos 6 meses de ida, unos 500 días en la superficie y 6 meses de regreso.
  marte: {
    id: 'marte',
    ...COMUN,
    diasMision: 860,
    fases: [
      { fase: 'transito', dias: 180 },
      { fase: 'superficie', dias: 500 },
      { fase: 'regreso', dias: 180 },
    ],
    // Conjunción solar: el Sol queda entre la Tierra y Marte y corta la comunicación unas dos
    // semanas cada dos años. Centrada en la que vivió Curiosity en la superficie (18-4-2013, día 435
    // de la misión), cuando además llegó su primera tormenta solar en Marte. En una misión de clase
    // conjunción ocurre durante la estadía.
    conjuncion: { inicio: 428, dias: 14 },
    diaInicial: 160,
    guion: GUION_DECLIVE,
  },
  // Sólo el viaje de ida, 210 días: la misión del video y de la historia ilustrada.
  transito: {
    id: 'transito',
    ...COMUN,
    diasMision: 210,
    fases: [{ fase: 'transito', dias: 210 }],
    conjuncion: null,
    diaInicial: 160,
    guion: GUION_DECLIVE,
  },
};

export const ESCENARIO = ESCENARIOS.marte;

// Fase de un día de misión según las fases del escenario (los días negativos son la línea base).
export function faseDelDia(esc, dia) {
  if (dia < 0) return 'tierra';
  let fin = 0;
  for (const f of esc.fases) {
    fin += f.dias;
    if (dia < fin) return f.fase;
  }
  return esc.fases.at(-1).fase;
}

export const sinEnlace = (esc, dia) =>
  Boolean(esc.conjuncion) && dia >= esc.conjuncion.inicio && dia < esc.conjuncion.inicio + esc.conjuncion.dias;

// Tasa diaria de dosis por fase, sin eventos solares.
export function tasaDosis(esc, fase) {
  const r = esc.radiacion;
  return { tierra: r.tierra_mSv_dia, transito: r.transito_mSv_dia, regreso: r.transito_mSv_dia, superficie: r.superficie_mSv_dia }[fase];
}
