// Simulador de tripulación: semilla → perfiles → línea base en tierra → misión.
// Produce registros en el formato común (datos.js).

import { crearRng, limitar } from './aleatorio.js';
import { crearRegistro, fechaDeDia } from './datos.js';
import { ESCENARIO, faseDelDia, tasaDosis } from './escenario.js';

const ROLES = ['Comandante', 'Piloto', 'Especialista de misión', 'Oficial médico'];

function crearPerfil(rng, id, rol) {
  const sexo = rng.prob(0.5) ? 'F' : 'M';
  return {
    id,
    rol,
    sexo,
    edad: rng.entero(32, 52),
    vo2max: sexo === 'F' ? rng.normal(41, 2.5) : rng.normal(46, 3),
    fc: rng.normal(58, 5),
    vfc: limitar(rng.normal(55, 12), 25, 100),
    sueno: rng.normal(7.7, 0.25),
    suenoTransito: rng.normal(-0.25, 0.15),
    valencia: rng.normal(6.8, 0.5),
    activacion: rng.normal(5.5, 0.5),
    kss: rng.normal(3.5, 0.5),
    phq: rng.entero(0, 3),
    cumplimiento: limitar(rng.normal(0.94, 0.03), 0.85, 1),
  };
}

function generarEventos(rng, esc, id) {
  const eventos = [];
  for (let dia = 0; dia < esc.diasMision; dia++) {
    for (const [tipo, def] of Object.entries(esc.eventos)) {
      if (rng.prob(def.prob)) {
        eventos.push({ tipo, inicio: dia, duracion: rng.entero(def.dur[0], def.dur[1]), efectos: def.efectos });
      }
    }
  }
  for (const g of esc.guion) if (g.persona === id) eventos.push({ ...g });
  return eventos;
}

const EFECTOS_VACIOS = {
  fc: 0, vfc: 0, sueno: 0, kss: 0, valencia: 0, activacion: 0, phq: 0, sintomas: 0, temperatura: 0,
  reduccionEjercicio: 0, reduccionResistencia: 0, reduccionAerobico: 0,
};

function efectosDelDia(eventos, dia) {
  const total = { ...EFECTOS_VACIOS };
  for (const ev of eventos) {
    if (dia < ev.inicio || dia >= ev.inicio + ev.duracion) continue;
    const intensidad = ev.rampa ? Math.min(1, (dia - ev.inicio + 1) / ev.rampa) : 1;
    for (const [k, v] of Object.entries(ev.efectos)) {
      if (k.startsWith('reduccion')) total[k] = 1 - (1 - total[k]) * (1 - v * intensidad);
      else total[k] += v * intensidad;
    }
  }
  return total;
}

