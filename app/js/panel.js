// Interfaz: panel "Hoy", acompañante y registro diario.

import { simularTripulacion } from './simulador.js';
import { SEMILLA_DEMO, ESCENARIOS, faseDelDia } from './escenario.js';
import { crearRegistro, fechaDeDia, RIESGOS, TIPOS_SINTOMA } from './datos.js';
import { indexar, calcularEstado } from './estado.js';
import { evaluarReglas, semaforo, NIVELES } from './motor.js';
import { graficoTendencia, graficoMini, puntoCercano, aVista, mediaMovil } from './graficos.js';
import { crearAcompanante, estadoAcompanante } from './acompanante.js';
import { TEXTOS } from './i18n.js';
import { cargarModelo } from './modelos.js';
import { iniciarMedicion, usarAlmacenBase } from './medicion.js';
import { modoBoveda, abrirBoveda, fijarPin } from './cifrado.js';
import { EXPLICACIONES } from './explicaciones.js';
import { aRegistros, leerTexto, desdeCamara, FORMATO } from './entrada.js';
import { crearHoja, aviso, vibrar, pantallaAncha } from './ui.js';
import {
  PERSONA, escenarioPersonal, calibracion, cargarPersonal, guardarPersonal, borrarPersonal,
  exportarPersonal, guardarModo, hoyISO, guardarBaseFc,
} from './personal.js';

// Hoja de sprites del arte final (null = dibujo provisional). Ver acompanante.js.
const HOJA_SPRITES = null;

const $ = (s) => document.querySelector(s);
// ?lang=en abre la interfaz en inglés (enlace para el jurado); sin parámetro, en español.
// ?escenario=transito abre el viaje de ida de 210 días (el del video); sin parámetro, la misión completa.
const PARAMS = new URLSearchParams(location.search);
const LANG_INICIAL = PARAMS.get('lang') === 'en' ? 'en' : 'es';
const ESCENARIO_INICIAL = ESCENARIOS[PARAMS.get('escenario')] ? PARAMS.get('escenario') : 'marte';
const ui = { lang: LANG_INICIAL, semilla: SEMILLA_DEMO, escenario: ESCENARIO_INICIAL, persona: 'P01', dia: ESCENARIOS[ESCENARIO_INICIAL].diaInicial, descartadas: new Set(), rango: 90, modo: document.documentElement.dataset.modo === 'personal' ? 'personal' : 'demo' };
let sim;
let registros;
let indice;

const T = () => TEXTOS[ui.lang];
const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (v, dec = 0) => (v === null || v === undefined || Number.isNaN(v)
  ? '—'
  : v.toLocaleString(ui.lang === 'es' ? 'es-CL' : 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const peor = (sem) => Object.values(sem).reduce((a, n) => (NIVELES.indexOf(n) > NIVELES.indexOf(a) ? n : a), 'verde');
const rol = (p) => T().roles[p.rol] ?? p.rol;

// Íconos de trazo por riesgo (24 × 24).
const ICONO_RIESGO = {
  cardiovascular: '<path d="M12 20s-7-4.2-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.8-7 10-7 10z"/>',
  hueso: '<path d="M8.5 6.5a2.2 2.2 0 1 0-3 3l9 9a2.2 2.2 0 1 0 3-3z"/><path d="M5.5 9.5a2.2 2.2 0 1 1-1-3.8M18.5 14.5a2.2 2.2 0 1 1 1 3.8M15.5 8.5l-7 7"/>',
  conductual: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  inmune: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  radiacion: '<circle cx="12" cy="12" r="1.4"/><path d="M7.8 4.6A8.5 8.5 0 0 1 16.2 4.6L13.6 9.2A3.2 3.2 0 0 0 10.4 9.2ZM20.5 12.0A8.5 8.5 0 0 1 16.2 19.4L13.6 14.8A3.2 3.2 0 0 0 15.2 12.0ZM7.8 19.4A8.5 8.5 0 0 1 3.5 12.0L8.8 12.0A3.2 3.2 0 0 0 10.4 14.8Z"/>',
};
const iconoRiesgo = (r, nivel) => `<span class="riesgo-ico ${nivel}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONO_RIESGO[r]}</svg></span>`;

function cargar(semilla, escenario = ui.escenario) {
  ui.semilla = semilla;
  ui.escenario = escenario;
  sim = simularTripulacion(semilla, ESCENARIOS[escenario]);
  registros = sim.registros.slice();
  indice = indexar(registros);
  ui.descartadas.clear();
  ui.dia = Math.min(ui.dia, sim.escenario.diasMision - 1);
  $('#dia').max = sim.escenario.diasMision - 1;
  $('#semilla').value = semilla;
  $('#escenario').value = escenario;
}

// Mi registro: una sola persona, hoy, con sus datos cifrados en este dispositivo (personal.js, cifrado.js).
let llaveDatos = null; // llave de datos de la bóveda, sólo en memoria mientras la app está abierta
let baseFc = [];       // línea base de la cámara (descifrada en memoria)
let colaGuardado = Promise.resolve(); // las escrituras cifradas se encadenan para no pisarse

const enCola = (tarea) => { colaGuardado = colaGuardado.then(tarea).catch(() => {}); };

async function cargarMio() {
  const { inicio, registros: mios, baseFc: base } = await cargarPersonal(llaveDatos);
  const escenario = escenarioPersonal(inicio);
  sim = { personas: [{ id: PERSONA, rol: 'yo' }], escenario, registros: mios };
  registros = mios.slice();
  indice = indexar(registros);
  baseFc = base;
  usarAlmacenBase({
    leer: () => baseFc,
    guardar: (lista) => { baseFc = lista; const copia = lista.slice(); enCola(() => guardarBaseFc(llaveDatos, copia)); },
  });
  ui.persona = PERSONA;
  ui.dia = escenario.diaInicial;
  ui.descartadas.clear();
}

// Abre la bóveda: sin PIN, en silencio; con PIN, muestra el candado. Devuelve 'demo' si la persona
// prefiere ver la misión de ejemplo sin abrir sus datos.
async function abrirDatos() {
  if (llaveDatos || modoBoveda() === 'sin-cifrado') return 'ok';
  if (modoBoveda() === 'pin') return pedirPin();
  try {
    llaveDatos = await abrirBoveda();
  } catch {
    // La llave del dispositivo se perdió (p. ej. se borraron los datos del sitio): lo cifrado ya no se puede leer.
    borrarPersonal();
    llaveDatos = await abrirBoveda();
    aviso(T().datosIlegibles, { ms: 6000 });
  }
  return 'ok';
}

async function iniciar() {
  if (ui.modo === 'personal') {
    if (await abrirDatos() === 'demo') {
      ui.modo = 'demo';
      document.documentElement.dataset.modo = 'demo';
      guardarModo('demo');
    } else {
      await cargarMio();
      return;
    }
  }
  if (ui.persona === PERSONA) {
    ui.persona = 'P01';
    ui.dia = ESCENARIOS[ui.escenario].diaInicial;
  }
  usarAlmacenBase({ leer: () => [], guardar: () => {} }); // la misión de ejemplo no guarda nada
  cargar(ui.semilla);
}

async function cambiarModo(modo, { avisar = true } = {}) {
  ui.modo = modo;
  document.documentElement.dataset.modo = modo;
  guardarModo(modo);
  await iniciar();
  render();
  irAVista('vista-pudu');
  if (avisar) aviso(T().modoCambiado[ui.modo]);
}

// ---------- candado con PIN ----------

let resolverCandado = null;
function pedirPin() {
  $('#candado').hidden = false;
  $('#candado-error').hidden = true;
  $('#candado-pin').value = '';
  textosFijos();
  setTimeout(() => $('#candado-pin').focus(), 50);
  return new Promise((ok) => { resolverCandado = ok; });
}
function cerrarCandado(resultado) {
  $('#candado').hidden = true;
  resolverCandado?.(resultado);
  resolverCandado = null;
}
$('#form-candado').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const boton = $('#candado-abrir');
  boton.disabled = true;
  boton.textContent = T().abriendo;
  try {
    llaveDatos = await abrirBoveda($('#candado-pin').value);
    cerrarCandado('ok');
  } catch {
    $('#candado-error').textContent = T().pinIncorrecto;
    $('#candado-error').hidden = false;
    $('#candado-pin').value = '';
    vibrar(40);
  }
  boton.disabled = false;
  boton.textContent = T().abrir;
});
$('#candado-ejemplo').addEventListener('click', () => cerrarCandado('demo'));
let olvidePendiente = null;
$('#candado-olvide').addEventListener('click', async () => {
  const b = $('#candado-olvide');
  if (!olvidePendiente) {
    b.classList.add('confirmar');
    b.textContent = T().olvideConfirmar;
    olvidePendiente = setTimeout(() => { olvidePendiente = null; b.classList.remove('confirmar'); b.textContent = T().olvidePin; }, 4000);
    return;
  }
  clearTimeout(olvidePendiente);
  olvidePendiente = null;
  b.classList.remove('confirmar');
  borrarPersonal();
  llaveDatos = await abrirBoveda();
  cerrarCandado('ok');
  aviso(T().datosBorrados);
});

