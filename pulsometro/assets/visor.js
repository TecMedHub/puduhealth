/*
 * Visor de registros: carga un registro (del servidor o un archivo local),
 * lo analiza completo y muestra señal, latidos, tacograma, tendencia y espectro.
 */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const col = (v) => Grafico.color(v);

  const g = {
    crudo: new Grafico($('gCrudo')),
    filtrado: new Grafico($('gFiltrado')),
    ibi: new Grafico($('gIbi')),
    tendencia: new Grafico($('gTendencia')),
    espectro: new Grafico($('gEspectro')),
  };
  Object.values(g).forEach((x) => x.render());

  let reg = null;   // {id, nombre, t, r, g, b, ...}
  let an = null;    // resultado de PPG.analizar sobre el tramo útil
  let tend = [];    // FC por ventanas

  // ---------- carga ----------
  // Grabación recién hecha en "Medición en vivo" (viene por sessionStorage, nunca pasa por el servidor).
  function cargarDeSesion() {
    let d = null;
    try { d = JSON.parse(sessionStorage.getItem('pulsometro:grabacion') || 'null'); } catch { /* sin acceso */ }
    if (!d || !Array.isArray(d.muestras)) {
      mensaje('No se encontró la grabación en esta pestaña. Descárguela como CSV y ábrala aquí.', true);
      return;
    }
    usar({ ...d, ...normalizarMeta(d, 'Grabación'), ...columnas(d.muestras) });
  }

  // Acepta [t, timestamp_ms, r, g, b] (pruebas del protocolo) o [t, r, g, b] (CSV).
  function columnas(muestras) {
    const conTs = muestras.length > 0 && Array.isArray(muestras[0]) && muestras[0].length === 5;
    const o = conTs ? 1 : 0;
    return {
      t: muestras.map((m) => +m[0]),
      r: muestras.map((m) => +m[1 + o]),
      g: muestras.map((m) => (m.length > 2 + o ? +m[2 + o] : 0)),
      b: muestras.map((m) => (m.length > 3 + o ? +m[3 + o] : 0)),
    };
  }

  // Título y fecha tanto para el JSON del servidor como para el que se descarga del celular.
  function normalizarMeta(d, respaldo) {
    const p = d.participante;
    const codigo = typeof p === 'string' ? p : p && typeof p.codigo === 'string' ? p.codigo : '';
    const anterior = !codigo && (d.nombre !== undefined || (p && p.nombre !== undefined));
    const persona = codigo || (anterior ? '(registro anterior)' : respaldo || 'Registro');
    const prueba = (d.prueba && d.prueba.nombre) || d.prueba_nombre || '';
    return {
      nombre: String(prueba ? `${persona} — ${prueba}` : persona),
      creado: d.inicio || (d.inicio_ms ? new Date(d.inicio_ms).toISOString() : d.creado),
      notas: d.completa === false ? 'prueba incompleta' : d.notas,
    };
  }

  function parsearCsv(texto) {
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sep = lineas[0].includes(';') ? ';' : lineas[0].includes('\t') ? '\t' : ',';
    let idx = { t: 0, r: 1, g: 2, b: 3 };
    if (/[a-z]/i.test(lineas[0])) {
      const cab = lineas.shift().split(sep).map((c) => c.trim().toLowerCase().replace(/"/g, ''));
      const buscar = (nombres, def) => {
        const i = cab.findIndex((c) => nombres.includes(c));
        return i >= 0 ? i : def;
      };
      idx = {
        t: buscar(['t', 'tiempo', 'time', 't_s', 'tiempo_s', 'timestamp'], 0),
        r: buscar(['r', 'rojo', 'red', 'ppg', 'senal', 'señal', 'valor'], 1),
        g: buscar(['g', 'verde', 'green'], -1),
        b: buscar(['b', 'azul', 'blue'], -1),
      };
    }
    const muestras = [];
    for (const l of lineas) {
      const c = l.split(sep).map(Number);
      const opc = (i) => (i >= 0 && Number.isFinite(c[i]) ? c[i] : 0);
      const fila = [c[idx.t], c[idx.r], opc(idx.g), opc(idx.b)];
      if (fila.slice(0, 2).every(Number.isFinite)) muestras.push(fila);
    }
    return { muestras, sinColor: idx.g < 0 };
  }

  async function cargarArchivo(archivo) {
    if (archivo.size > 30 * 1024 * 1024) {
      mensaje('El archivo es demasiado grande (máximo 30 MB).', true);
      return;
    }
    try {
      const texto = await archivo.text();
      if (archivo.name.toLowerCase().endsWith('.json')) {
        let d = JSON.parse(texto);
        if (!d || !Array.isArray(d.muestras)) throw new Error('el JSON no tiene un arreglo "muestras"');
        usar({ ...d, id: null, ...normalizarMeta(d, archivo.name), ...columnas(d.muestras) });
      } else {
        const { muestras, sinColor } = parsearCsv(texto);
        if (!muestras.length) throw new Error('no se encontraron filas numéricas');
        usar({ id: null, nombre: archivo.name, sinColor, ...columnas(muestras) });
      }
    } catch (e) {
      mensaje('No se pudo leer el archivo: ' + e.message, true);
    }
  }

  // Ordena por tiempo, quita tiempos repetidos y pasa de milisegundos a segundos si hace falta.
  function normalizarTiempos(d) {
    const orden = d.t.map((_, i) => i).filter((i) => Number.isFinite(d.t[i]) && Number.isFinite(d.r[i]));
    orden.sort((a, b) => d.t[a] - d.t[b]);
    const out = { t: [], r: [], g: [], b: [] };
    for (const i of orden) {
      if (out.t.length && d.t[i] <= out.t[out.t.length - 1]) continue;
      out.t.push(d.t[i]); out.r.push(d.r[i]); out.g.push(d.g[i] || 0); out.b.push(d.b[i] || 0);
    }
    let enMs = false;
    if (out.t.length > 2) {
      const pasos = out.t.slice(1).map((v, i) => v - out.t[i]);
      if (PPG.mediana(pasos) >= 1) {
        enMs = true;
        out.t = out.t.map((v) => v / 1000);
      }
    }
    return { ...out, enMs };
  }

  // ---------- análisis ----------
  function usar(entrada) {
    const norm = normalizarTiempos(entrada);
    const d = { ...entrada, t: norm.t, r: norm.r, g: norm.g, b: norm.b };
    reg = d;
    an = null;
    tend = [];
    $('tituloReg').textContent = d.nombre || 'Registro';
    $('accionesReg').hidden = d.t.length === 0;
    $('infoReg').textContent = '';
    $('cifras').innerHTML = '';

    if (d.t.length < 60) {
      mensaje('El registro es demasiado corto para analizarlo.', true);
      dibujarTodo();
      return;
    }
    // tiempos desde 0
    const t0 = d.t[0];
    d.t = d.t.map((x) => x - t0);
    if (d.t[d.t.length - 1] > 3600) {
      reg = null;
      mensaje('El registro dura más de 1 hora o la columna de tiempo no está en segundos/milisegundos.', true);
      dibujarTodo();
      return;
    }

    // Sólo el tramo continuo más largo con el dedo puesto (si hay datos de color)
    let i0 = 0, i1 = d.t.length;
    const avisos = [];
    if (norm.enMs) avisos.push('Los tiempos parecían estar en milisegundos y se convirtieron a segundos.');
    if (!d.sinColor && d.g.some((v) => v > 0)) {
      [i0, i1] = PPG.segmentoConDedo(d.r, d.g, d.b);
      if (i1 - i0 < 60) {
        mensaje('No se detectó el dedo sobre la cámara en este registro.', true);
        dibujarTodo();
        return;
      }
      if (i0 > 0 || i1 < d.t.length) {
        avisos.push(`Se analizó el tramo ${d.t[i0].toFixed(1)}–${d.t[i1 - 1].toFixed(1)} s (con el dedo puesto).`);
      }
    }
    const ts = d.t.slice(i0, i1), rs = d.r.slice(i0, i1);
    an = PPG.analizar(ts, rs);
    if (!an) {
      mensaje('El tramo útil es menor a 4 s: no se puede calcular la FC.', true);
      dibujarTodo();
      return;
    }

    // FC en ventanas deslizantes de 10 s, paso 1 s
    for (let ini = ts[0]; ini + 10 <= ts[ts.length - 1]; ini += 1) {
      const a = ts.findIndex((x) => x >= ini);
      let b = a;
      while (b < ts.length && ts[b] < ini + 10) b++;
      const w = PPG.analizar(ts.slice(a, b), rs.slice(a, b));
      if (w && w.bpm) tend.push({ t: ini + 5, bpm: w.bpm, q: w.calidad.puntaje });
    }

    const fsReal = (d.t.length - 1) / (d.t[d.t.length - 1] || 1);
    const info = [
      d.creado ? new Date(d.creado).toLocaleString('es-CL') : null,
      `${d.t[d.t.length - 1].toFixed(1)} s`,
      `${d.t.length} muestras`,
      `${fsReal.toFixed(1)} cuadros/s`,
      d.origen === 'demo' ? 'señal simulada (demo)' : null,
      d.notas || null,
    ].filter(Boolean);
    $('infoReg').textContent = info.join(' · ');
    mensaje(avisos.join(' '));
    mostrarCifras();
    $('rangoPos').value = 0;
    dibujarTodo();
  }

  function mostrarCifras() {
    const f = (v, dec = 0) => (v == null || !isFinite(v) ? '--' : v.toFixed(dec));
    const q = an.calidad;
    const bpms = tend.filter((p) => p.q >= 40).map((p) => p.bpm);
    const cifras = [
      ['FC (mediana de intervalos)', f(an.bpmTiempo), 'lpm'],
      ['FC (pico del espectro)', f(an.bpmFrec), 'lpm'],
      ['Rango FC (ventanas 10 s)', bpms.length ? `${f(Math.min(...bpms))}–${f(Math.max(...bpms))}` : '--', 'lpm'],
      ['Latidos detectados', String(an.latidos), ''],
      ['RMSSD', f(an.rmssd), 'ms'],
      ['SDNN', f(an.sdnn), 'ms'],
      ['Calidad global', `${q.puntaje}`, `/100 · ${q.etiqueta}`],
    ];
    // Esfuerzo percibido (escala de Borg 6–20) preguntado al terminar la prueba
    const borg = Number(reg.borg && reg.borg.valor);
    if (Number.isInteger(borg) && borg >= 6 && borg <= 20) {
      // la descripción viene del archivo: se escapa porque cifras se arma con innerHTML
      const desc = String(reg.borg.descripcion || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      cifras.push(['Esfuerzo percibido (Borg)', String(borg), `/ 20${desc ? ' · ' + desc : ''}`]);
    }
    $('cifras').innerHTML = cifras.map(([k, v, u]) =>
      `<div class="tarjeta cifra"><div class="etiqueta">${k}</div><div><span class="numero chico">${v}</span> <span class="unidad">${u}</span></div></div>`
    ).join('');
    if (an.duracion < 60) {
      $('cifras').insertAdjacentHTML('beforeend',
        '<p class="tenue mini nota">La VFC (RMSSD, SDNN) es más confiable con registros de 1 a 2 minutos.</p>');
    }
  }

  // ---------- dibujo ----------
  function ventanaVisible() {
    const dur = reg ? reg.t[reg.t.length - 1] : 0;
    const zoom = +$('selZoom').value;
    if (!zoom || zoom >= dur) return [0, Math.max(dur, 1)];
    const x0 = (+$('rangoPos').value / 1000) * (dur - zoom);
    return [x0, x0 + zoom];
  }

  function dibujarTodo() {
    if (!reg || !an) {
      Object.values(g).forEach((x) => x.dibujar(null));
      if (reg) g.crudo.dibujar({ series: [{ x: reg.t, y: reg.r, color: col('--rojo') }] });
      return;
    }
    const [x0, x1] = ventanaVisible();
    const fmt = (v) => `${v.toFixed(0)} s`;

    g.crudo.dibujar({ series: [{ x: reg.t, y: reg.r, color: col('--rojo') }], xMin: x0, xMax: x1, formatoX: fmt, pasoMinX: 1 });
    g.filtrado.dibujar({
      series: [{ x: an.t, y: an.filtrado, color: col('--acento') }],
      marcas: an.picos.map((i) => ({ x: an.t[i], y: an.filtrado[i] })),
      xMin: x0, xMax: x1, formatoX: fmt, pasoMinX: 1,
    });
    g.ibi.dibujar({
      series: [{ x: an.ibis.map((i) => i.t), y: an.ibis.map((i) => i.v * 1000), color: col('--violeta'), puntos: true }],
      formatoX: fmt, pasoMinX: 1,
    });
    g.tendencia.dibujar({
      series: [{ x: tend.map((p) => p.t), y: tend.map((p) => (p.q >= 40 ? p.bpm : null)), color: col('--verde'), puntos: true }],
      formatoX: fmt, pasoMinX: 1,
      vacio: 'Se necesitan más de 10 s de registro',
    });
    const pmax = Math.max(...an.espectro.p) || 1;
    g.espectro.dibujar({
      series: [{ x: an.espectro.f.map((f) => f * 60), y: an.espectro.p.map((p) => p / pmax), color: col('--ambar') }],
      marcas: [{ x: an.bpmFrec, y: 1, color: col('--rojo') }],
      yMin: 0, yMax: 1.08,
      formatoX: (v) => `${v.toFixed(0)}`,
      titulo: `pico: ${an.bpmFrec.toFixed(0)} lpm`,
    });
  }

  function mensaje(txt, error = false) {
    const m = $('mensaje');
    m.textContent = txt;
    m.classList.toggle('error', error);
  }

  // ---------- eventos ----------
  $('selZoom').onchange = dibujarTodo;
  $('rangoPos').oninput = dibujarTodo;
  $('archivo').onchange = (e) => e.target.files[0] && cargarArchivo(e.target.files[0]);
  $('btnCsvReg').onclick = () => {
    if (!reg) return;
    const filas = ['t,r,g,b', ...reg.t.map((t, i) => [+t.toFixed(3), reg.r[i], reg.g[i], reg.b[i]].join(','))];
    const url = URL.createObjectURL(new Blob([filas.join('\n') + '\n'], { type: 'text/csv' }));
    const base = String(reg.nombre || 'registro').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\.(csv|txt|json)$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const enlace = Object.assign(document.createElement('a'), { href: url, download: `ppg_${base || 'registro'}.csv` });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (new URLSearchParams(location.search).get('local') === '1') cargarDeSesion();
})();
