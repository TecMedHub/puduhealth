// Director del video de 30 s: escenas en pixel art + la app real conducida por un guion.
// Se inyecta en app/index.html (con video/reloj.js) y expone window.__video.cuadro(t).
// window.__VIDEO = { idioma: 'es' | 'en', formato: 'horizontal' | 'vertical' } lo fija grabar.mjs.
(async () => {
  const { dibujarPudu: grillaPudu, poseDeEstado, PALETA } = await import(new URL('js/acompanante.js', location.href).href);
  const $ = (s) => document.querySelector(s);
  const DURACION = 30;
  const { idioma = 'en', formato = 'horizontal' } = window.__VIDEO ?? {};
  const VERTICAL = formato === 'vertical';
  const L = (es, en) => (idioma === 'es' ? es : en);

  // ---------- capa superpuesta ----------
  document.head.insertAdjacentHTML('beforeend', `
    <style>
      *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
      #v-capa { position: fixed; inset: 0; margin: 0; padding: 0; border: 0; width: 100vw; height: 100vh;
                max-width: none; max-height: none; background: #120e2b; overflow: hidden; }
      #v-cielo { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
      #v-textos { position: absolute; inset: 0; pointer-events: none; color: #f3eefc; font-family: 'Inter', sans-serif; }
      .v-pix { font-family: 'Press Start 2P', monospace; }
      .v-abs { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; text-align: center; }
      .v-vert .v-abs { white-space: normal; width: 88%; line-height: 1.35; }
      #v-sub {
        position: fixed; inset: auto; left: 50%; bottom: 5.5%; transform: translateX(-50%); margin: 0;
        max-width: 82%; padding: 14px 26px; border-radius: 12px;
        background: rgba(12, 9, 34, 0.86); border: 2px solid #b9a6f0; color: #fff;
        font: 700 26px/1.3 'Inter', sans-serif; text-align: center; box-shadow: 0 6px 30px rgba(0,0,0,.45);
      }
      /* vertical (9:16): subtítulo sobre la zona que tapan los controles de Instagram */
      #v-sub.v-vert { bottom: 21%; max-width: 88%; width: max-content; padding: 9px 14px; border-radius: 10px; font-size: 16px; border-width: 1.5px; }
    </style>`);
  document.body.insertAdjacentHTML('beforeend', `
    <div id="v-capa" popover="manual"><canvas id="v-cielo"></canvas><div id="v-textos" class="${VERTICAL ? 'v-vert' : ''}"></div></div>
    <div id="v-sub" popover="manual" class="${VERTICAL ? 'v-vert' : ''}"></div>`);
  // Fuentes: Press Start 2P de Google Fonts (Inter ya viene con la app), antes del primer cuadro.
  await new Promise((listo) => {
    const l = Object.assign(document.createElement('link'), {
      rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=block',
    });
    l.onload = listo;
    l.onerror = listo;
    document.head.appendChild(l);
  });
  await Promise.all(['46px "Press Start 2P"', '700 29px Inter', '500 30px Inter'].map((f) => document.fonts.load(f)));

  const cielo = $('#v-cielo');
  const W = VERTICAL ? 180 : 320;
  const H = VERTICAL ? 320 : 180;
  cielo.width = W;
  cielo.height = H;
  const ctx = cielo.getContext('2d');

  // ---------- primitivas pixel ----------
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  function disco(cx, cy, r, color) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.6) color(x, y, cx + x, cy + y);
    }
  }
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const estrellas = Array.from({ length: 130 }, () => ({ x: azar() * W, y: azar() * H, f: azar() * 6.28, v: 1 + azar() * 3, b: azar() }));

  function dibujarEstrellas(t) {
    ctx.fillStyle = '#120e2b';
    ctx.fillRect(0, 0, W, H);
    for (const e of estrellas) {
      const brillo = Math.sin(t * e.v + e.f);
      if (brillo < -0.6) continue;
      px(e.x, e.y, e.b > 0.85 && brillo > 0.6 ? '#ffffff' : e.b > 0.5 ? '#9c93c9' : '#5a5290');
    }
  }

  // El Astropudú centrado en x, con la parte superior en y (pixeles del lienzo).
  function pintarPudu(pose, y0, escala = 1) {
    const g = grillaPudu(pose);
    const x0 = Math.round((W - g[0].length * escala) / 2);
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = PALETA[c];
      ctx.fillRect(x0 + x * escala, y0 + y * escala, escala, escala);
    }
  }

  // Texto superpuesto: posición en % y tamaño según el formato.
  const txt = (top, contenido, { tam, color = '#f3eefc', pix = false, extra = '' }) =>
    `<div class="v-abs${pix ? ' v-pix' : ''}" style="left:50%; top:${top}%; font-size:${tam}px; color:${color}; ${extra}">${contenido}</div>`;
  const D = (h, v) => (VERTICAL ? v : h); // valor para horizontal / vertical

  // ---------- escenas ----------
  const tierra = VERTICAL ? { x: 46, y: 262, r: 17 } : { x: 52, y: 118, r: 17 };
  const marte = VERTICAL ? { x: 136, y: 64, r: 11 } : { x: 270, y: 58, r: 11 };
  const control = VERTICAL ? { x: 170, y: 220 } : { x: 160, y: 8 };
  const bezier = (p) => ({
    x: (1 - p) ** 2 * tierra.x + 2 * (1 - p) * p * control.x + p * p * marte.x,
    y: (1 - p) ** 2 * tierra.y + 2 * (1 - p) * p * control.y + p * p * marte.y,
  });

  function escenaEspacio(t) {
    dibujarEstrellas(t);
    disco(tierra.x, tierra.y, tierra.r, (x, y, X, Y) => {
      const borde = x * x + y * y > (tierra.r - 1.5) ** 2;
      const tierraFirme = Math.sin(x * 0.45 + 1.3) + Math.cos(y * 0.5 - x * 0.2) > 0.9;
      px(X, Y, borde ? '#8fd3ff' : tierraFirme ? '#3fae5a' : '#2f6fd6');
    });
    disco(marte.x, marte.y, marte.r, (x, y, X, Y) => {
      const mancha = Math.sin(x * 0.9) + Math.cos(y * 0.8 + x * 0.3) > 1.1;
      px(X, Y, mancha ? '#8a3a22' : '#c8562e');
    });
    const avance = Math.min(1, t / 5.5);
    const p = 0.12 + 0.55 * (1 - (1 - avance) ** 2);
    for (let q = 0.1; q < 0.98; q += 0.022) {
      const b = bezier(q);
      px(b.x, b.y, q < p ? '#6d63b0' : '#3a3470');
    }
    const n = bezier(p);
    const nave = ['..W..', '.WWW.', 'WWBWW', 'WWWWW', '.G.G.'];
    nave.forEach((fila, j) => [...fila].forEach((c, i) => {
      if (c !== '.') px(n.x - 2 + i, n.y - 3 + j, { W: '#eadfce', B: '#4b4774', G: '#a99cad' }[c]);
    }));
    if (Math.floor(t * 12) % 2) { px(n.x - 1, n.y + 3, '#e8833a'); px(n.x + 1, n.y + 3, '#e8833a'); }
    if (t > 3) {
      const largo = Math.hypot(n.x - tierra.x, n.y - tierra.y);
      for (let d = 0; d < largo - tierra.r; d += 1) {
        const fase = (d - (t - 3) * 14) % 9;
        if (fase < 0 ? fase > -3 : fase < 3) continue;
        const k = d / largo;
        px(n.x + (tierra.x - n.x) * k, n.y + (tierra.y - n.y) * k, '#b9a6f0');
      }
    }
    return '';
  }

  function escenaTitulo(t) {
    dibujarEstrellas(t + 10);
    pintarPudu(poseDeEstado('contento', t * 1000), D(18, 58), D(1, 2));
    return txt(D(70, 54), 'PUDUHEALTH', { tam: D(46, 24), pix: true, extra: 'letter-spacing:2px' })
      + txt(D(80, 63), L('Comparado contigo mismo: a tiempo, privado, a bordo', 'Compared with yourself: early, private, on board'), { tam: D(30, 19), color: '#cfc6f2' })
      + txt(D(89, 72), L('con el Astropudú', 'with Astropudú'), { tam: D(16, 11), color: '#b9a6f0', pix: true });
  }

  function escenaValidacion(t) {
    dibujarEstrellas(t + 20);
    pintarPudu(poseDeEstado('despierto', t * 1000 + 500), D(6, 22), D(1, 2));
    const b = (v) => `<b style="color:#ffb84d">${v}</b>`;
    return txt(D(42, 44), L('PROBADO CON DATOS REALES', 'TESTED ON REAL DATA'), { tam: D(28, 15), pix: true })
      + txt(D(56, 54), L(`Modelo de estrés: ${b('AUC 0,93')} · 15 personas (WESAD)`, `Stress model: ${b('AUC 0.93')} · 15 people (WESAD)`), { tam: D(34, 18) })
      + txt(D(67, 63), L(`Falsas alarmas: ${b('21 % → 2,5 %')} · 14 personas (PMData)`, `False alarms: ${b('21 % → 2.5 %')} · 14 people (PMData)`), { tam: D(34, 18) })
      + txt(D(78, 72), L(`Pulso vs ECG en reposo: ${b('0,8 lpm')} de error mediano`, `Heart rate vs ECG at rest: ${b('0.8 bpm')} median error`), { tam: D(34, 18) });
  }

  function escenaCierre(t) {
    dibujarEstrellas(t + 30);
    pintarPudu(poseDeEstado('contento', t * 1000), D(10, 12), D(1, 2));
    const lema = VERTICAL
      ? L('AVISA SEMANAS<br>ANTES<br>PRIVADO · CIFRADO<br>A BORDO<br>CADA CONSEJO<br>CON SU FUENTE',
        'WEEKS BEFORE<br>THE LIMIT<br>PRIVATE · ENCRYPTED<br>ON BOARD<br>EVERY RECOMMENDATION<br>CITED')
      : L('AVISA SEMANAS ANTES<br>PRIVADO · CIFRADO · A BORDO<br>CADA CONSEJO CON SU FUENTE',
        'WEEKS BEFORE THE LIMIT<br>PRIVATE · ENCRYPTED · ON BOARD<br>EVERY RECOMMENDATION CITED');
    return txt(D(47, 53), lema, { tam: D(26, 13), pix: true, extra: `line-height:${D(1.9, 1.75)}; white-space:nowrap` })
      + txt(D(75, 70), L('NASA-STD-3001 · riesgos HRP · MSL RAD · OCHMO', 'NASA-STD-3001 · HRP risks · MSL RAD · OCHMO'), { tam: D(30, 15), color: '#cfc6f2' })
      + txt(D(88, 78), 'TECMEDHUB · NASA SPACE APPS 2026 · QUEMCHI, CHILE', { tam: D(18, 10), color: '#b9a6f0', pix: true });
  }

  // ---------- guion ----------
  // Los subtítulos siguen a la voz (video/narrar.py): cada uno sigue visible hasta 0,6 s después de
  // su frase, sin pisar la siguiente.
  const SUBTITULOS = (window.__NARRACION ?? [])
    .map((f, i, fr) => [f.inicio, Math.min(f.fin + 0.6, fr[i + 1]?.inicio ?? DURACION), f.texto, f.subtitulo])
    .filter((s) => s[3])
    .map(([a, b, texto]) => [a, b, texto]);

  const ESCENAS = [
    [0, 6, escenaEspacio],
    [6, 9, escenaTitulo],
    [25.6, 27.8, escenaValidacion],
    [27.8, 30.1, escenaCierre],
  ];

  const fijarDia = (d) => {
    const r = $('#dia');
    if (Number(r.value) === d) return;
    r.value = d;
    r.dispatchEvent(new Event('input'));
  };
  const clic = (s) => $(s)?.click();
  // Celular: cada sección es una vista deslizable; se salta sin animación.
  const irA = (id) => {
    if (!VERTICAL) { window.scrollTo(0, 0); return; }
    const v = $('#vistas');
    v.scrollLeft = v.clientWidth * ['vista-pudu', 'vista-hoy', 'vista-datos', 'vista-tendencias'].indexOf(id);
    v.dispatchEvent(new Event('scroll'));
    $(`#${id}`).scrollTop = 0;
  };

  const EVENTOS = [
    [0, () => { clic('[data-persona="P01"]'); fijarDia(100); irA('vista-pudu'); }],
    [5.0, () => { clic('#btn-medir'); clic('#med-prueba'); }],
    [12.5, () => $('#medicion').close()],
    [12.6, () => clic('#btn-registrar')],
    [13.3, () => clic('.celda[data-v="2"][data-a="1"]')],
    [13.8, () => clic('.kss[data-kss="3"]')],
    [14.3, () => clic('#registro-guardar')],
    [16.0, () => irA('vista-hoy')],
    [23.8, () => { clic('#clinica-ver'); irA('vista-hoy'); }],
  ];
  // En el celular, la vista Hoy baja hasta las alertas cuando aparecen.
  if (VERTICAL) EVENTOS.push([19.2, () => { const v = $('#vista-hoy'); v.scrollTop = $('#alertas').offsetTop - 120; }]);
  EVENTOS.sort((a, b) => a[0] - b[0]);

  const DIAS = [[16.0, 100], [17.0, 160], [19.0, 160], [20.4, 190], [21.4, 190], [22.2, 205]];
  function diaEn(t) {
    if (t <= DIAS[0][0]) return DIAS[0][1];
    for (let i = 1; i < DIAS.length; i++) {
      const [t1, d1] = DIAS[i];
      const [t0, d0] = DIAS[i - 1];
      if (t <= t1) return Math.round(d0 + ((d1 - d0) * (t - t0)) / (t1 - t0));
    }
    return DIAS.at(-1)[1];
  }

  let siguiente = 0;
  function cuadro(t) {
    while (siguiente < EVENTOS.length && EVENTOS[siguiente][0] <= t + 1e-6) EVENTOS[siguiente++][1]();
    if (t >= 16.0 && t <= 23.8) fijarDia(diaEn(t));

    // La escena y el subtítulo van en la capa superior (popover) y se vuelven a subir en cada
    // cuadro para quedar sobre los diálogos modales de la app.
    const alFrente = (el, visible) => {
      if (el.matches(':popover-open')) el.hidePopover();
      if (visible) el.showPopover();
    };
    const escena = ESCENAS.find(([a, b]) => t >= a && t < b);
    if (escena) $('#v-textos').innerHTML = escena[2](t - escena[0]);
    alFrente($('#v-capa'), Boolean(escena));

    const sub = SUBTITULOS.find(([a, b]) => t >= a && t < b);
    if (sub && $('#v-sub').textContent !== sub[2]) $('#v-sub').textContent = sub[2];
    alFrente($('#v-sub'), Boolean(sub));
  }

  window.__video = { DURACION, cuadro };
})();
