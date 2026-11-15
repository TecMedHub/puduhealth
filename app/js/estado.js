// Estado de una persona en un día: variables contra su línea base
// y los indicadores derivados que usan las reglas.

import { TIPOS } from './datos.js';
import { ESCENARIO, faseDelDia, sinEnlace, tasaDosis } from './escenario.js';
import { lineaBase, lineaBaseMovil, analizarSerie } from './lineabase.js';

export function indexar(registros) {
  const indice = new Map();
  for (const r of registros) {
    if (!indice.has(r.persona)) indice.set(r.persona, new Map());
    const porTipo = indice.get(r.persona);
    if (!porTipo.has(r.tipo)) porTipo.set(r.tipo, []);
    porTipo.get(r.tipo).push(r);
  }
  for (const porTipo of indice.values()) {
    for (const serie of porTipo.values()) serie.sort((a, b) => a.dia - b.dia);
  }
  return indice;
}

const suma = (regs) => regs.reduce((a, r) => a + r.valor, 0);

export function calcularEstado(indice, persona, dia, esc = ESCENARIO) {
  const porTipo = indice.get(persona) ?? new Map();
  const hasta = (tipo) => (porTipo.get(tipo) ?? []).filter((r) => r.dia <= dia);
  const ventana = (tipo, n) => hasta(tipo).filter((r) => r.dia > dia - n);

  const variables = {};
  for (const [tipo, def] of Object.entries(TIPOS)) {
    const serie = hasta(tipo);
    const movil = lineaBaseMovil(serie, dia, tipo);
    variables[tipo] = movil
      ? analizarSerie(movil.serie, movil.base, def.direccionMala)
      : analizarSerie(serie, lineaBase(serie.filter((r) => r.fase === 'tierra'), tipo), def.direccionMala);
  }

  const { prescripcion, radiacion, hueso } = esc;

  // Inmune: días seguidos con síntomas (hasta hoy) y señales de infección que coinciden.
  const sintomasPorDia = new Map(hasta('sintomas').map((r) => [r.dia, r.valor]));
  let diasSintomas = 0;
  while ((sintomasPorDia.get(dia - diasSintomas) ?? 0) > 0) diasSintomas++;
  const sintomas3d = suma(ventana('sintomas', 3));
  const temperaturaHoy = ventana('temperatura', 1).reduce((a, r) => Math.max(a, r.valor), -Infinity);
  const senales = {
    fc: variables.fc_reposo.desviada,
    temperatura: variables.temperatura.desviada,
    sintomas: sintomas3d > 0,
  };
  const dosis7d = suma(ventana('dosis_radiacion', 7));
  const dosisAcumulada = suma(hasta('dosis_radiacion'));

  // Proyección de dosis hasta el fin de la misión con la tasa de cada fase (sin eventos solares,
  // que no se pueden prever): la tasa es casi constante, así que la proyección es confiable.
  let dosisProyectada = dosisAcumulada;
  let diaLimiteProyectado = null;
  for (let d = Math.max(dia, -1) + 1; d < esc.diasMision; d++) {
    dosisProyectada += tasaDosis(esc, faseDelDia(esc, d));
    if (diaLimiteProyectado === null && dosisAcumulada < radiacion.limiteCarrera_mSv
      && dosisProyectada >= radiacion.limiteCarrera_mSv) diaLimiteProyectado = d;
  }
  const nochesCortas = ventana('sueno', 7).filter((r) => r.valor < 7).length;

  // Pérdida ósea estimada: tasa de TB-030 frenada por el cumplimiento de la resistencia.
  const tasaDiaria = hueso.perdidaMensualSinContramedidas / 30;
  const perdidaOsea = hasta('ejercicio_resistencia')
    .filter((r) => r.dia >= 0)
    .reduce((a, r) => {
      const cumplimiento = Math.min(1, r.valor / prescripcion.resistenciaMinDia);
      return a + tasaDiaria * (1 - hueso.eficaciaResistencia * cumplimiento);
    }, 0);

  const factores = {
    sueno: nochesCortas >= 3,
    animo: variables.animo_valencia.desviada,
    radiacion: dosis7d > 1.5 * 7 * radiacion.transito_mSv_dia,
  };

  return {
    persona,
    dia,
    fase: faseDelDia(esc, dia),
    sin_enlace: sinEnlace(esc, dia),
    variables,
    vo2max: variables.vo2max.ultimo,
    vo2max_linea_base: variables.vo2max.base?.media ?? null,
    phq9: variables.phq9.ultimo,
    cumplimiento_resistencia_7d: suma(ventana('ejercicio_resistencia', 7)) / (prescripcion.resistenciaMinDia * 7),
    actividad_7d: suma(ventana('ejercicio_aerobico', 7)),
    noches_cortas_7d: nochesCortas,
    sintomas_3d: sintomas3d,
    dias_sintomas_seguidos: diasSintomas,
    sintomas_piel_3d: suma(ventana('sintoma_piel', 3)),
    temperatura_hoy: Number.isFinite(temperaturaHoy) ? temperaturaHoy : null,
    // z de la medición de hoy contra el rango personal (móvil en vuelo); null sin medición hoy.
    temperatura_z_hoy: variables.temperatura.diaUltimo === dia ? variables.temperatura.z : null,
    senales_infeccion: Object.values(senales).filter(Boolean).length,
    senales_infeccion_detalle: senales,
    dosis_7d: dosis7d,
    dosis_acumulada: dosisAcumulada,
    dosis_proyectada: dosisProyectada,
    dia_limite_proyectado: diaLimiteProyectado,
    limite_dosis: radiacion.limiteCarrera_mSv,
    perdida_osea_estimada: perdidaOsea,
    factores_inmunes: Object.values(factores).filter(Boolean).length,
    factores_inmunes_detalle: factores,
  };
}