// Mi registro: un dato que falta no es un cero, y una regla sobre 7 días necesita 7 días de historia.
// Las reglas absolutas (fiebre, síntomas, PHQ-9) valen desde el primer día.
const REGLAS_7D = { 'HU-01': 'ejercicio_resistencia', 'CO-01': 'sueno', 'CO-03': 'ejercicio_aerobico' };
function reglasAplicables(alertas) {
  if (ui.modo !== 'personal') return alertas;
  const lista = calibracion(ui.dia).lista;
  const conDatos7d = (tipo) => (indice.get(ui.persona)?.get(tipo) ?? []).some((r) => r.dia <= ui.dia && r.dia > ui.dia - 7);
  return alertas.filter((a) => !REGLAS_7D[a.id] || (lista && conDatos7d(REGLAS_7D[a.id])));
}

const persistir = () => {
  if (ui.modo !== 'personal') return;
  const copia = registros.slice();
  enCola(() => guardarPersonal(llaveDatos, copia));
};
const tieneDatos = (tipo) => (indice.get(ui.persona)?.get(tipo) ?? []).some((r) => r.dia <= ui.dia);

// ---------- entrada universal (entrada.js, docs/conexion.md) ----------

// Agrega registros de cualquier fuente: reemplazan a los de la misma persona, día y tipo.
function agregarRegistros(nuevos) {
  const clave = (r) => `${r.persona}|${r.dia}|${r.tipo}`;
  const claves = new Set(nuevos.map(clave));
  registros = registros.filter((r) => !claves.has(clave(r))).concat(nuevos);
  indice = indexar(registros);
  persistir();
  render();
}

function registrar(entrada) {
  const res = aRegistros(entrada, { persona: ui.persona, dia: ui.dia, escenario: sim.escenario });
  if (res.registros.length) agregarRegistros(res.registros);
  return res;
}

// API de la plataforma para cualquier fuente (un sensor propio o de terceros, un puente Bluetooth,
// otro sistema): window.puduHealth.registrar({ tipo: 'fc_reposo', valor: 61, fuente: 'banda-ble' })
// Ver docs/conexion.md. `astroHealth` se mantiene como alias.
window.puduHealth = { formato: FORMATO, registrar, importar: (texto) => registrar(leerTexto(texto)) };
window.astroHealth = window.puduHealth;

const registradoHoy = (persona, dia) =>
  (indice.get(persona)?.get('animo_valencia') ?? []).some((r) => r.dia === dia);

// ---------- render ----------