// rngInmune es un generador aparte: agregar los datos inmunes no altera el resto de la simulación.
function simularPersona(perfil, rng, rngInmune, eventos, solares, esc) {
  const regs = [];
  const { prescripcion, cardio, radiacion, inmune } = esc;
  const temperaturaBase = rngInmune.normal(...inmune.temperaturaBase);
  const claseEnfermedad = new Map();
  let reactivacionHasta = -Infinity;
  const historialCumplimiento = [];
  let deficit = 0;

  const anotar = (tipo, valor, dia, fase, fuente, calidad = null) =>
    regs.push(crearRegistro({
      persona: perfil.id, tipo, valor, dia, fase, fuente, calidad,
      t: fechaDeDia(esc.inicio, dia),
    }));
  const sensor = () => rng.entero(70, 100);

  for (let dia = -esc.diasLineaBase; dia < esc.diasMision; dia++) {
    const fase = faseDelDia(esc, dia);
    const ef = efectosDelDia(eventos, dia);

    // Contramedidas
    const base = limitar(perfil.cumplimiento + rng.normal(0, 0.05), 0, 1.1);
    const cRes = base * (1 - ef.reduccionEjercicio) * (1 - ef.reduccionResistencia);
    const cAer = base * (1 - ef.reduccionEjercicio) * (1 - ef.reduccionAerobico);
    const minRes = Math.round(prescripcion.resistenciaMinDia * cRes);
    const minAer = Math.round(prescripcion.aerobicoMinDia * cAer);
    anotar('ejercicio_resistencia', minRes, dia, fase, 'registro-ejercicio');
    anotar('ejercicio_aerobico', minAer, dia, fase, 'registro-ejercicio');

    // Desacondicionamiento: el déficit sigue al cumplimiento de las últimas 2 semanas
    historialCumplimiento.push((cRes + cAer) / 2);
    if (historialCumplimiento.length > 14) historialCumplimiento.shift();
    if (fase !== 'tierra') {
      const medio = historialCumplimiento.reduce((a, b) => a + b, 0) / historialCumplimiento.length;
      const objetivo = cardio.caidaVo2maxSinEjercicio * (1 - cardio.eficaciaEjercicio * Math.min(1, medio));
      deficit += (objetivo - deficit) / cardio.constanteDias;
    }

    // Cardiovascular
    const fc = perfil.fc * (1 + 0.3 * deficit) + ef.fc + rng.normal(0, 2.5);
    const vfc = perfil.vfc * (1 - 0.6 * deficit) * (1 + ef.vfc) * Math.exp(rng.normal(0, 0.12));
    anotar('fc_reposo', Math.round(fc), dia, fase, 'reloj', sensor());
    anotar('vfc_rmssd', Math.round(vfc), dia, fase, 'reloj', sensor());
    if (dia % 7 === 0) {
      const vo2 = perfil.vo2max * (1 - deficit) + rng.normal(0, 1.2);
      anotar('vo2max', Math.round(vo2 * 10) / 10, dia, fase, 'cicloergometro', sensor());
    }

    // Sueño y conducta
    const sueno = limitar(perfil.sueno + (fase === 'tierra' ? 0 : perfil.suenoTransito) + ef.sueno + rng.normal(0, 0.45), 3, 10);
    anotar('sueno', Math.round(sueno * 10) / 10, dia, fase, 'reloj', sensor());

    if (!rng.prob(0.05)) {
      const kss = limitar(perfil.kss + ef.kss + Math.max(0, 7 - sueno) * 0.6 + rng.normal(0, 0.7), 1, 9);
      const val = limitar(perfil.valencia + ef.valencia + rng.normal(0, 0.7), 1, 9);
      const act = limitar(perfil.activacion + ef.activacion + rng.normal(0, 0.7), 1, 9);
      anotar('kss', Math.round(kss), dia, fase, 'registro');
      anotar('animo_valencia', Math.round(val), dia, fase, 'registro');
      anotar('animo_activacion', Math.round(act), dia, fase, 'registro');
    }
    if (dia % 14 === 0) {
      anotar('phq9', Math.round(limitar(perfil.phq + ef.phq + rng.normal(0, 1), 0, 27)), dia, fase, 'registro');
    }

    // Inmune
    const sintomas = ef.sintomas > 0
      ? Math.max(0, Math.round(rng.normal(ef.sintomas, 0.8)))
      : (rng.prob(0.02) ? 1 : 0);
    const tipos = new Set();
    if (sintomas > 0) {
      const enf = eventos.find((ev) => ev.tipo === 'enfermedad' && dia >= ev.inicio && dia < ev.inicio + ev.duracion);
      if (enf) {
        // Cada enfermedad es respiratoria o digestiva durante todos sus días.
        if (!claseEnfermedad.has(enf)) claseEnfermedad.set(enf, rngInmune.prob(0.6) ? 'sintoma_respiratorio' : 'sintoma_digestivo');
        const principal = claseEnfermedad.get(enf);
        const otro = principal === 'sintoma_respiratorio' ? 'sintoma_digestivo' : 'sintoma_respiratorio';
        [principal, 'sintoma_fatiga', otro].slice(0, sintomas).forEach((t) => tipos.add(t));
      } else {
        const agudo = rngInmune.prob(0.5) ? 'sintoma_respiratorio' : 'sintoma_digestivo';
        tipos.add(rngInmune.prob(0.5) ? 'sintoma_fatiga' : agudo);
      }
    }
    if (fase !== 'tierra') {
      if (dia > reactivacionHasta) {
        const estres = ef.sueno < 0 || ef.valencia < 0;
        const p = inmune.reactivacionProbDia * (estres ? inmune.multiplicadorEstres : 1);
        if (rngInmune.prob(p)) reactivacionHasta = dia + rngInmune.entero(...inmune.reactivacionDur) - 1;
      }
      if (dia <= reactivacionHasta) tipos.add('sintoma_piel');
    }
    anotar('sintomas', tipos.size, dia, fase, 'registro'); // total del día = tipos presentes
    for (const t of tipos) anotar(t, 1, dia, fase, 'registro');

    const temperatura = temperaturaBase + ef.temperatura * rngInmune.rango(0.6, 1.4)
      + rngInmune.normal(0, inmune.ruidoTemperatura);
    anotar('temperatura', Math.round(temperatura * 10) / 10, dia, fase, 'termometro', rngInmune.entero(70, 100));

    // Radiación (dosímetro del hábitat, compartido por la tripulación)
    const dosis = tasaDosis(esc, fase) * (1 + rng.normal(0, 0.05)) + (solares.get(dia) ?? 0);
    anotar('dosis_radiacion', Math.round(dosis * 1000) / 1000, dia, fase, 'dosimetro-habitat');
  }
  return regs;
}

