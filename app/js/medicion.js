// Medición de FC en reposo (60 s) con el celular, comparada con la línea base personal.
//
// - Procesamiento de señal: pulsometro/assets/ppg.js (el mismo que se validó contra ECG).
// - Línea base: mediana de hasta 5 mediciones en reposo guardadas en este dispositivo.
// - Estrés agudo: modelo app/modelos/estres.json (entrenado con ECG de WESAD).
// - La grabación cruda se puede descargar en JSON para análisis posterior.

import { abrirCamara, cerrarCamara, fijarExposicion, capturarCuadros, senalPrueba } from './captura.js';
import { estimarEstres } from './modelos.js';
import { abrirDialogo } from './ui.js';

const DURACION = 60;
const VENTANA_VIVO = 10;
const MAX_BASE = 5;

const $ = (s) => document.querySelector(s);
// ppg.js se carga como script clásico: su `const PPG` es global pero no queda en window.
// eslint-disable-next-line no-undef
const obtenerPPG = () => PPG;
// eslint-disable-next-line no-undef
const obtenerMovimiento = () => Movimiento;
const MAX_FRACCION_MOVIMIENTO = 0.1;
const mediana = (a) => {
  const o = [...a].sort((x, y) => x - y);
  const k = o.length >> 1;
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};

// La línea base vive donde la app indique (cifrada en Mi registro, ver panel.js y cifrado.js).
// Por omisión sólo dura la sesión: nunca se escribe en claro en el almacenamiento del navegador.
let almacenBase = (() => {
  let lista = [];
  return { leer: () => lista, guardar: (l) => { lista = l; } };
})();
export function usarAlmacenBase(almacen) { almacenBase = almacen; }

const leerBase = () => almacenBase.leer() ?? [];
const guardarBase = (lista) => almacenBase.guardar(lista.slice(-MAX_BASE));

export function lineaBaseEnVivo() {
  const lista = leerBase();
  if (!lista.length) return null;
  const valores = (k) => lista.map((m) => m[k]).filter((v) => v > 0);
  return {
    n: lista.length,
    bpm: mediana(valores('bpm')),
    rmssd: valores('rmssd').length ? mediana(valores('rmssd')) : null,
    sdnn: valores('sdnn').length ? mediana(valores('sdnn')) : null,
  };
}