function textosFijos() {
  document.documentElement.lang = ui.lang;
  document.querySelectorAll('[data-t]').forEach((el) => {
    const v = el.dataset.t.split('.').reduce((o, k) => o?.[k], T());
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-t-aria]').forEach((el) => {
    const v = el.dataset.tAria.split('.').reduce((o, k) => o?.[k], T());
    if (typeof v === 'string') el.setAttribute('aria-label', v);
  });
  document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('activo', b.dataset.lang === ui.lang));
  document.querySelectorAll('[data-modo]').forEach((b) => b.classList.toggle('activo', b.dataset.modo === ui.modo));
  $('#demo-titulo').textContent = ui.modo === 'personal' ? T().ajustesTitulo : T().demoTitulo;
  if (ui.modo === 'personal') $('[data-t="rangoPersonal"]').textContent = T().rangoPersonalMio;
  document.querySelectorAll('.tema[data-tema]').forEach((b) => {
    const activo = b.dataset.tema === document.documentElement.dataset.tema;
    b.classList.toggle('activo', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
  document.querySelectorAll('[data-rango]').forEach((b) => b.classList.toggle('activo', Number(b.dataset.rango) === ui.rango));
}

function renderTripulacion() {
  if (ui.modo === 'personal') return;
  $('#tripulacion').innerHTML = sim.personas.map((p) => {
    const nivel = peor(semaforo(evaluarReglas(calcularEstado(indice, p.id, ui.dia, sim.escenario))));
    const activo = p.id === ui.persona;
    return `<button type="button" role="tab" aria-selected="${activo}" class="tripulante${activo ? ' activo' : ''}" data-persona="${p.id}">
      <span class="punto ${nivel}"></span><span><strong>${p.id}</strong> <small>${escapar(rol(p))}</small></span></button>`;
  }).join('');
}

function renderAcompanante(estado, sem) {
  const hoy = registradoHoy(ui.persona, ui.dia);
  const e = estadoAcompanante(estado, hoy);
  acompanante.fijarEstado(e);
  $('#estado-acomp').textContent = T().estados[e];
  $('#frase').textContent = T().frases[e];
  const btn = $('#btn-registrar');
  btn.textContent = hoy ? T().yaRegistrado : T().registrar;
  btn.classList.toggle('secundario', hoy);
  $('#mini-semaforo').innerHTML = RIESGOS.map((r) =>
    `<span class="mini-riesgo" title="${escapar(T().riesgos[r])}: ${escapar(T().niveles[sem[r]])}">${iconoRiesgo(r, sem[r])}${escapar(T().riesgos[r].split(' ')[0])}</span>`).join('');
}

function renderSemaforo(sem) {
  $('#semaforo').innerHTML = RIESGOS.map((r) => `
    <div class="riesgo ${sem[r]}">
      ${iconoRiesgo(r, sem[r])}
      <span class="riesgo-nombre">${escapar(T().riesgos[r])}</span>
      <span class="pildora ${sem[r]}">${escapar(T().niveles[sem[r]])}</span>
    </div>`).join('');
}

// Estado general: el peor nivel y cuántos riesgos lo comparten.
function renderGeneral(sem) {
  const cal = calibracion(ui.dia);
  if (ui.modo === 'personal' && !cal.lista) {
    $('#general').className = 'general calibrando';
    $('#general').innerHTML = `
      <span class="general-anillo anillo-calibrando">${cal.dia}/${cal.total}</span>
      <div style="flex:1"><p class="general-titulo">${escapar(T().generalCalibrando)}</p>
      <p class="general-sub">${escapar(T().generalCalibrandoSub(cal.dia, cal.total))}</p>
      <span class="general-progreso"><i style="width:${(100 * cal.dia) / cal.total}%"></i></span></div>`;
    $('#tab-hoy-punto').hidden = true;
    return;
  }
  const nivel = peor(sem);
  const n = RIESGOS.filter((r) => sem[r] === nivel).length;
  $('#general').className = `general ${nivel}`;
  $('#general').innerHTML = `
    <span class="general-anillo"><span class="punto ${nivel}"></span></span>
    <div><p class="general-titulo">${escapar(T().general[nivel](n))}</p>
    <p class="general-sub">${escapar(ui.modo === 'personal' ? T().generalSubMio : T().generalSub)}</p></div>`;
  const punto = $('#tab-hoy-punto');
  punto.hidden = nivel === 'verde';
  punto.classList.toggle('rojo', nivel === 'rojo');
}

// Barra superior del celular: tripulante activo y día.
function renderBarra(estado, sem) {
  if (ui.modo === 'personal') {
    const cal = calibracion(ui.dia);
    $('#perfil-id').textContent = T().yo;
    $('#perfil-rol').textContent = T().modos.personal;
    $('#perfil-punto').className = `punto ${cal.lista ? peor(sem) : 'sindatos'}`;
    const [a, m, d] = hoyISO().split('-').map(Number);
    const fecha = new Date(a, m - 1, d).toLocaleDateString(ui.lang === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'short' });
    $('#dia-corto').textContent = `${T().hoyCorto} · ${fecha}`;
    $('#fase-corta').textContent = cal.lista ? T().fases.seguimiento : T().calibrando(cal.dia, cal.total);
    $('#fase-corta').classList.remove('sin-enlace');
    return;
  }
  const p = sim.personas.find((x) => x.id === ui.persona);
  $('#perfil-id').textContent = p.id;
  $('#perfil-rol').textContent = rol(p);
  $('#perfil-punto').className = `punto ${peor(sem)}`;
  $('#dia-corto').textContent = `${T().diaCorto} ${ui.dia}`;
  $('#fase-corta').textContent = estado.sin_enlace ? T().sinEnlace.split(' (')[0] : T().fases[estado.fase];
  $('#fase-corta').classList.toggle('sin-enlace', estado.sin_enlace);
}

function renderAlertas(alertas) {
  if (!alertas.length) {
    $('#alertas').innerHTML = `<p class="vacio">${escapar(T().sinAlertas)}</p>`;
    return;
  }
  $('#alertas').innerHTML = alertas.map((a) => `
    <article class="alerta ${a.nivel}">
      <header><span class="punto ${a.nivel}"></span><strong>${escapar(T().riesgos[a.riesgo])}</strong><code>${a.id}</code></header>
      <p>${escapar(a.recomendacion[ui.lang])}</p>
      <footer>${escapar(T().fuente)}: ${escapar(T().fuentes[a.fuente] ?? a.fuente)}</footer>
    </article>`).join('');
}

// Tipos de síntoma registrados en los últimos 3 días, para el indicador.
function sintomasRecientes(dia) {
  const porTipo = indice.get(ui.persona);
  const nombres = TIPOS_SINTOMA
    .filter((t) => (porTipo?.get(t) ?? []).some((r) => r.dia > dia - 3 && r.dia <= dia && r.valor > 0))
    .map((t) => T().sintomas[t]);
  return nombres.join(', ');
}

function renderIndicadores(e) {
  const I = T().ind;
  const v = e.variables;
  const serieCorta = (tipo) => (indice.get(ui.persona)?.get(tipo) ?? [])
    .filter((r) => r.dia <= ui.dia && r.dia > ui.dia - 30)
    .map((r) => ({ dia: r.dia, valor: r.valor }));
  const mini = (tipo) => graficoMini({ serie: serieCorta(tipo), base: v[tipo]?.base });
  const items = [
    [I.vo2max, `${num(e.vo2max, 1)} <small>ml/kg/min</small>`,
      e.vo2max_linea_base ? `${num((100 * e.vo2max) / e.vo2max_linea_base)} % ${I.delPrevio}` : '', v.vo2max.desviada, 'vo2max', 'estimado'],
    [I.fc_reposo, `${num(v.fc_reposo.ultimo)} <small>lpm</small>`, `z = ${num(v.fc_reposo.z, 1)}`, v.fc_reposo.desviada, 'fc_reposo', 'medido'],
    [I.vfc_rmssd, `${num(v.vfc_rmssd.ultimo)} <small>ms</small>`, `z = ${num(v.vfc_rmssd.z, 1)}`, v.vfc_rmssd.desviada, 'vfc_rmssd', 'medido'],
    [I.sueno, `${num(v.sueno.ultimo, 1)} <small>h</small>`, '', v.sueno.desviada, 'sueno', 'medido'],
    [I.resistencia, `${num(100 * e.cumplimiento_resistencia_7d)} <small>%</small>`, '', e.cumplimiento_resistencia_7d < 0.8, 'resistencia', 'medido'],
    [I.actividad, `${num(e.actividad_7d)} <small>min</small>`, '', e.actividad_7d < 150, 'actividad', 'medido'],
    [I.dosis, `${num(e.dosis_acumulada)} <small>mSv</small>`,
      `/ ${num(e.limite_dosis)} mSv · ${T().proyeccion} ≈ ${num(e.dosis_proyectada)} mSv${e.dia_limite_proyectado !== null
        ? ` · ${T().limiteDia} ${e.dia_limite_proyectado}` : ''}`, e.dosis_proyectada >= e.limite_dosis, 'dosis', 'medido'],
    [I.osea, `${num(100 * e.perdida_osea_estimada, 1)} <small>%</small>`, '', false, 'osea', 'estimado'],
    [I.phq9, num(e.phq9), '', e.phq9 >= 10, 'phq9', 'reportado'],
    [I.temperatura, `${num(e.temperatura_hoy, 1)} <small>°C</small>`, `z = ${num(v.temperatura.z, 1)}`,
      v.temperatura.desviada || e.temperatura_hoy >= 38, 'temperatura', 'medido'],
    [I.sintomas, num(e.sintomas_3d), sintomasRecientes(e.dia), e.dias_sintomas_seguidos >= 2 || e.sintomas_piel_3d > 0, 'sintomas', 'reportado'],
  ];
  // En Mi registro, lo que todavía no tiene datos lo dice (y cómo conseguirlo) en vez de mostrar un 0.
  if (ui.modo === 'personal') {
    const falta = {
      vo2max: ['vo2max', T().requiereEquipo],
      dosis: ['dosis_radiacion', T().requiereDosimetro],
      osea: ['ejercicio_resistencia', T().sinRegistro],
      resistencia: ['ejercicio_resistencia', T().sinRegistro],
      actividad: ['ejercicio_aerobico', T().sinRegistro],
      sueno: ['sueno', T().sinRegistro],
      phq9: ['phq9', ''],
    };
    const lista = calibracion(ui.dia).lista;
    items.forEach((it) => {
      const f = falta[it[4]];
      if (f && !tieneDatos(f[0])) Object.assign(it, { 1: '—', 2: f[1], 3: false });
      if (!lista && ['resistencia', 'actividad'].includes(it[4])) it[3] = false; // semana incompleta
    });
  }
  // Procedencia: cómo se obtiene el dato a bordo. No se actúa igual ante un valor medido que ante uno estimado.
  const O = T().origen;
  const SPARK = { vo2max: 'vo2max', fc_reposo: 'fc_reposo', vfc_rmssd: 'vfc_rmssd', sueno: 'sueno', temperatura: 'temperatura', phq9: 'phq9' };
  $('#indicadores').innerHTML = items.map(([nombre, valor, sub, alerta, info, origen]) => `
    <button type="button" class="indicador${alerta ? ' fuera' : ''}" data-info="${info}"
      aria-label="${escapar(nombre)}. ${escapar(T().queEs)}">
      <span class="ind-nombre">${escapar(nombre)}</span>
      <svg class="ind-info" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      <span class="ind-valor">${valor}</span>
      <span class="ind-sub">${escapar(sub)}</span>
      ${SPARK[info] ? mini(SPARK[info]) : ''}
      <span class="ind-pie">
        <span class="ind-origen ${origen}" title="${escapar(O.ayuda[origen])}">${escapar(O[origen])}</span>
        ${alerta ? `<span class="pildora ambar">${escapar(T().fueraRango)}</span>` : ''}
      </span>
    </button>`).join('');
  $('#origen-nota').textContent = ui.modo === 'demo' ? `${O.nota} ${O.notaDemo}` : O.nota;
}

const UNIDAD = { vo2max: 'ml/kg/min', fc_reposo: 'lpm', vfc_rmssd: 'ms', sueno: 'h', temperatura: '°C' };
const seriesGrafico = new Map(); // tipo → puntos dibujados (para leer un valor al tocar)

function renderTendencias(e) {
  const desde = ui.rango ? ui.dia - ui.rango : -Infinity;
  const serie = (tipo) => (indice.get(ui.persona)?.get(tipo) ?? [])
    .filter((r) => r.dia <= ui.dia && r.dia > desde)
    .map((r) => ({ dia: r.dia, valor: r.valor }));
  const I = T().ind;
  const graficos = [
    [I.vo2max, 'vo2max', [
      ...(e.vo2max_linea_base ? [{ valor: 0.8 * e.vo2max_linea_base, etiqueta: T().umbral80 }] : []),
      { valor: 32.9, etiqueta: T().umbralEva },
    ]],
    [I.fc_reposo, 'fc_reposo', [], 7],
    [I.vfc_rmssd, 'vfc_rmssd', [], 7],
    [I.sueno, 'sueno', [{ valor: 7, etiqueta: T().umbralSueno }], 7],
    [I.temperatura, 'temperatura', [{ valor: 38, etiqueta: T().umbralFiebre }]],
  ];
  seriesGrafico.clear();
  $('#tendencias').innerHTML = graficos.map(([titulo, tipo, umbrales, suavizado = 1]) => {
    const s = serie(tipo);
    const visible = suavizado > 1 ? mediaMovil(s, suavizado) : s;
    seriesGrafico.set(tipo, visible);
    return `
    <figure class="tendencia" data-tipo="${tipo}">
      <figcaption>${escapar(titulo)}<span class="lectura"></span></figcaption>
      ${s.length ? graficoTendencia({ serie: s, base: e.variables[tipo].base, umbrales, suavizado }) : `<p class="vacio">${escapar(T().sinDatosAun)}</p>`}
    </figure>`;
  }).join('');
}

// Tocar o arrastrar sobre un gráfico muestra el día y el valor (media móvil donde se suaviza).
function leerGrafico(ev) {
  const fig = ev.target.closest('.tendencia');
  const svg = fig?.querySelector('svg[data-escala]');
  if (!svg) return;
  const escala = JSON.parse(svg.dataset.escala);
  const caja = svg.getBoundingClientRect();
  const xVista = ((ev.clientX - caja.left) / caja.width) * escala.ancho;
  const p = puntoCercano(seriesGrafico.get(fig.dataset.tipo) ?? [], escala, xVista);
  if (!p) return;
  const { x, y } = aVista(escala, p);
  const guia = svg.querySelector('.g-guia');
  const marca = svg.querySelector('.g-marca');
  guia.setAttribute('x1', x); guia.setAttribute('x2', x); guia.setAttribute('visibility', 'visible');
  marca.setAttribute('cx', x); marca.setAttribute('cy', y); marca.setAttribute('visibility', 'visible');
  const dec = Math.abs(p.valor) >= 100 ? 0 : 1;
  fig.querySelector('.lectura').innerHTML = `${escapar(T().diaCorto)} ${p.dia} · <strong>${num(p.valor, dec)}</strong> ${UNIDAD[fig.dataset.tipo] ?? ''}`;
}
function soltarGrafico(ev) {
  const fig = ev.target.closest('.tendencia');
  if (!fig) return;
  fig.querySelectorAll('.g-guia, .g-marca').forEach((el) => el.setAttribute('visibility', 'hidden'));
  fig.querySelector('.lectura').textContent = '';
}
$('#tendencias').addEventListener('pointerdown', leerGrafico);
$('#tendencias').addEventListener('pointermove', (ev) => { if (ev.buttons || ev.pointerType === 'mouse') leerGrafico(ev); });
$('#tendencias').addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'mouse') soltarGrafico(ev); });
$('#tendencias').addEventListener('pointerleave', soltarGrafico);
$('#tendencias').addEventListener('pointercancel', soltarGrafico);

