// Modelos entrenados (ml/) exportados como JSON y evaluados en el navegador.
// Regresión logística: p = 1 / (1 + e^-(b0 + Σ bi · (xi − media_i) / escala_i))

export async function cargarModelo(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo cargar el modelo ${url}: ${r.status}`);
  return r.json();
}

export function predecirLogistica(modelo, entradas) {
  let z = modelo.intercepto;
  for (let i = 0; i < modelo.entradas.length; i++) {
    const x = entradas[modelo.entradas[i].nombre];
    if (x === null || x === undefined || Number.isNaN(x)) return null;
    z += modelo.coeficientes[i] * ((x - modelo.media[i]) / modelo.escala[i]);
  }
  return 1 / (1 + Math.exp(-z));
}

const lnDif = (a, b) => (a > 0 && b > 0 ? Math.log(a) - Math.log(b) : null);

// Modelo de estrés: una medición de 60 s en reposo contra la línea base de la persona.
// medicion y base: { bpm, rmssd?, sdnn?, calidad? }. Sólo se exigen las entradas que usa el modelo.
export function estimarEstres(modelo, medicion, base) {
  if (medicion.calidad !== undefined && medicion.calidad < modelo.calidad_minima) return null;
  const p = predecirLogistica(modelo, {
    d_bpm: medicion.bpm - base.bpm,
    d_ln_rmssd: lnDif(medicion.rmssd, base.rmssd),
    d_ln_sdnn: lnDif(medicion.sdnn, base.sdnn),
  });
  return p === null ? null : { probabilidad: p, estres: p >= modelo.umbral };
}