// Dosis extra por día de misión (mSv) de las tormentas solares que midió MSL RAD: las del crucero
// en el viaje de ida (y otra vez en el regreso, que Curiosity no hizo) y las de la superficie desde
// su aterrizaje. La tripulación las recibe en el mismo día de cada fase en que las vivió Curiosity.
export function eventosSolares(esc) {
  const DIA_MS = 86400000;
  const r = esc.radiacion;
  const solares = new Map();
  const reproducir = (eventos, origen, inicioFase, diasFase) => {
    for (const ev of eventos ?? []) {
      const desde = Math.round((Date.parse(ev.desde) - Date.parse(origen)) / DIA_MS);
      const dias = Math.round((Date.parse(ev.hasta) - Date.parse(ev.desde)) / DIA_MS) + 1;
      for (let d = desde; d < desde + dias; d++) {
        if (d < 0 || d >= diasFase) continue;
        solares.set(inicioFase + d, (solares.get(inicioFase + d) ?? 0) + ev.total_mSv / dias);
      }
    }
  };
  let inicio = 0;
  for (const f of esc.fases) {
    if (f.fase === 'superficie') reproducir(r.eventosSolaresSuperficieMSL, r.aterrizajeMSL, inicio, f.dias);
    else reproducir(r.eventosSolaresMSL, r.despegueMSL, inicio, f.dias);
    inicio += f.dias;
  }
  return solares;
}

export function simularTripulacion(semilla, opciones = {}) {
  const esc = { ...ESCENARIO, ...opciones };

  const solares = eventosSolares(esc);

  const personas = [];
  const registros = [];
  for (let i = 0; i < esc.tamanoTripulacion; i++) {
    const id = `P${String(i + 1).padStart(2, '0')}`;
    const rng = crearRng(`${semilla}:${id}`);
    const perfil = crearPerfil(rng, id, ROLES[i % ROLES.length]);
    const eventos = generarEventos(rng, esc, id);
    personas.push({ ...perfil, eventos });
    registros.push(...simularPersona(perfil, rng, crearRng(`${semilla}:${id}:inmune`), eventos, solares, esc));
  }
  return { semilla, escenario: esc, personas, registros };
}