$('#rango').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-rango]');
  if (!b) return;
  ui.rango = Number(b.dataset.rango);
  vibrar(8);
  render();
});

// Pantalla de atención clínica: la abre la primera alerta clínica (las rojas van primero).
// "Ver mis datos" la descarta hasta una nueva medición de la variable que la disparó.
function renderClinica(alertas, e) {
  const a = alertas.find((x) => x.clinica);
  const variable = a && Object.keys(a.evidencia)[0];
  const clave = a ? `${ui.persona}:${a.id}:${e.variables[variable]?.diaUltimo ?? e.dia}` : '';
  const visible = Boolean(a) && !ui.descartadas.has(clave);
  $('#clinica').hidden = !visible;
  $('#clinica').dataset.clave = clave;
  if (a) $('#clinica-texto').textContent = T().clinicaTexto[a.id] ?? T().clinicaTexto['CO-02'];
  $('#vista-pudu').classList.toggle('apartado', Boolean(a));
}

function render() {
  textosFijos();
  if (ui.modo === 'personal') renderSeguridad();
  $('#dia').value = ui.dia;
  $('#dia-texto').textContent = `${T().dia} ${ui.dia} · ${fechaDeDia(sim.escenario.inicio, ui.dia).slice(0, 10)}`;
  const estado = calcularEstado(indice, ui.persona, ui.dia, sim.escenario);
  $('#dia-fase').textContent = T().fases[estado.fase] + (estado.sin_enlace ? ` · ${T().sinEnlace}` : '');
  $('#dia-fase').classList.toggle('sin-enlace', estado.sin_enlace);
  const alertas = reglasAplicables(evaluarReglas(estado));
  const sem = semaforo(alertas);
  // Sin dosímetro no hay dosis medida: "sin datos", no "en rango".
  if (ui.modo === 'personal' && !tieneDatos('dosis_radiacion')) sem.radiacion = 'sindatos';
  renderTripulacion();
  renderBarra(estado, sem);
  renderAcompanante(estado, sem);
  renderGeneral(sem);
  renderSemaforo(sem);
  renderAlertas(alertas);
  renderIndicadores(estado);
  renderTendencias(estado);
  renderClinica(alertas, estado);
}

