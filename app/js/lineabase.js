// Línea base personal, puntuación z y tendencia EWMA.
//
// Una variable se considera desviada de su rango personal cuando:
//   - dos mediciones seguidas tienen z ≥ 2 en la dirección desfavorable, o
//   - la EWMA de z se mantiene ≥ 1,5 durante 10 mediciones o más.
//
// Parámetros calibrados con datos reales de PMData (14 personas, ~5 meses; ml/calibrar_detector.mjs):
// 2,5 % de días con alerta de FC en vida diaria y un alza sostenida de +5 lpm detectada en 3 días (mediana).

export const PARAMETROS = {
  lambda: 0.2,
  zAlerta: 2,
  ewmaAlerta: 1.5,
  medicionesSostenidas: 10,
};

// Desviación estándar mínima por tipo: evita que una línea base muy estable
// convierta variaciones normales en alertas.
export const DE_MINIMA = {
  fc_reposo: 3,
  vfc_rmssd: 4,
  vo2max: 1.5,
  sueno: 0.3,
  animo_valencia: 0.7,
  animo_activacion: 0.7,
  kss: 0.7,
  phq9: 1,
  temperatura: 0.2,
};

export function lineaBase(registros, tipo) {
  const valores = registros.map((r) => r.valor);
  const n = valores.length;
  if (n < 2) return null;
  const media = valores.reduce((a, b) => a + b, 0) / n;
  const varianza = valores.reduce((a, v) => a + (v - media) ** 2, 0) / (n - 1);
  const de = Math.max(Math.sqrt(varianza), DE_MINIMA[tipo] ?? 0);
  return { media, de, n };
}

// Línea base móvil en vuelo, para variables que se adaptan lentamente al vuelo espacial.
// La temperatura central en reposo sube cerca de 1 °C en los primeros 2,5 meses (Stahn et al. 2017):
// contra la línea base de Tierra quedaría siempre "desviada". Aquí el rango se calcula con los días
// de vuelo [dia − desde, dia − hasta]; se dejan fuera los últimos días para que una fiebre aguda no
// entre en su propio rango. Mediana y MAD: una enfermedad pasada dentro de la ventana no lo infla.
export const BASE_MOVIL = {
  temperatura: { desde: 21, hasta: 4, minimo: 10 },
};

const mediana = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Devuelve { base, serie } con la serie a evaluar contra esa base, o null si aún faltan días de vuelo.
export function lineaBaseMovil(serie, dia, tipo, cfg = BASE_MOVIL[tipo]) {
  if (!cfg) return null;
  const valores = serie
    .filter((r) => r.fase !== 'tierra' && r.dia >= dia - cfg.desde && r.dia <= dia - cfg.hasta)
    .map((r) => r.valor);
  if (valores.length < cfg.minimo) return null;
  const media = mediana(valores);
  const mad = mediana(valores.map((v) => Math.abs(v - media)));
  const de = Math.max(1.4826 * mad, DE_MINIMA[tipo] ?? 0);
  return {
    base: { media, de, n: valores.length, movil: true },
    serie: serie.filter((r) => r.dia > dia - cfg.hasta),
  };
}

export function analizarSerie(serie, base, direccionMala, p = PARAMETROS) {
  const ultimo = serie.at(-1);
  const res = {
    ultimo: ultimo?.valor ?? null,
    diaUltimo: ultimo?.dia ?? null,
    base,
    z: null,
    ewma: null,
    medicionesFuera: 0,
    desviada: false,
  };
  if (!base || !ultimo) return res;
  res.z = (ultimo.valor - base.media) / base.de;
  if (!direccionMala) return res;

  const signo = direccionMala === 'alta' ? 1 : -1;
  let ewma = 0;
  let fuera = 0;
  let zPrevia = -Infinity;
  let dosSeguidas = false;
  for (const r of serie) {
    if (r.dia < 0) continue;
    const zMala = (signo * (r.valor - base.media)) / base.de;
    ewma = p.lambda * zMala + (1 - p.lambda) * ewma;
    fuera = ewma >= p.ewmaAlerta ? fuera + 1 : 0;
    dosSeguidas = zMala >= p.zAlerta && zPrevia >= p.zAlerta;
    zPrevia = zMala;
  }
  res.ewma = signo * ewma;
  res.medicionesFuera = fuera;
  res.desviada = dosSeguidas || fuera >= p.medicionesSostenidas;
  return res;
}