export function iniciarMedicion({ textos, modelo, alTerminar = () => {} }) {
  const dlg = $('#medicion');
  const video = $('#med-video');
  const lienzo = $('#med-onda');
  const ctx = lienzo.getContext('2d');
  const est = { cam: null, detener: null, muestras: [], t0: null, inicioMs: null, desfaseMs: null, resultado: null, origen: null, ultimo: 0 };

  const T = () => textos();
  const fmt = (v, d = 0) => (v === null || v === undefined ? '—' : v.toFixed(d));

  function estado(texto, clase = '') {
    const el = $('#med-estado');
    el.textContent = texto;
    el.className = `med-estado ${clase}`;
  }

  function reiniciarVista() {
    est.muestras = [];
    est.t0 = null;
    est.ultimo = -Infinity;
    est.tics = 0;
    est.ticsMovimiento = 0;
    est.resultado = null;
    $('#med-bpm').textContent = '--';
    $('#med-tiempo').textContent = DURACION;
    $('#med-barra').style.width = '0%';
    $('#med-resultado').hidden = true;
    $('#med-descargar').hidden = true;
    $('#med-agregar-base').hidden = true;
    $('#med-iniciar').hidden = false;
    $('#med-prueba').hidden = false;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    estado(T().medInstruccion);
  }

  function parar() {
    est.detener?.();
    est.detener = null;
    obtenerMovimiento().detener();
    cerrarCamara(est.cam);
    est.cam = null;
    video.srcObject = null;
  }

  function dibujar(filtrado) {
    const { width: w, height: h } = lienzo;
    ctx.clearRect(0, 0, w, h);
    if (!filtrado?.length) return;
    let min = Infinity;
    let max = -Infinity;
    for (const v of filtrado) { min = Math.min(min, v); max = Math.max(max, v); }
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--rojo') || '#ff5c6c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    filtrado.forEach((v, i) => {
      const x = (i / (filtrado.length - 1)) * w;
      const y = h - 8 - ((v - min) / (max - min || 1)) * (h - 16);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }

  function alMuestra(m) {
    const ppg = obtenerPPG();
    est.muestras.push(m);
    const recientes = est.muestras.filter((s) => s.t >= m.t - 0.5);
    const media = (k) => recientes.reduce((a, s) => a + s[k], 0) / recientes.length;
    const dedo = ppg.dedoPresente(media('r'), media('g'), media('b'));

    if (est.t0 === null) {
      // El tiempo empieza a correr cuando el dedo cubre la cámara.
      if (!dedo) {
        est.muestras = est.muestras.filter((s) => s.t >= m.t - 1);
        estado(T().medEsperandoDedo, 'ambar');
        return;
      }
      est.t0 = m.t;
      est.desfaseMs = Date.now() - m.t * 1000;
      est.inicioMs = Math.round(est.desfaseMs + m.t * 1000);
      est.muestras = [m];
    }

    const transcurrido = m.t - est.t0;
    if (transcurrido >= DURACION) {
      terminar();
      return;
    }
    if (m.t - est.ultimo < 0.25) return;
    est.ultimo = m.t;

    $('#med-tiempo').textContent = Math.ceil(DURACION - transcurrido);
    $('#med-barra').style.width = `${(100 * transcurrido) / DURACION}%`;
    const vivo = est.muestras.filter((s) => s.t >= m.t - VENTANA_VIVO);
    const a = vivo.length > 30 * 4 ? ppg.analizar(vivo.map((s) => s.t), vivo.map((s) => s.r)) : null;
    if (a) {
      dibujar(a.filtrado);
      if (a.bpm && a.calidad.puntaje >= 40) $('#med-bpm').textContent = Math.round(a.bpm);
    }
    const moviendo = obtenerMovimiento().enMovimiento();
    est.tics++;
    if (moviendo) est.ticsMovimiento++;
    if (!dedo) estado(T().medEsperandoDedo, 'ambar');
    else if (moviendo) estado(T().medMovimiento, 'ambar');
    else if (ppg.saturado(media('r'))) estado(T().medSaturado, 'ambar');
    else estado(T().medMidiendo);
  }

  function terminar() {
    parar();
    const ppg = obtenerPPG();
    const m = est.muestras;
    const a = ppg.analizar(m.map((s) => s.t - est.t0), m.map((s) => s.r));
    const base = lineaBaseEnVivo();
    est.resultado = {
      bpm: a?.bpm ?? null,
      rmssd: a?.rmssd ?? null,
      sdnn: a?.sdnn ?? null,
      calidad: a?.calidad.puntaje ?? 0,
      etiqueta_calidad: a?.calidad.etiqueta ?? 'Sin pulso',
      latidos: a?.latidos ?? 0,
      movimiento: {
        disponible: est.origen === 'camara' && obtenerMovimiento().disponible(),
        fraccion: est.tics ? +(est.ticsMovimiento / est.tics).toFixed(3) : null,
        umbral_rms: obtenerMovimiento().UMBRAL_RMS,
      },
    };
    est.resultado.valida = Boolean(est.resultado.bpm) && est.resultado.calidad >= 40
      && !(est.resultado.movimiento.disponible && est.resultado.movimiento.fraccion > MAX_FRACCION_MOVIMIENTO);
    const modeloCargado = modelo();
    est.estres = base && modeloCargado && est.resultado.valida
      ? estimarEstres(modeloCargado, est.resultado, base)
      : null;
    est.base = base;
    mostrarResultado();
    $('#med-iniciar').hidden = false;
    $('#med-iniciar').textContent = T().medRepetir;
    $('#med-prueba').hidden = false;
    $('#med-descargar').hidden = false;
    $('#med-agregar-base').hidden = !(est.resultado.valida && est.origen === 'camara');
    estado('');
    alTerminar(est.resultado, est.origen);
  }

  function mostrarResultado() {
    const t = T();
    const r = est.resultado;
    const partes = [];
    const conMovimiento = r.movimiento.disponible && r.movimiento.fraccion > MAX_FRACCION_MOVIMIENTO;
    if (r.calidad < 40 || !r.bpm) {
      partes.push(`<p class="med-aviso">${t.medMalaCalidad}</p>`);
    } else if (conMovimiento) {
      partes.push(`<p class="med-aviso">${t.medMovimientoInvalida} (${Math.round(100 * r.movimiento.fraccion)} %)</p>`);
    } else {
      partes.push(`<div class="med-resumen"><span class="med-fc">${Math.round(r.bpm)}</span> <span>lpm</span></div>`);
      partes.push(`<p class="nota">${t.medCalidad}: ${r.calidad}/100 · ${t.medVfc}: RMSSD ${fmt(r.rmssd)} ms</p>`);
      if (est.base) {
        const dif = r.bpm - est.base.bpm;
        partes.push(`<p>${dif >= 0 ? '+' : ''}${dif.toFixed(1)} lpm · ${t.medBase} ${est.base.bpm.toFixed(0)} lpm (${est.base.n} ${t.medMediciones})</p>`);
        if (est.estres) {
          const si = est.estres.estres;
          partes.push(`<p class="med-estres ${si ? 'si' : 'no'}">${si ? t.medEstresSi : t.medEstresNo} · ${t.medProb} ${Math.round(100 * est.estres.probabilidad)} %</p>`);
          partes.push(`<p class="nota">${t.medModelo}</p>`);
        }
      } else {
        partes.push(`<p class="nota">${t.medSinBase}</p>`);
      }
    }
    if (est.origen === 'camara' && !r.movimiento.disponible) partes.push(`<p class="nota">${t.medSinAcelerometro}</p>`);
    if (est.origen === 'prueba') partes.push(`<p class="nota">${t.medEsPrueba}</p>`);
    $('#med-resultado').innerHTML = partes.join('');
    $('#med-resultado').hidden = false;
  }

  async function empezar(origen) {
    parar();
    reiniciarVista();
    est.origen = origen;
    $('#med-iniciar').hidden = true;
    $('#med-prueba').hidden = true;
    if (origen === 'prueba') {
      est.detener = senalPrueba(alMuestra);
      return;
    }
    // Antes de cualquier otro await: en iOS el permiso del acelerómetro exige venir de un toque.
    const permisoMovimiento = obtenerMovimiento().iniciar();
    try {
      est.cam = await abrirCamara(video);
      await permisoMovimiento;
    } catch {
      estado(T().medSinCamara, 'rojo');
      $('#med-iniciar').hidden = false;
      $('#med-prueba').hidden = false;
      return;
    }
    if (!est.cam.linterna) estado(T().medSinLinterna, 'ambar');
    est.detener = capturarCuadros(video, alMuestra);
    fijarExposicion(est.cam).catch(() => {});
  }

  function descargar() {
    const ultimo = est.muestras.at(-1);
    const datos = {
      origen: est.origen === 'camara' ? 'celular-ppg' : 'senal-prueba',
      prueba: 'fc_reposo_60s',
      inicio_ms: est.inicioMs,
      fin_ms: ultimo ? Math.round(est.desfaseMs + ultimo.t * 1000) : null,
      fps: ultimo && ultimo.t > est.t0 ? +((est.muestras.length - 1) / (ultimo.t - est.t0)).toFixed(1) : null,
      // [t desde el inicio (s), timestamp Unix (ms), R, G, B]: mismo formato que el pulsómetro
      muestras: est.muestras.map((s) => [+(s.t - est.t0).toFixed(3), Math.round(est.desfaseMs + s.t * 1000), +s.r.toFixed(2), +s.g.toFixed(2), +s.b.toFixed(2)]),
      resultado: est.resultado,
      linea_base: est.base,
      estres: est.estres,
      agente: navigator.userAgent,
    };
    const fecha = new Date(est.inicioMs ?? Date.now()).toISOString().replace(/[-:]/g, '').slice(0, 15);
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `medicion-${fecha}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function agregarABase() {
    const r = est.resultado;
    guardarBase([...leerBase(), { bpm: r.bpm, rmssd: r.rmssd, sdnn: r.sdnn, fecha: new Date().toISOString() }]);
    $('#med-agregar-base').hidden = true;
    estado(`${T().medBaseGuardada} (${leerBase().length}/${MAX_BASE})`, 'verde');
  }

  $('#med-iniciar').addEventListener('click', () => empezar('camara'));
  $('#med-prueba').addEventListener('click', () => empezar('prueba'));
  $('#med-descargar').addEventListener('click', descargar);
  $('#med-agregar-base').addEventListener('click', agregarABase);
  $('#med-borrar-base').addEventListener('click', () => {
    guardarBase([]);
    estado(T().medBaseBorrada);
  });
  $('#med-cerrar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', parar);

  return {
    abrir() {
      reiniciarVista();
      $('#med-iniciar').textContent = T().medIniciar;
      abrirDialogo(dlg);
    },
  };
}