// ---------- explicaciones por indicador ----------

function abrirInfo(clave) {
  const ex = EXPLICACIONES[clave];
  if (!ex) return;
  const t = T();
  const x = ex[ui.lang];
  $('#info-titulo').textContent = x.titulo;
  const seccion = (titulo, texto) => `<h3>${escapar(titulo)}</h3><p>${escapar(texto)}</p>`;
  $('#info-cuerpo').innerHTML = [
    `<p>${escapar(x.que)}</p>`,
    seccion(t.info.como, x.como),
    seccion(t.info.porque, x.porque),
    `<ul class="peligros" aria-label="${escapar(t.info.peligros)}">${ex.peligros.map((k) => `<li>${escapar(t.peligros[k])}</li>`).join('')}</ul>`,
    seccion(t.info.cuando, x.cuando),
    seccion(t.info.accion, x.accion),
    `<p class="fuente-info">${escapar(t.fuente)}: ${escapar(x.fuentes)}</p>`,
  ].join('');
  $('#info').showModal();
}

$('#indicadores').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-info]');
  if (b) abrirInfo(b.dataset.info);
});

// ---------- registro diario (≤ 10 s) ----------

const NIVELES_ESCALA = [2, 5, 8];
const seleccion = { valencia: null, activacion: null, kss: null, sintomas: new Set(), sueno: null, aerobico: null, resistencia: null };
const OPCIONES = {
  sueno: { valores: [4, 5, 6, 7, 8, 9], etiquetas: ['≤4', '5', '6', '7', '8', '9+'], unidad: 'h' },
  aerobico: { valores: [0, 15, 30, 45, 60, 90], etiquetas: ['0', '15', '30', '45', '60', '90+'], unidad: 'min' },
  resistencia: { valores: [0, 15, 30, 45, 60, 90], etiquetas: ['0', '15', '30', '45', '60', '90+'], unidad: 'min' },
};

