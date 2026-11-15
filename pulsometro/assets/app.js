/*
 * Medición en vivo: cámara + linterna -> promedio del canal rojo por cuadro -> PPG.analizar
 */
'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const VENTANA = 10;          // segundos que se muestran y analizan
  const ESPERA_DEDO = 1;       // s que se ignoran al apoyar el dedo (se estabiliza)
  const MIN_ANALISIS = 5;      // s mínimos para calcular la FC
  const RESPALDO_CADA = 15000; // ms: copia de seguridad de la prueba en curso

  const est = {
    modo: null,                // 'camara' | 'demo' | null
    stream: null, track: null, linterna: false,
    muestras: [],              // ventana móvil {t, r, g, b}
    tDedo: null,               // desde cuándo hay dedo
    prueba: null,              // prueba que se está grabando (ver iniciarPrueba)
    pausadas: {},              // código -> prueba en pausa de la persona actual
    items: [],                 // todo lo guardado en el celular (ver refrescar)
    persona: null,             // { codigo, sesion_id }
    ultRespaldo: 0, ultimaPrueba: null,
    t0Sesion: null, tendencia: [],
    ultDibujo: 0, ultTexto: 0, ultimo: null,
    demo: null, wakeLock: null,
  };

  const lienzo = document.createElement('canvas');
  lienzo.width = 32;
  lienzo.height = 24;
  const ctxL = lienzo.getContext('2d', { willReadFrequently: true });

  const gCrudo = new Grafico($('gCrudo'), { vacio: 'Inicie la cámara o el modo demo' });
  const gFiltrado = new Grafico($('gFiltrado'), { vacio: 'Esperando señal estable…' });
  const gTendencia = new Grafico($('gTendencia'), { vacio: 'Aún sin lecturas' });
  [gCrudo, gFiltrado, gTendencia].forEach((g) => g.render());

  const col = (v) => Grafico.color(v);

  // ======================= almacenamiento en el dispositivo =======================
  // IndexedDB guarda TODO lo grabado en este celular y nunca lo borra por sí solo:
  //   p_<inicio_ms>_<prueba>    prueba terminada ({ datos, subida, archivo, resumen })
  //   pausa_<código>_<prueba>   prueba en pausa, con todo lo necesario para reanudarla ({ pausa })
  //   en_curso                  copia cada 15 s de la prueba que se está grabando ({ pausa })
  // Al subir una prueba al servidor sólo se marca `subida: true`.
  const Respaldo = (() => {
    const memoria = new Map();
    let base = null;
    const abrir = () => {
      if (!base) {
        base = new Promise((ok, mal) => {
          if (!window.indexedDB) { mal(new Error('sin IndexedDB')); return; }
          const r = indexedDB.open('pulsometro', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('pruebas', { keyPath: 'clave' });
          r.onsuccess = () => ok(r.result);
          r.onerror = () => mal(r.error);
        });
      }
      return base;
    };
    const op = async (modo, fn) => {
      const bd = await abrir();
      return new Promise((ok, mal) => {
        const tx = bd.transaction('pruebas', modo);
        const req = fn(tx.objectStore('pruebas'));
        tx.oncomplete = () => ok(req.result);
        tx.onerror = () => mal(tx.error);
        tx.onabort = () => mal(tx.error);
      });
    };
    return {
      async guardar(item) {
        memoria.set(item.clave, item);
        try { await op('readwrite', (s) => s.put(item)); } catch { /* queda en memoria */ }
      },
      async borrar(clave) {
        memoria.delete(clave);
        try { await op('readwrite', (s) => s.delete(clave)); } catch { /* nada */ }
      },
      async obtener(clave) {
        if (memoria.has(clave)) return memoria.get(clave);
        try { return (await op('readonly', (s) => s.get(clave))) || null; } catch { return null; }
      },
      async todos() {
        let lista = [];
        try { lista = await op('readonly', (s) => s.getAll()); } catch { /* sólo memoria */ }
        const mapa = new Map(lista.map((i) => [i.clave, i]));
        memoria.forEach((v, k) => mapa.set(k, v));
        return [...mapa.values()].sort((a, b) => a.clave.localeCompare(b.clave));
      },
    };
  })();
  if (!window.isSecureContext) $('avisoHttps').hidden = false;
  // Pide que el navegador no borre estos datos cuando le falte espacio.
  try { navigator.storage?.persist?.().catch(() => { /* opcional */ }); } catch { /* opcional */ }

  // ======================= cámara =======================
  async function iniciarCamara() {
    detener();
    // Antes de cualquier await: en iOS el permiso del acelerómetro exige venir de un toque.
    const permisoMovimiento = Movimiento.iniciar();
    const aviso = $('estadoCamara');
    aviso.classList.remove('error');
    if (!navigator.mediaDevices?.getUserMedia) {
      aviso.textContent = 'Este navegador no permite usar la cámara aquí: se necesita HTTPS.';
      aviso.classList.add('error');
      return;
    }
    const id = $('selCamara').value;
    const video = {
      width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 },
      ...(id ? { deviceId: { exact: id } } : { facingMode: { ideal: 'environment' } }),
    };
    aviso.textContent = 'Abriendo la cámara…';
    try {
      est.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      const v = $('video');
      v.srcObject = est.stream;
      $('vista').hidden = false;
      await v.play();
    } catch (e) {
      detener();
      const motivo = e && e.name === 'NotAllowedError'
        ? 'se negó el permiso de cámara (revíselo en la configuración del sitio).'
        : e && e.name === 'NotFoundError' ? 'no se encontró una cámara.'
          : (e && e.message) || 'error desconocido.';
      aviso.textContent = 'No se pudo abrir la cámara: ' + motivo;
      aviso.classList.add('error');
      return;
    }
    est.track = est.stream.getVideoTracks()[0];
    est.modo = 'camara';
    await permisoMovimiento;
    empezarSesion();
    bucleCamara();  // la señal se ve de inmediato; la configuración sigue en paralelo
    try {
      await listarCamaras();
      await configurarCamara();
    } catch (e) {
      aviso.textContent = 'Cámara abierta, pero no se pudo configurar: ' + e.message;
    }
  }

  async function configurarCamara() {
    const track = est.track;
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    const estado = [];

    if (caps.torch) {
      await ponerLinterna(true);
      estado.push('linterna: sí');
    } else {
      estado.push('linterna: no disponible (use la luz ambiente o otra cámara)');
    }
    $('btnLinterna').disabled = !caps.torch;

    if ($('chkBloquear').checked) {
      // Se espera a que la exposición automática se ajuste a la linterna y luego se fija.
      await new Promise((r) => setTimeout(r, 1500));
      if (est.track !== track) return;
      const s = track.getSettings();
      const fijar = async (nombre, modo, extra) => {
        if (!caps[modo]?.includes?.('manual')) return `${nombre}: no soportado`;
        try {
          await track.applyConstraints({ advanced: [{ [modo]: 'manual', ...extra }] });
          return `${nombre}: bloqueado`;
        } catch {
          return `${nombre}: no se pudo`;
        }
      };
      estado.push(await fijar('exposición', 'exposureMode',
        s.exposureTime ? { exposureTime: s.exposureTime } : {}));
      estado.push(await fijar('balance', 'whiteBalanceMode',
        s.colorTemperature ? { colorTemperature: s.colorTemperature } : {}));
      estado.push(await fijar('enfoque', 'focusMode', {}));
    }
    const s = track.getSettings();
    estado.push(`${s.width}×${s.height} @ ${Math.round(s.frameRate || 0)} fps`);
    $('estadoCamara').textContent = estado.join(' · ');
  }

  async function ponerLinterna(encender) {
    try {
      await est.track.applyConstraints({ advanced: [{ torch: encender }] });
      est.linterna = encender;
    } catch {
      est.linterna = false;
    }
    $('btnLinterna').textContent = est.linterna ? 'Apagar linterna' : 'Encender linterna';
  }

  async function listarCamaras() {
    const sel = $('selCamara');
    const actual = est.track?.getSettings().deviceId || sel.value;
    const disp = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    sel.innerHTML = '<option value="">Trasera (automática)</option>';
    disp.forEach((d, i) => {
      const o = new Option(d.label || `Cámara ${i + 1}`, d.deviceId);
      sel.add(o);
    });
    if ([...sel.options].some((o) => o.value === actual)) sel.value = actual;
  }

  function bucleCamara() {
    const v = $('video');
    const conRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    let ultimoCuadro = -1;
    // Cada apertura de cámara inicia un ciclo nuevo; el anterior debe terminar aunque el modo
    // vuelva a ser 'camara' (si no, cada cuadro se procesa dos o tres veces).
    const ciclo = (est.ciclo = (est.ciclo || 0) + 1);
    const paso = (ahora) => {
      if (est.modo !== 'camara' || est.ciclo !== ciclo) return;
      // con requestVideoFrameCallback hay exactamente una llamada por cuadro nuevo
      if (v.videoWidth && (conRVFC || v.currentTime !== ultimoCuadro)) {
        ultimoCuadro = v.currentTime;
        procesarCuadro(v, ahora / 1000);
      }
      if (conRVFC) v.requestVideoFrameCallback(paso); else requestAnimationFrame(paso);
    };
    if (conRVFC) v.requestVideoFrameCallback(paso); else requestAnimationFrame(paso);
  }

  // Promedio RGB de la zona central (50 % del ancho y alto) del cuadro.
  function procesarCuadro(v, t) {
    const w = v.videoWidth, h = v.videoHeight;
    ctxL.drawImage(v, w * 0.25, h * 0.25, w * 0.5, h * 0.5, 0, 0, lienzo.width, lienzo.height);
    const d = ctxL.getImageData(0, 0, lienzo.width, lienzo.height).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    agregarMuestra(t, r / n, g / n, b / n);
  }

  // ======================= modo demo =======================
  // Señal sintética: ~72 lpm con arritmia sinusal respiratoria, deriva lenta y ruido.
  function iniciarDemo() {
    detener();
    est.modo = 'demo';
    $('vista').hidden = true;
    $('estadoCamara').textContent = 'Modo demo: señal simulada (no es una medición real).';
    empezarSesion();
    let fase = 0;
    let tAnt = performance.now() / 1000;
    const ruido = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.5;
    est.demo = setInterval(() => {
      const t = performance.now() / 1000;
      const fc = 72 + 5 * Math.sin(2 * Math.PI * 0.25 * t);
      fase += (fc / 60) * (t - tAnt);
      tAnt = t;
      const p = fase % 1;
      const pulso = Math.exp(-(((p - 0.15) / 0.07) ** 2)) + 0.35 * Math.exp(-(((p - 0.45) / 0.09) ** 2));
      const r = 205 - 4 * pulso + 3 * Math.sin(2 * Math.PI * 0.05 * t) + ruido();
      agregarMuestra(t, r, 28 - 0.5 * pulso + ruido() * 0.3, 14 + ruido() * 0.3);
    }, 1000 / 30);
  }

  // ======================= sesión =======================
  function empezarSesion() {
    est.muestras = [];
    est.tendencia = [];
    est.t0Sesion = null;
    est.tDedo = null;
    $('btnDetener').disabled = false;
    pedirPantallaEncendida();
  }

  function detener() {
    if (est.prueba) pausarPrueba('Se apagó la cámara');
    if (est.stream) est.stream.getTracks().forEach((t) => t.stop());
    if (est.demo) clearInterval(est.demo);
    Movimiento.detener();
    Object.assign(est, { stream: null, track: null, demo: null, modo: null, linterna: false });
    $('video').srcObject = null;
    $('btnDetener').disabled = true;
    $('btnLinterna').disabled = true;
    ponerEstado('Detenido', 'gris');
    est.wakeLock?.release?.();
    est.wakeLock = null;
  }

  async function pedirPantallaEncendida() {
    try { est.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
  }

  function agregarMuestra(t, r, g, b) {
    if (est.t0Sesion == null) est.t0Sesion = t;
    est.muestras.push({ t, r, g, b });
    while (est.muestras.length && est.muestras[0].t < t - VENTANA - 1) est.muestras.shift();

    const p = est.prueba;
    if (p) {
      if (p.tSeg0 == null) {
        // Comienza un tramo (inicio o reanudación): se ancla el reloj de la cámara al reloj
        // real (Date.now). Se re-ancla en cada tramo porque al reanudar puede ser otra cámara/página.
        p.tSeg0 = t;
        p.desfaseMs = Date.now() - t * 1000;
      }
      const ts = Math.round(p.desfaseMs + t * 1000);  // timestamp Unix en ms (hora real)
      if (p.inicioMs == null) p.inicioMs = ts;
      p.finMs = ts;
      // t_s = segundos grabados: no incluye las pausas (la hora real está en timestamp_ms)
      const tp = p.activo + (t - p.tSeg0);
      p.muestras.push([+tp.toFixed(3), ts, +r.toFixed(2), +g.toFixed(2), +b.toFixed(2)]);
      if (tp >= p.duracion || p.muestras.length >= 59000) {
        finalizarPrueba(p, true);
        return;
      }
    }
    if (t - est.ultDibujo >= 0.1) {
      est.ultDibujo = t;
      actualizar(t);
    }
  }

  // ======================= análisis y pantalla =======================
  function actualizar(t) {
    const m = est.muestras;
    const ts = m.map((s) => s.t);
    const rs = m.map((s) => s.r);

    // estado del dedo (último medio segundo)
    const rec = m.filter((s) => s.t > t - 0.5);
    const r = PPG.media(rec.map((s) => s.r));
    const g = PPG.media(rec.map((s) => s.g));
    const b = PPG.media(rec.map((s) => s.b));
    const dedo = PPG.dedoPresente(r, g, b);

    // fs real
    const ult2 = m.filter((s) => s.t > t - 2);
    const fs = ult2.length > 1 ? (ult2.length - 1) / (ult2[ult2.length - 1].t - ult2[0].t) : 0;
    $('estadoFs').textContent = `${fs.toFixed(1)} cuadros/s · R ${r.toFixed(0)} G ${g.toFixed(0)} B ${b.toFixed(0)}`;

    gCrudo.dibujar({
      series: [{ x: ts.map((x) => x - t), y: rs, color: col('--rojo') }],
      xMin: -VENTANA, xMax: 0, formatoX: (v) => `${v.toFixed(0)} s`, pasoMinX: 1,
    });

    let a = null;
    if (!dedo) {
      est.tDedo = null;
      ponerEstado('Coloque el dedo sobre la cámara y el flash', 'gris');
    } else {
      if (est.tDedo == null) est.tDedo = t;
      const desde = Math.max(t - VENTANA, est.tDedo + ESPERA_DEDO);
      const falta = MIN_ANALISIS - (t - desde);
      if (falta > 0) {
        ponerEstado(`Dedo detectado · midiendo… ${Math.ceil(falta)} s`, 'azul');
      } else {
        const i0 = ts.findIndex((x) => x >= desde);
        a = PPG.analizar(ts.slice(i0), rs.slice(i0));
        if (Movimiento.enMovimiento()) ponerEstado('Movimiento detectado: la FC no es confiable, quédese quieto', 'ambar');
        else if (PPG.saturado(r)) ponerEstado('Señal saturada: presione menos o mueva el dedo', 'ambar');
        else ponerEstado('Midiendo', 'verde');
      }
    }

    if (a) {
      const xs = Array.from(a.t, (x) => x - t);
      gFiltrado.dibujar({
        series: [{ x: xs, y: a.filtrado, color: col('--acento') }],
        marcas: a.picos.map((i) => ({ x: xs[i], y: a.filtrado[i] })),
        xMin: -VENTANA, xMax: 0, formatoX: (v) => `${v.toFixed(0)} s`, pasoMinX: 1,
      });
    } else {
      gFiltrado.dibujar(null);
    }

    // textos y tendencia: una vez por segundo para que el número no "baile"
    if (t - est.ultTexto >= 1) {
      est.ultTexto = t;
      mostrarResultado(a);
      if (a && a.bpm && a.calidad.puntaje >= 40) {
        est.tendencia.push({ t: t - est.t0Sesion, bpm: a.bpm });
      }
      dibujarTendencia();
      const p = est.prueba;
      if (p) {
        // FC de cada segundo, con su timestamp
        p.fc.push([Date.now(), a && a.bpm ? +a.bpm.toFixed(1) : null, a ? a.calidad.puntaje : null]);
        // Aceleración (RMS del último segundo, m/s²): permite descartar tramos con movimiento.
        const rms = Movimiento.rmsReciente();
        p.movimiento.push([Date.now(), rms === null ? null : +rms.toFixed(3)]);
        if (Date.now() - est.ultRespaldo > RESPALDO_CADA) respaldarEnCurso();
      }
    }
    est.ultimo = a;

    const p = est.prueba;
    if (p) {
      if (p.dedo !== dedo && p.eventos.length < 400) {
        p.eventos.push([Date.now(), dedo ? 'dedo_apoyado' : 'dedo_retirado']);
        p.dedo = dedo;
      }
      const transcurrido = p.tSeg0 == null ? p.activo : p.activo + (t - p.tSeg0);
      $('cursoRestante').textContent = reloj(Math.ceil(p.duracion - transcurrido));
      $('cursoBarra').style.width = Math.min(100, (100 * transcurrido) / p.duracion) + '%';
      $('cursoDetalle').textContent = `${p.muestras.length} muestras · ${dedo ? 'dedo apoyado' : 'SIN DEDO: apoye el dedo'}`;
    }
  }

  function mostrarResultado(a) {
    const q = a ? a.calidad : { puntaje: 0, etiqueta: 'Sin señal' };
    $('valorBpm').textContent = a && a.bpm ? Math.round(a.bpm) : '--';
    $('detalleBpm').textContent = a
      ? `picos: ${a.bpmTiempo ? a.bpmTiempo.toFixed(0) : '--'} · espectro: ${a.bpmFrec.toFixed(0)} lpm`
      : 'picos: -- · espectro: --';
    const barra = $('barraCalidad');
    barra.style.width = q.puntaje + '%';
    barra.className = q.puntaje >= 70 ? 'verde' : q.puntaje >= 40 ? 'ambar' : 'rojo';
    let txt = `${q.etiqueta} (${q.puntaje}/100)`;
    if (a && q.dif != null && q.dif > 5) txt += ' · los métodos no coinciden';
    $('textoCalidad').textContent = txt;
  }

  function dibujarTendencia() {
    const tr = est.tendencia;
    if (tr.length < 2) { gTendencia.dibujar(null); return; }
    const ys = tr.map((p) => p.bpm);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const centro = (lo + hi) / 2, medio = Math.max(10, (hi - lo) / 2 + 3);
    gTendencia.dibujar({
      series: [{ x: tr.map((p) => p.t), y: ys, color: col('--verde'), puntos: true }],
      yMin: centro - medio, yMax: centro + medio,
      formatoX: (v) => reloj(v), pasoMinX: 1,
    });
  }

  function ponerEstado(texto, color) {
    const e = $('estadoDedo');
    e.textContent = texto;
    e.className = 'pastilla ' + color;
  }

  // ======================= participante y consentimiento =======================
  const CLAVE_PERSONA = 'pulsometro:participante';
  const CLAVE_CONSENTIMIENTO = 'pulsometro:consentimiento';
  const VERSION_CONSENTIMIENTO = '1';
  const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PATRON_CODIGO = /^P-[A-HJ-NP-Z2-9]{4}$/;

  function leerLocal(clave) {
    try { return JSON.parse(localStorage.getItem(clave) || 'null'); } catch { return null; }
  }
  function escribirLocal(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  }

  function idAleatorio() {
    const a = new Uint8Array(6);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Código "P-XXXX": 4 caracteres sin letras ni dígitos ambiguos (0, O, 1, I, L), con sesgo
  // eliminado al descartar los bytes que no caben en un múltiplo del alfabeto.
  function generarCodigo() {
    const n = ALFABETO_CODIGO.length;
    const limite = 256 - (256 % n);
    let c = '';
    while (c.length < 4) {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      for (const v of a) {
        if (v < limite && c.length < 4) c += ALFABETO_CODIGO[v % n];
      }
    }
    return 'P-' + c;
  }

  const consentimiento = () => {
    const c = leerLocal(CLAVE_CONSENTIMIENTO);
    return c && c.version === VERSION_CONSENTIMIENTO && typeof c.fecha === 'string' ? c : null;
  };

  // El código agrupa las pruebas de la persona en el celular y es el nombre de su carpeta en el servidor.
  const carpetaItem = (i) => i.participante || null;
  const clavePausa = (p) => `pausa_${p.persona.codigo}_${p.codigo}`;

  function mostrarPersona() {
    const p = est.persona;
    $('pantallaConsentimiento').hidden = !!consentimiento();
    $('codigoPersona').textContent = p ? p.codigo : '—';
    refrescar();
  }

  function nuevaPersona(codigo) {
    est.persona = { codigo, sesion_id: idAleatorio() };  // la sesión agrupa la serie de pruebas
    escribirLocal(CLAVE_PERSONA, est.persona);
  }

  function aceptarConsentimiento(ev) {
    ev.preventDefault();
    if (!$('chkConsentimiento').checked) return;
    escribirLocal(CLAVE_CONSENTIMIENTO, { version: VERSION_CONSENTIMIENTO, fecha: new Date().toISOString() });
    mostrarPersona();
  }

  function mostrarFormCodigo(visible) {
    $('formCodigo').hidden = !visible;
    $('btnCambiarPersona').hidden = visible;
    $('errorCodigo').textContent = '';
    $('inCodigo').value = '';
    if (visible) setTimeout(() => $('inCodigo').focus(), 50);
  }

  function usarOtroCodigo(ev) {
    ev.preventDefault();
    const codigo = $('inCodigo').value.trim().toUpperCase();
    if (!PATRON_CODIGO.test(codigo)) {
      $('errorCodigo').textContent = 'El código tiene la forma P-XXXX (por ejemplo P-7KQ2).';
      return;
    }
    if (est.persona && codigo === est.persona.codigo) { mostrarFormCodigo(false); return; }
    if (est.prueba && !confirm('Hay una prueba grabándose. Quedará en pausa y podrá reanudarla al volver a este código. ¿Continuar?')) return;
    if (est.prueba) pausarPrueba('Se cambió de código');
    nuevaPersona(codigo);
    mostrarFormCodigo(false);
    mensaje('');
    mostrarPersona();
  }

  // ======================= lo guardado en el celular =======================
  // Relee IndexedDB y vuelve a pintar los botones y la lista de pruebas.
  async function refrescar() {
    let items = [];
    try { items = await Respaldo.todos(); } catch { /* sin almacenamiento */ }
    est.items = items.filter((i) => i.clave !== 'en_curso');
    const mia = est.persona ? est.persona.codigo : null;
    est.pausadas = {};
    for (const i of est.items) {
      if (!i.pausa || carpetaItem(i) !== mia) continue;
      if (est.prueba && est.prueba.codigo === i.pausa.codigo) continue;  // ya se reanudó
      est.pausadas[i.pausa.codigo] = i.pausa;
    }
    pintarPruebas();
  }

  const pendientes = () => est.items.filter((i) => i.datos && i.datos.participante && !i.subida);
  const deLaPersona = () => {
    const c = est.persona ? est.persona.codigo : null;
    return est.items.filter((i) => i.datos && carpetaItem(i) === c);
  };

  // Estado de una prueba de la persona actual: 'guardada' | 'pendiente' | 'incompleta' | ''
  function resumenPrueba(codigo) {
    const hechas = deLaPersona().filter((i) => i.datos.prueba === codigo);
    let estado = '';
    if (hechas.some((i) => i.subida && i.datos.completa)) estado = 'guardada';
    else if (hechas.some((i) => !i.subida)) estado = 'pendiente';
    else if (hechas.length) estado = 'incompleta';
    return { estado, n: hechas.length };
  }

  function pintarPruebas() {
    const textos = { guardada: '✓ Guardada', incompleta: 'Guardada (incompleta)', pendiente: '⚠ Sin subir' };
    document.querySelectorAll('.prueba').forEach((b) => {
      const codigo = b.dataset.codigo;
      const enCurso = est.prueba && est.prueba.codigo === codigo;
      const pausa = est.pausadas[codigo];
      const r = resumenPrueba(codigo);
      let estado = r.estado;
      let texto = (textos[r.estado] || 'Pendiente') + (r.n > 1 ? ` · ${r.n} intentos` : '');
      if (pausa) {
        estado = 'pausada';
        texto = `⏸ En pausa ${reloj(pausa.activo)} de ${reloj(pausa.duracion)} · tocar para seguir`;
      }
      if (enCurso) { estado = 'grabando'; texto = '● Grabando'; }
      b.disabled = !est.persona || !consentimiento() || (!!est.prueba && !enCurso);
      b.classList.toggle('activa', !!enCurso);
      b.dataset.estado = estado;
      b.querySelector('.prueba-estado').textContent = texto;
    });
    $('enCurso').hidden = !est.prueba;
    $('selCamara').disabled = !!est.prueba;
    $('btnDemo').disabled = !!est.prueba;
    $('btnCamara').disabled = !!est.prueba;
    pintarLista();
  }

  // ---------- lista de pruebas de la persona ----------
  function boton(texto, fn, clase) {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: texto });
    if (clase) b.className = clase;
    b.onclick = fn;
    return b;
  }

  function fila(texto, estado, botones) {
    const li = document.createElement('li');
    li.dataset.estado = estado;
    const t = document.createElement('span');
    t.textContent = texto;
    const acc = document.createElement('span');
    acc.className = 'botones';
    acc.append(...botones);
    li.append(t, acc);
    return li;
  }

  const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'sin muestras');
  const grabado = (muestras) => (muestras.length ? muestras[muestras.length - 1][0] : 0);
  function fcMedia(fc) {
    const v = (fc || []).filter((f) => f[1] != null && f[2] >= 40).map((f) => f[1]);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  }

  function filaPrueba(i) {
    const d = i.datos;
    const fc = (i.resumen && i.resumen.fc_media_lpm) || fcMedia(d.fc);
    const partes = [fecha(d.inicio_ms), reloj(grabado(d.muestras)), d.completa ? 'completa' : 'incompleta'];
    if (fc) partes.push(`FC media ${Math.round(fc)} lpm`);
    if (d.borg) partes.push(`Borg ${d.borg.valor}${d.borg.etiqueta ? ` (${d.borg.etiqueta})` : ''}`);
    else if (esperandoBorg.has(i.clave)) partes.push('Borg: esperando respuesta');
    partes.push(i.subida ? '✓ en el servidor' : '⚠ sin subir');
    const estado = !i.subida ? 'pendiente' : d.completa ? 'guardada' : 'incompleta';
    const visor = boton('Ver en el visor', () => verEnVisor(d));
    visor.disabled = !!est.prueba;
    return fila(partes.join(' · '), estado, [visor, boton('Descargar JSON', () => descargarJson(d))]);
  }

  function filaPausa(p) {
    const texto = `${fecha(p.inicioMs)} · ⏸ en pausa · ${reloj(p.activo)} de ${reloj(p.duracion)} grabados`;
    const seguir = boton('Reanudar', () => reanudarPrueba(p), 'primario');
    const visor = boton('Ver en el visor', () => verEnVisor(datosPrueba(p, false)));
    seguir.disabled = visor.disabled = !!est.prueba;
    const terminar = boton('Terminar', () => {
      if (confirm(`¿Terminar "${p.nombre}" con ${reloj(p.activo)} grabados? Se guardará como incompleta.`)) finalizarPrueba(p, false);
    });
    return fila(texto, 'pausada', [seguir, terminar, visor, boton('Descargar JSON', () => descargarJson(datosPrueba(p, false)))]);
  }

  function pintarLista() {
    const n = pendientes().length;
    $('cajaReintentar').hidden = n === 0;
    $('textoPendientes').textContent = n
      ? `${n} prueba${n === 1 ? '' : 's'} de este celular sin subir al servidor (quedan guardadas aquí).`
      : '';
    const caja = $('listaPruebas');
    caja.textContent = '';
    $('historial').hidden = !est.persona;
    if (!est.persona) return;
    $('historialCodigo').textContent = est.persona.codigo;
    const mias = deLaPersona();
    let hay = false;
    document.querySelectorAll('.prueba').forEach((b) => {
      const codigo = b.dataset.codigo;
      const filas = [];
      if (est.pausadas[codigo]) filas.push(filaPausa(est.pausadas[codigo]));
      mias.filter((i) => i.datos.prueba === codigo)
        .sort((x, y) => (y.datos.inicio_ms || 0) - (x.datos.inicio_ms || 0))
        .forEach((i) => filas.push(filaPrueba(i)));
      if (!filas.length) return;
      hay = true;
      const h = document.createElement('h3');
      h.textContent = b.dataset.nombre;
      const ul = document.createElement('ul');
      ul.className = 'lista-pruebas';
      ul.append(...filas);
      caja.append(h, ul);
    });
    if (!hay) {
      caja.append(Object.assign(document.createElement('p'), {
        className: 'tenue', textContent: 'Aún no hay pruebas grabadas con este código en este celular.',
      }));
    }
  }

  // ======================= pruebas =======================
  async function iniciarPrueba(boton) {
    if (est.prueba || !est.persona || !consentimiento()) return;
    const codigo = boton.dataset.codigo;
    if (est.pausadas[codigo]) { reanudarPrueba(est.pausadas[codigo]); return; }
    const nombre = boton.dataset.nombre;
    const duracion = Number(boton.dataset.duracion);
    const { n } = resumenPrueba(codigo);
    if (n && !confirm(`"${nombre}" ya tiene ${n} intento${n === 1 ? '' : 's'} con el código ${est.persona.codigo}. `
      + '¿Grabar otro? Los anteriores se conservan.')) return;
    if (!est.modo) {
      await iniciarCamara();  // el clic en la prueba sirve como permiso para abrir la cámara
      if (!est.modo) {
        mensaje('No se pudo iniciar la cámara. Revise el permiso o use el modo demo.', true);
        return;
      }
    }
    if (est.prueba) return;  // se pulsó otra prueba mientras se abría la cámara
    comenzarGrabacion({
      codigo, nombre, duracion,
      persona: { ...est.persona },
      origen: est.modo,
      activo: 0,             // segundos ya grabados en tramos anteriores (pausas)
      tSeg0: null, desfaseMs: 0, inicioMs: null, finMs: null, dedo: null,
      muestras: [], fc: [], movimiento: [], eventos: [[Date.now(), 'inicio']],
    });
    mensaje(`Grabando "${nombre}" (${est.persona.codigo}). Mantenga el dedo sobre la cámara.`);
  }

  function comenzarGrabacion(p) {
    if (!Array.isArray(p.movimiento)) p.movimiento = [];  // pausas guardadas por versiones anteriores
    est.prueba = p;
    $('cursoNombre').textContent = p.nombre;
    $('cursoRestante').textContent = reloj(p.duracion - p.activo);
    $('cursoBarra').style.width = Math.min(100, (100 * p.activo) / p.duracion) + '%';
    pintarPruebas();
    return respaldarEnCurso();
  }

  // El próximo tramo empieza un cuadro después del último grabado (t_s siempre creciente).
  function cerrarTramo(p) {
    const u = p.muestras[p.muestras.length - 1];
    p.activo = u ? +(u[0] + 1 / 30).toFixed(3) : 0;
    p.tSeg0 = null;
  }

  function pausarPrueba(motivo) {
    const p = est.prueba;
    if (!p) return Promise.resolve();
    est.prueba = null;
    cerrarTramo(p);
    p.eventos.push([Date.now(), 'pausa']);
    est.pausadas[p.codigo] = p;
    mensaje(`${motivo ? motivo + ': ' : ''}"${p.nombre}" quedó en pausa con ${reloj(p.activo)} de `
      + `${reloj(p.duracion)} grabados. Tóquela para seguir.`);
    pintarPruebas();
    // primero se guarda la pausa y recién después se quita la copia en curso
    return Respaldo.guardar({ clave: clavePausa(p), participante: p.persona.codigo, pausa: p })
      .then(() => Respaldo.borrar('en_curso'))
      .then(refrescar);
  }

  async function reanudarPrueba(p) {
    if (est.prueba || !p) return;
    if (est.modo && est.modo !== p.origen) {
      mensaje(`"${p.nombre}" se grabó con ${p.origen === 'demo' ? 'el modo demo' : 'la cámara'}: `
        + 'use lo mismo para reanudarla.', true);
      return;
    }
    if (!est.modo) {
      if (p.origen === 'demo') iniciarDemo(); else await iniciarCamara();
      if (!est.modo) {
        mensaje('No se pudo iniciar la cámara para reanudar la prueba.', true);
        return;
      }
    }
    if (est.prueba) return;
    p.tSeg0 = null;
    p.dedo = null;
    p.eventos.push([Date.now(), 'reanudada']);
    delete est.pausadas[p.codigo];
    mensaje(`Reanudando "${p.nombre}" (${p.persona.codigo}) desde ${reloj(p.activo)}. Mantenga el dedo sobre la cámara.`);
    // primero queda la copia "en_curso" y recién después se quita la pausa: siempre hay una copia
    await comenzarGrabacion(p);
    if (est.prueba === p) await Respaldo.borrar(clavePausa(p));
    refrescar();
  }

  function datosPrueba(p, completa) {
    const ultimo = p.muestras[p.muestras.length - 1];
    return {
      participante: p.persona.codigo,
      consentimiento: consentimiento(),
      sesion_id: p.persona.sesion_id,
      prueba: p.codigo,
      prueba_nombre: p.nombre,
      inicio_ms: p.inicioMs,
      fin_ms: p.finMs,
      completa,
      borg: null,  // se completa al responder la escala de Borg (queda arriba en el JSON descargado)
      origen: p.origen,
      fps: ultimo && ultimo[0] > 0 ? +((p.muestras.length - 1) / ultimo[0]).toFixed(1) : null,
      muestras: p.muestras,
      fc: p.fc,
      movimiento: p.movimiento,
      umbral_movimiento: Movimiento.UMBRAL_RMS,
      eventos: p.eventos,
    };
  }

  // Cierra una prueba (la que se graba o una en pausa) y la guarda como terminada.
  function finalizarPrueba(p, completa) {
    if (!p) return;
    const eraActiva = est.prueba === p;
    if (eraActiva) est.prueba = null;
    if (est.pausadas[p.codigo] === p) delete est.pausadas[p.codigo];
    if (p.tSeg0 != null) cerrarTramo(p);
    p.eventos.push([Date.now(), completa ? 'fin' : 'detenida']);
    const limpiar = () => Promise.all([
      eraActiva ? Respaldo.borrar('en_curso') : null,
      Respaldo.borrar(clavePausa(p)),
    ]);
    pintarPruebas();
    if (p.muestras.length < 30) {
      mensaje(`"${p.nombre}" duró muy poco y no se guardó.`, true);
      limpiar().then(refrescar);
      return;
    }
    const datos = datosPrueba(p, completa);
    est.ultimaPrueba = datos;
    const item = { clave: `p_${datos.inicio_ms}_${p.codigo}`, participante: p.persona.codigo, datos, subida: false };
    // El Borg se pregunta sólo si la prueba se estaba grabando (no al terminar después una en pausa).
    // Mientras no se responda, la prueba queda guardada en el celular pero no se sube.
    if (eraActiva) {
      esperandoBorg.add(item.clave);
      mensaje(`"${p.nombre}" terminó: registre el esfuerzo percibido (escala de Borg).`);
    }
    // primero se guarda la prueba terminada y recién después se quitan la pausa y la copia en curso
    const guardada = Respaldo.guardar(item).then(limpiar).then(refrescar);
    const borg = eraActiva ? preguntarBorg(p) : Promise.resolve(null);
    Promise.all([guardada, borg])
      .then(async ([, b]) => {
        if (!b) return;
        datos.borg = b;
        await Respaldo.guardar({ ...item, datos });
        await refrescar();
      })
      .finally(() => {
        esperandoBorg.delete(item.clave);
        subir(item.clave);
      });
  }

  // ======================= escala de Borg =======================
  // Esfuerzo percibido (RPE 6–20) al terminar cada prueba: junto con la FC medida queda
  // el dato subjetivo en el mismo JSON. Los botones de la escala vienen de BORG en inc/datos.php.
  const esperandoBorg = new Set();  // claves de pruebas que no se suben hasta responder u omitir
  let colaBorg = Promise.resolve();

  function preguntarBorg(p) {
    const r = colaBorg.then(() => new Promise((listo) => {
      const velo = $('pantallaBorg');
      const botones = [...velo.querySelectorAll('#escalaBorg button')];
      let elegido = null, boton = null;
      const marcar = (b) => {
        elegido = Number(b.dataset.valor);
        boton = b;
        botones.forEach((x) => {
          x.classList.toggle('elegido', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        $('borgElegido').textContent = `${elegido} · ${b.dataset.texto}`;
        $('btnBorgGuardar').disabled = false;
      };
      const cerrar = (respuesta) => {
        velo.hidden = true;
        $('borgElegido').textContent = 'Toque un número · los pares (+) son intermedios';
        botones.forEach((x) => { x.classList.remove('elegido'); x.setAttribute('aria-pressed', 'false'); });
        $('btnBorgGuardar').disabled = true;
        listo(respuesta);
      };
      botones.forEach((b) => { b.onclick = () => marcar(b); });
      $('btnBorgGuardar').onclick = () => {
        // etiqueta y descripción van también en el JSON del celular (el servidor las vuelve a poner)
        if (elegido != null) {
          cerrar({ valor: elegido, etiqueta: boton.dataset.corto, descripcion: boton.dataset.texto, timestamp_ms: Date.now() });
        }
      };
      $('btnBorgOmitir').onclick = () => {
        if (confirm('¿Guardar la prueba sin la escala de Borg? No se podrá agregar después.')) cerrar(null);
      };
      $('borgPrueba').textContent = p.nombre;
      $('borgPersona').textContent = p.persona.codigo;
      velo.hidden = false;
      velo.scrollTop = 0;
    }));
    colaBorg = r;
    return r;
  }

  function respaldarEnCurso() {
    est.ultRespaldo = Date.now();
    const p = est.prueba;
    if (!p) return Promise.resolve();
    return Respaldo.guardar({ clave: 'en_curso', participante: p.persona.codigo, pausa: p });
  }

  const enviando = new Set();  // evita subir la misma prueba dos veces a la vez

  async function subir(clave) {
    if (enviando.has(clave) || esperandoBorg.has(clave)) return;
    enviando.add(clave);
    try {
      const item = await Respaldo.obtener(clave);
      if (!item || !item.datos || item.subida) return;  // ya subida por otro reintento
      await enviar(item);
    } finally {
      enviando.delete(clave);
    }
    await refrescar();
  }

  async function enviar(item) {
    const d = item.datos;
    mensaje(`Subiendo "${d.prueba_nombre}" al servidor…`);
    try {
      const resp = await fetch('guardar.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pulsometro': '1' },
        body: JSON.stringify({ ...d, consentimiento: d.consentimiento || consentimiento() }),
      });
      let r = null;
      try { r = await resp.json(); } catch { /* no era JSON */ }
      if (!resp.ok || !r || r.ok !== true) throw new Error((r && r.error) || `error del servidor (${resp.status})`);
      // no se borra del celular: sólo se marca como subida
      await Respaldo.guardar({ ...item, subida: true, subidaMs: Date.now(), archivo: r.archivo, resumen: r.resumen || null });
      const fc = r.resumen && r.resumen.fc_media_lpm ? ` · FC media ${Math.round(r.resumen.fc_media_lpm)} lpm` : '';
      mensajeConAcciones(`✓ "${d.prueba_nombre}" (${d.participante}) guardada en el servidor (${r.archivo}) y en este celular${fc}`, false, d);
    } catch (e) {
      const sinRed = e instanceof TypeError;  // fetch lanza TypeError cuando no hay conexión
      const motivo = sinRed ? 'sin conexión con el servidor' : String(e.message).replace(/\.+$/, '');
      mensajeConAcciones(`No se pudo subir "${d.prueba_nombre}": ${motivo}. `
        + 'Quedó guardada en este celular; pulse "Reintentar subir".', true, d);
    }
  }

  async function subirPendientes() {
    const items = (await Respaldo.todos()).filter((i) => i.datos && i.datos.participante && !i.subida && i.clave.startsWith('p_'));
    for (const item of items) await subir(item.clave);
  }

  // Al abrir la página: si quedó una prueba grabándose (se cerró la pestaña, se cayó el
  // navegador…) se recupera EN PAUSA para poder reanudarla. Luego se suben las pendientes.
  async function purgarLegado() {
    const conNombre = (o) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, 'nombre');
    const legado = (i) => (i.datos && (conNombre(i.datos) || !i.datos.participante))
      || (i.pausa && !(i.pausa.persona && i.pausa.persona.codigo));
    try {
      for (const i of await Respaldo.todos()) if (legado(i)) await Respaldo.borrar(i.clave);
    } catch { /* sin almacenamiento */ }
    try {
      if (conNombre(leerLocal(CLAVE_PERSONA))) localStorage.removeItem(CLAVE_PERSONA);
      const g = JSON.parse(sessionStorage.getItem('pulsometro:grabacion') || 'null');
      if (conNombre(g) && !g.participante) sessionStorage.removeItem('pulsometro:grabacion');
    } catch { /* nada */ }
  }

  async function recuperar() {
    await purgarLegado();
    const enCurso = await Respaldo.obtener('en_curso');
    if (enCurso && enCurso.pausa && !(enCurso.pausa.persona && enCurso.pausa.persona.codigo)) {
      await Respaldo.borrar('en_curso');  // copia sin código de participante: no es utilizable
    } else if (enCurso && enCurso.pausa) {
      const p = enCurso.pausa;
      cerrarTramo(p);
      p.eventos.push([p.finMs || Date.now(), 'interrumpida']);
      await Respaldo.guardar({ clave: clavePausa(p), participante: p.persona.codigo, pausa: p });
      await Respaldo.borrar('en_curso');
      mensaje(`"${p.nombre}" (${p.persona.codigo}) se interrumpió y quedó en pausa con ${reloj(p.activo)} grabados.`);
    }
    await refrescar();
    await subirPendientes();
  }

  // ======================= archivos locales =======================
  function nombreSeguro(texto) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sin-nombre';
  }

  function descargarJson(d) {
    const fecha = new Date(d.inicio_ms).toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const url = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }));
    const enlace = Object.assign(document.createElement('a'), {
      href: url, download: `${nombreSeguro(d.participante)}_${fecha}_${d.prueba}.json`,
    });
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function verEnVisor(d) {
    if (est.prueba) {
      mensaje('Pause la prueba que se está grabando antes de abrir el visor.', true);
      return;
    }
    try {
      sessionStorage.setItem('pulsometro:grabacion', JSON.stringify(d));
      detener();
      location.href = 'visor.php?local=1';
    } catch {
      mensaje('No se pudo abrir en el visor. Descargue el JSON y ábralo allí.', true);
    }
  }

  function mensajeConAcciones(texto, error, d) {
    mensaje(texto, error);
    const caja = document.createElement('span');
    caja.className = 'botones acciones-msg';
    const b1 = Object.assign(document.createElement('button'), { textContent: 'Descargar JSON' });
    b1.onclick = () => descargarJson(d);
    const b2 = Object.assign(document.createElement('button'), { textContent: 'Ver en el visor' });
    b2.onclick = () => verEnVisor(d);
    caja.append(b1, b2);
    $('mensaje').append(caja);
  }

  // ======================= utilidades =======================
  function reloj(s) {
    const n = Math.max(0, Math.floor(s));
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }

  function mensaje(txt, error = false) {
    const m = $('mensaje');
    m.textContent = txt;
    m.classList.toggle('error', error);
  }

  // ======================= eventos =======================
  $('btnCamara').onclick = iniciarCamara;
  $('btnDemo').onclick = iniciarDemo;
  $('btnDetener').onclick = detener;
  $('btnLinterna').onclick = () => est.track && ponerLinterna(!est.linterna);
  $('selCamara').onchange = () => { if (est.modo === 'camara') iniciarCamara(); };
  $('formConsentimiento').onsubmit = aceptarConsentimiento;
  $('chkConsentimiento').onchange = () => { $('btnAceptar').disabled = !$('chkConsentimiento').checked; };
  $('formCodigo').onsubmit = usarOtroCodigo;
  $('btnCambiarPersona').onclick = () => mostrarFormCodigo(true);
  $('btnCancelarCodigo').onclick = () => mostrarFormCodigo(false);
  $('btnPausarPrueba').onclick = () => pausarPrueba();
  $('btnDetenerPrueba').onclick = () => {
    if (confirm('¿Terminar la prueba antes de tiempo? Se guardará como incompleta (para seguirla después use Pausar).')) {
      finalizarPrueba(est.prueba, false);
    }
  };
  $('btnReintentar').onclick = () => subirPendientes();
  document.querySelectorAll('.prueba').forEach((b) => { b.onclick = () => iniciarPrueba(b); });
  window.addEventListener('online', () => subirPendientes());
  window.addEventListener('beforeunload', (e) => {
    if (est.prueba) { respaldarEnCurso(); e.preventDefault(); e.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    const visible = document.visibilityState === 'visible';
    if (visible && est.modo) pedirPantallaEncendida();
    // Con la pantalla oculta la cámara deja de entregar cuadros: la prueba se pausa sola.
    if (est.prueba && !visible) {
      est.prueba.eventos.push([Date.now(), 'pantalla_oculta']);
      pausarPrueba('Se ocultó la pantalla');
    }
  });

  // ======================= inicio =======================
  const guardada = leerLocal(CLAVE_PERSONA);
  if (guardada && PATRON_CODIGO.test(guardada.codigo || '') && /^[a-f0-9]{12}$/.test(guardada.sesion_id || '')) {
    est.persona = guardada;
  } else {
    nuevaPersona(generarCodigo());
  }
  mostrarPersona();
  recuperar().catch(() => { /* sin respaldo disponible */ });
})();