function abrirRegistro() {
  seleccion.valencia = null;
  seleccion.activacion = null;
  seleccion.kss = null;
  seleccion.sintomas = new Set();
  seleccion.sueno = seleccion.aerobico = seleccion.resistencia = null;
  const t = T();
  document.querySelectorAll('#registro .opciones').forEach((caja) => {
    const o = OPCIONES[caja.dataset.campo];
    caja.innerHTML = o.valores.map((v, i) =>
      `<button type="button" class="opcion" data-valor="${v}" aria-pressed="false" aria-label="${o.etiquetas[i]} ${o.unidad}">${o.etiquetas[i]}</button>`).join('');
  });
  // Ánimo (columnas) × energía (filas): los ejes se escriben una vez y cada casilla es una cara.
  const BOCA = ['M8 16.5q4-3.5 8 0', 'M8 15.5h8', 'M8 14.5q4 3.5 8 0'];
  const cara = (v) => `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".9" class="ojo"/><circle cx="15" cy="10" r=".9" class="ojo"/><path d="${BOCA[v]}"/></svg>`;
  const celdas = ['<span></span>', ...t.valencia.map((x) => `<span class="eje">${escapar(x)}</span>`)];
  for (let a = 2; a >= 0; a--) {
    celdas.push(`<span class="eje fila">${escapar(t.activacion[a])}</span>`);
    for (let v = 0; v < 3; v++) {
      celdas.push(`<button type="button" class="celda v${v}" data-v="${v}" data-a="${a}"
        aria-label="${escapar(t.valencia[v])} · ${escapar(t.activacion[a])}">${cara(v)}</button>`);
    }
  }
  $('#rejilla-animo').innerHTML = celdas.join('');
  $('#escala-kss').innerHTML = Array.from({ length: 9 }, (_, i) =>
    `<button type="button" class="kss" data-kss="${i + 1}">${i + 1}</button>`).join('');
  $('#kss-min').textContent = t.kssExtremos[0];
  $('#kss-max').textContent = t.kssExtremos[1];
  $('#sintomas').innerHTML = TIPOS_SINTOMA.map((s) =>
    `<button type="button" class="sintoma" data-sintoma="${s}" aria-pressed="false">${escapar(t.sintomas[s])}</button>`).join('');
  $('#temperatura').value = '';
  $('#temperatura-error').hidden = true;
  actualizarGuardar();
  $('#registro').showModal();
}

function actualizarGuardar() {
  $('#registro-guardar').disabled = seleccion.valencia === null || seleccion.kss === null
    || Number.isNaN(leerTemperatura());
  document.querySelectorAll('#rejilla-animo .celda').forEach((b) => {
    b.classList.toggle('activa', Number(b.dataset.v) === seleccion.valencia && Number(b.dataset.a) === seleccion.activacion);
  });
  document.querySelectorAll('#escala-kss .kss').forEach((b) => {
    b.classList.toggle('activa', Number(b.dataset.kss) === seleccion.kss);
  });
  document.querySelectorAll('#registro .opciones').forEach((caja) => {
    caja.querySelectorAll('.opcion').forEach((b) => {
      const activa = Number(b.dataset.valor) === seleccion[caja.dataset.campo];
      b.classList.toggle('activa', activa);
      b.setAttribute('aria-pressed', String(activa));
    });
  });
  document.querySelectorAll('#sintomas .sintoma').forEach((b) => {
    const activa = seleccion.sintomas.has(b.dataset.sintoma);
    b.classList.toggle('activa', activa);
    b.setAttribute('aria-pressed', String(activa));
  });
}

// Temperatura escrita: null si está vacía; NaN si no es un número dentro del rango aceptado.
function leerTemperatura() {
  const texto = $('#temperatura').value.trim().replace(',', '.');
  if (!texto) return null;
  const v = Number(texto);
  return Number.isFinite(v) && v >= 34 && v <= 42.5 ? Math.round(v * 10) / 10 : NaN;
}

function guardarRegistro() {
  const tipos = { animo_valencia: NIVELES_ESCALA[seleccion.valencia], animo_activacion: NIVELES_ESCALA[seleccion.activacion], kss: seleccion.kss };
  // Síntomas: el registro del día reemplaza los anteriores (sin marcar = sin síntomas).
  tipos.sintomas = seleccion.sintomas.size;
  for (const s of TIPOS_SINTOMA) tipos[s] = seleccion.sintomas.has(s) ? 1 : 0;
  const temperatura = leerTemperatura();
  if (temperatura !== null && !Number.isNaN(temperatura)) tipos.temperatura = temperatura;
  if (seleccion.sueno !== null) tipos.sueno = seleccion.sueno;
  if (seleccion.aerobico !== null) tipos.ejercicio_aerobico = seleccion.aerobico;
  if (seleccion.resistencia !== null) tipos.ejercicio_resistencia = seleccion.resistencia;
  const ahora = new Date();
  const hora = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
  registros = registros.filter((r) => !(r.persona === ui.persona && r.dia === ui.dia && r.tipo in tipos));
  for (const [tipo, valor] of Object.entries(tipos)) {
    if (TIPOS_SINTOMA.includes(tipo) && valor === 0) continue; // un tipo ausente no lleva registro
    registros.push(crearRegistro({
      persona: ui.persona, tipo, valor, dia: ui.dia,
      t: fechaDeDia(sim.escenario.inicio, ui.dia, hora),
      fase: faseDelDia(sim.escenario, ui.dia),
      fuente: tipo === 'temperatura' ? 'termometro' : 'registro',
    }));
  }
  indice = indexar(registros);
  persistir();
  acompanante.mostrar('contento');
  render();
  vibrar(20);
  aviso(T().avisos.guardado);
}

// ---------- eventos ----------

const acompanante = crearAcompanante($('#lienzo'), { hoja: HOJA_SPRITES });

$('#tripulacion').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-persona]');
  if (!b) return;
  ui.persona = b.dataset.persona;
  render();
});

$('#dia').addEventListener('input', (ev) => {
  ui.dia = Number(ev.target.value);
  render();
});

document.addEventListener('keydown', (ev) => {
  if (ui.modo !== 'demo' || document.querySelector('dialog[open]') || ev.target.matches('input[type=text], select')) return;
  const paso = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
  if (paso) moverDia(paso);
});

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  ui.lang = b.dataset.lang;
  render();
}));

// Tema de color: se recuerda en el dispositivo; la barra del sistema toma el color de fondo.
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem('puduhealth.tema', tema); } catch { /* sin almacenamiento */ }
  const fondo = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim();
  document.querySelector('meta[name="theme-color"]').content = fondo;
  vibrar(8);
  render();
}
document.querySelectorAll('.tema[data-tema]').forEach((b) => b.addEventListener('click', () => aplicarTema(b.dataset.tema)));

// Día: botones ‹ › de la hoja demo.
function moverDia(paso) {
  ui.dia = Math.min(sim.escenario.diasMision - 1, Math.max(0, ui.dia + paso));
  render();
}
$('#dia-menos').addEventListener('click', () => moverDia(-1));
$('#dia-mas').addEventListener('click', () => moverDia(1));

$('#form-semilla').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const escenario = $('#escenario').value;
  if (escenario !== ui.escenario) ui.dia = ESCENARIOS[escenario].diaInicial;
  cargar($('#semilla').value.trim() || SEMILLA_DEMO, escenario);
  render();
});

$('#importar').addEventListener('change', async (ev) => {
  const archivo = ev.target.files[0];
  if (!archivo) return;
  const estadoImportar = $('#importar-estado');
  try {
    const { registros: nuevos, errores } = registrar(leerTexto(await archivo.text()));
    estadoImportar.textContent = `${nuevos.length} ${T().importadas}${errores.length ? ` · ${errores.length} ${T().conErrores}: ${errores.slice(0, 3).join('; ')}` : ''}`;
    if (nuevos.length) aviso(`${nuevos.length} ${T().importadas}`);
  } catch (e) {
    estadoImportar.textContent = `${T().archivoInvalido}: ${e.message}`;
  }
  estadoImportar.hidden = false;
  ev.target.value = '';
});

$('#lienzo').addEventListener('click', () => acompanante.mostrar('ejercitandose'));

let modeloEstres = null;
cargarModelo('modelos/estres.json').then((m) => { modeloEstres = m; }).catch(() => {});
const medicion = iniciarMedicion({
  textos: T,
  modelo: () => modeloEstres,
  alTerminar: (resultado, origen) => {
    acompanante.mostrar('contento');
    // La cámara es una fuente más: su medición entra como FC y VFC del día (la señal de prueba no).
    if (origen === 'camara' && registrar(desdeCamara(resultado)).registros.length) aviso(T().avisos.medido);
  },
});
// Conectar sensor: las fuentes de la plataforma (API abierta), con su estado real.
$('#btn-conectar').addEventListener('click', () => $('#conectar').showModal());
$('#con-archivo').addEventListener('click', () => { $('#conectar').close(); $('#importar').click(); });
$('#con-camara').addEventListener('click', () => { $('#conectar').close(); medicion.abrir(); });
$('#btn-registrar').addEventListener('click', abrirRegistro);

$('#rejilla-animo').addEventListener('click', (ev) => {
  const b = ev.target.closest('.celda');
  if (!b) return;
  seleccion.valencia = Number(b.dataset.v);
  seleccion.activacion = Number(b.dataset.a);
  actualizarGuardar();
});
$('#escala-kss').addEventListener('click', (ev) => {
  const b = ev.target.closest('.kss');
  if (!b) return;
  seleccion.kss = Number(b.dataset.kss);
  actualizarGuardar();
});
$('#sintomas').addEventListener('click', (ev) => {
  const b = ev.target.closest('.sintoma');
  if (!b) return;
  const s = b.dataset.sintoma;
  if (seleccion.sintomas.has(s)) seleccion.sintomas.delete(s);
  else seleccion.sintomas.add(s);
  actualizarGuardar();
});
document.querySelectorAll('#registro .opciones').forEach((caja) => caja.addEventListener('click', (ev) => {
  const b = ev.target.closest('.opcion');
  if (!b) return;
  const campo = caja.dataset.campo;
  const v = Number(b.dataset.valor);
  seleccion[campo] = seleccion[campo] === v ? null : v; // tocar de nuevo lo quita
  actualizarGuardar();
}));
$('#temperatura').addEventListener('input', () => {
  $('#temperatura-error').hidden = !Number.isNaN(leerTemperatura());
  actualizarGuardar();
});
$('#registro').addEventListener('close', () => {
  if ($('#registro').returnValue === 'guardar') guardarRegistro();
});

$('#clinica-contactar').addEventListener('click', () => { $('#clinica-mensaje').hidden = false; });
$('#clinica-ver').addEventListener('click', () => {
  ui.descartadas.add($('#clinica').dataset.clave);
  $('#clinica-mensaje').hidden = true;
  render();
  irAVista('vista-hoy');
});

// ---------- vistas y pestañas ----------

const VISTAS = ['vista-pudu', 'vista-hoy', 'vista-datos', 'vista-tendencias'];
let vistaActual = 0;

function marcarPestana(i) {
  document.querySelectorAll('.pestanas button').forEach((b, j) => {
    b.classList.toggle('activa', i === j);
    b.setAttribute('aria-selected', String(i === j));
  });
  if (i !== vistaActual) vibrar(6);
  vistaActual = i;
}

function irAVista(id) {
  const i = VISTAS.indexOf(id);
  if (pantallaAncha()) {
    $(`#${id}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const v = $('#vistas');
  v.scrollTo({ left: i * v.clientWidth, behavior: 'smooth' });
  marcarPestana(i);
}
document.querySelectorAll('.pestanas button').forEach((b) =>
  b.addEventListener('click', () => {
    // Tocar la pestaña activa vuelve al inicio de esa vista.
    if (VISTAS.indexOf(b.dataset.vista) === vistaActual) $(`#${b.dataset.vista}`).scrollTo({ top: 0, behavior: 'smooth' });
    else irAVista(b.dataset.vista);
  }));
$('#vistas').addEventListener('scroll', () => {
  const v = $('#vistas');
  if (!pantallaAncha()) marcarPestana(Math.round(v.scrollLeft / v.clientWidth));
}, { passive: true });
$('#resumen-pudu').addEventListener('click', () => irAVista('vista-hoy'));

// ---------- modo demo ----------

const hojaDemo = crearHoja($('#demo'), $('#hoja-fondo'));
document.querySelectorAll('[data-abre-demo]').forEach((b) => b.addEventListener('click', hojaDemo.abrir));
$('#demo-cerrar').addEventListener('click', hojaDemo.cerrar);
document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.modo !== ui.modo) cambiarModo(b.dataset.modo);
}));

$('#btn-exportar').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([exportarPersonal(registros)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `puduhealth-${hoyISO()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Borrar pide un segundo toque (sin diálogos del navegador).
let borrarPendiente = null;
$('#btn-borrar').addEventListener('click', async () => {
  const b = $('#btn-borrar');
  if (!borrarPendiente) {
    b.classList.add('confirmar');
    b.textContent = T().borrarConfirmar;
    borrarPendiente = setTimeout(() => {
      borrarPendiente = null;
      b.classList.remove('confirmar');
      b.textContent = T().borrarDatos;
    }, 4000);
    return;
  }
  clearTimeout(borrarPendiente);
  borrarPendiente = null;
  b.classList.remove('confirmar');
  borrarPersonal();
  llaveDatos = null;
  await iniciar();
  render();
  hojaDemo.cerrar();
  aviso(T().datosBorrados);
});

// ---------- privacidad y PIN ----------

function renderSeguridad() {
  const modo = modoBoveda();
  const estado = $('#cifrado-estado');
  estado.textContent = T().cifradoEstado[modo] ?? T().cifradoEstado.dispositivo;
  estado.classList.toggle('aviso-cifrado', modo === 'sin-cifrado');
  $('#btn-pin').hidden = modo === 'sin-cifrado';
  $('#btn-pin').textContent = modo === 'pin' ? T().cambiarPin : T().ponerPin;
  $('#btn-quitar-pin').hidden = modo !== 'pin';
}

$('#btn-pin').addEventListener('click', () => {
  $('#pin-1').value = '';
  $('#pin-2').value = '';
  $('#pin-error').hidden = true;
  $('#dialogo-pin').showModal();
});
$('#pin-cancelar').addEventListener('click', () => $('#dialogo-pin').close());
$('#form-pin').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const pin = $('#pin-1').value;
  const error = (texto) => { $('#pin-error').textContent = texto; $('#pin-error').hidden = false; };
  if (!/^\d{4,8}$/.test(pin)) return error(T().pinInvalido);
  if (pin !== $('#pin-2').value) return error(T().pinNoCoincide);
  $('#pin-guardar').disabled = true;
  await fijarPin(llaveDatos, pin);
  $('#pin-guardar').disabled = false;
  $('#dialogo-pin').close();
  renderSeguridad();
  vibrar(20);
  aviso(T().pinGuardado);
});
$('#btn-quitar-pin').addEventListener('click', async () => {
  await fijarPin(llaveDatos, null);
  renderSeguridad();
  aviso(T().pinQuitado);
});

$('#btn-privacidad').addEventListener('click', () => {
  $('#priv-cuerpo').innerHTML = `<ul class="priv-lista">${T().privacidad
    .map((x) => `<li><strong>${escapar(x.t)}</strong><p>${escapar(x.p)}</p></li>`).join('')}</ul>`;
  hojaDemo.cerrar();
  $('#privacidad').showModal();
});

// ---------- instalar como app ----------

let pedidoInstalar = null;
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  pedidoInstalar = ev;
  $('#btn-instalar').hidden = false;
});
$('#btn-instalar').addEventListener('click', async () => {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice.catch(() => null);
  pedidoInstalar = null;
  $('#btn-instalar').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#btn-instalar').hidden = true; });
// iPhone y iPad no ofrecen el aviso de instalación: se indica el camino manual.
$('#instalar-ios').hidden = !(/iphone|ipad|ipod/i.test(navigator.userAgent) && !instalada());

// ---------- bienvenida (primer uso) ----------

const CLAVE_BIENVENIDA = 'puduhealth.bienvenida';
let pudBienvenida = null;

function pasoBienvenida() {
  const c = $('#bien-pasos');
  return Math.round(c.scrollLeft / c.clientWidth);
}
function actualizarBienvenida() {
  const i = pasoBienvenida();
  const total = T().bienvenida.length;
  document.querySelectorAll('#bien-puntos span').forEach((s, j) => s.classList.toggle('activo', i === j));
  const ultimo = i === total - 1;
  $('#bien-siguiente').hidden = ultimo;
  $('#bien-saltar').hidden = ultimo;
  $('#bien-mio').hidden = !ultimo;
  $('#bien-ejemplo').hidden = !ultimo;
}
function abrirBienvenida() {
  hojaDemo.cerrar();
  const pasos = T().bienvenida;
  $('#bien-pasos').innerHTML = pasos.map((p, i) => `
    <div class="bien-paso"><h2${i === 0 ? ' id="bien-titulo"' : ''}>${escapar(p.titulo)}</h2><p>${escapar(p.texto)}</p></div>`).join('');
  $('#bien-puntos').innerHTML = pasos.map(() => '<span></span>').join('');
  pudBienvenida = crearAcompanante($('#bien-lienzo'), { hoja: HOJA_SPRITES });
  pudBienvenida.fijarEstado('contento');
  $('#bienvenida').showModal();
  $('#bien-pasos').scrollLeft = 0;
  actualizarBienvenida();
}
$('#bien-pasos').addEventListener('scroll', actualizarBienvenida, { passive: true });
$('#bien-siguiente').addEventListener('click', () => {
  const c = $('#bien-pasos');
  const i = pasoBienvenida();
  if (i >= T().bienvenida.length - 1) $('#bienvenida').close();
  else c.scrollTo({ left: (i + 1) * c.clientWidth, behavior: 'smooth' });
});
// Saltar lleva a la elección: Mi registro o la misión de ejemplo.
$('#bien-saltar').addEventListener('click', () => {
  const c = $('#bien-pasos');
  c.scrollTo({ left: (T().bienvenida.length - 1) * c.clientWidth, behavior: 'smooth' });
});
$('#bien-mio').addEventListener('click', () => { $('#bienvenida').close(); cambiarModo('personal', { avisar: false }); });
$('#bien-ejemplo').addEventListener('click', () => { $('#bienvenida').close(); cambiarModo('demo', { avisar: false }); });
$('#bienvenida').addEventListener('close', () => {
  pudBienvenida?.detener();
  pudBienvenida = null;
  try { localStorage.setItem(CLAVE_BIENVENIDA, '1'); } catch { /* sin almacenamiento */ }
});
$('#btn-bienvenida').addEventListener('click', abrirBienvenida);

// ---------- conexión ----------

window.addEventListener('offline', () => aviso(T().avisos.sinConexion, { ms: 4000 }));
window.addEventListener('online', () => aviso(T().avisos.conConexion));

await iniciar();
render();
marcarPestana(0);
document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--fondo').trim();

// Atajos del ícono instalado (manifest.webmanifest): ?accion=registrar | medir.
if (PARAMS.get('accion') === 'registrar') abrirRegistro();
else if (PARAMS.get('accion') === 'medir') medicion.abrir();
else {
  let vista = false;
  try { vista = localStorage.getItem(CLAVE_BIENVENIDA) === '1'; } catch { /* sin almacenamiento */ }
  // ?intro=0: sin introducción (la app incrustada en la presentación, pitch/).
  if (!vista && PARAMS.get('intro') !== '0') abrirBienvenida();
}

// Modo sin conexión (sw.js): requiere HTTPS o localhost.
// Una versión nueva espera hasta que se acepte el aviso; entonces se activa y la app se recarga.
if ('serviceWorker' in navigator) {
  const avisarVersion = (sw) => aviso(T().avisos.nuevaVersion, {
    accion: T().avisos.recargar,
    alAccionar: () => sw.postMessage('actualizar'),
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) avisarVersion(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarVersion(nuevo);
      });
    });
  }).catch(() => {});
  // En la primera visita no hay versión anterior que reemplazar: no se recarga.
  const habiaVersion = Boolean(navigator.serviceWorker.controller);
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando || !habiaVersion) return;
    recargando = true;
    location.reload();
  });
}
