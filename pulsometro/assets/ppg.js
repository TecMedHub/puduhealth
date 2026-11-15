/*
 * Procesamiento de señal PPG (fotopletismografía) con la cámara del celular.
 * Lo usan tanto la medición en vivo (app.js) como el visor de registros (visor.js).
 *
 * Cadena: remuestreo a 30 Hz -> quitar tendencia -> invertir -> pasabanda
 * 0,7–3,5 Hz (Butterworth orden 2, ida y vuelta) -> normalizar -> picos + espectro.
 */
'use strict';

const PPG = (() => {
  const FS = 30;        // frecuencia de remuestreo (Hz)
  const F_BAJA = 0.7;   // 42 lpm
  const F_ALTA = 3.5;   // 210 lpm
  const BPM_MIN = 42;
  const BPM_MAX = 210;

  // ---------- utilidades ----------
  const media = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const desv = (a) => {
    const m = media(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  };
  const mediana = (a) => {
    const o = Array.from(a).sort((x, y) => x - y);
    const k = o.length >> 1;
    return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
  };
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- 1. remuestreo a frecuencia fija ----------
  // Los cuadros de la cámara no llegan a intervalos exactos: se interpola linealmente.
  function remuestrear(t, v, fs = FS) {
    const n = t.length;
    if (n < 2) return { t: new Float64Array(0), v: new Float64Array(0) };
    const t0 = t[0];
    const m = Math.floor((t[n - 1] - t0) * fs) + 1;
    const tt = new Float64Array(m);
    const vv = new Float64Array(m);
    let j = 0;
    for (let i = 0; i < m; i++) {
      const ti = t0 + i / fs;
      while (j < n - 2 && t[j + 1] <= ti) j++;
      const dt = t[j + 1] - t[j];
      const a = dt > 0 ? limitar((ti - t[j]) / dt, 0, 1) : 0;
      tt[i] = ti;
      vv[i] = v[j] + a * (v[j + 1] - v[j]);
    }
    return { t: tt, v: vv };
  }

  // ---------- 2. quitar tendencia lineal ----------
  function quitarTendencia(x) {
    const n = x.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += x[i]; sxx += i * i; sxy += i * x[i]; }
    const d = n * sxx - sx * sx;
    const m = d ? (n * sxy - sx * sy) / d : 0;
    const b = (sy - m * sx) / n;
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = x[i] - (m * i + b);
    return y;
  }

  // ---------- 3. filtro pasabanda ----------
  // Biquad Butterworth de orden 2 (fórmulas del "Audio EQ Cookbook", Q = 1/√2).
  function biquad(tipo, f0, fs) {
    const w0 = (2 * Math.PI * f0) / fs;
    const c = Math.cos(w0);
    const alfa = Math.sin(w0) / (2 * Math.SQRT1_2);
    const b = tipo === 'paso-bajo'
      ? [(1 - c) / 2, 1 - c, (1 - c) / 2]
      : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    const a0 = 1 + alfa;
    return { b: b.map((v) => v / a0), a: [(-2 * c) / a0, (1 - alfa) / a0] };
  }

  function aplicarBiquad(x, f) {
    const y = new Float64Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const x0 = x[i];
      const y0 = f.b[0] * x0 + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      y[i] = y0;
    }
    return y;
  }

  const alReves = (x) => Float64Array.from(x).reverse();

  // Filtrado ida y vuelta (como scipy.signal.filtfilt): sin desfase, así los picos
  // quedan en su lugar real. Se extienden los bordes por reflexión para evitar transitorios.
  function pasabanda(x, fs = FS, fBaja = F_BAJA, fAlta = F_ALTA) {
    const n = x.length;
    if (n < 4) return new Float64Array(n);
    const pad = Math.min(n - 1, Math.round(3 * fs));
    const ext = new Float64Array(n + 2 * pad);
    for (let i = 0; i < pad; i++) ext[i] = 2 * x[0] - x[pad - i];
    ext.set(x, pad);
    for (let i = 0; i < pad; i++) ext[pad + n + i] = 2 * x[n - 1] - x[n - 2 - i];

    const pa = biquad('paso-alto', fBaja, fs);
    const pb = biquad('paso-bajo', fAlta, fs);
    const ida = (s) => aplicarBiquad(aplicarBiquad(s, pa), pb);
    const y = alReves(ida(alReves(ida(ext))));
    return y.slice(pad, pad + n);
  }

  function normalizar(x) {
    const m = media(x);
    const s = desv(x) || 1;
    return x.map((v) => (v - m) / s);
  }

  // ---------- 4a. dominio del tiempo: picos ----------
  // Máximos locales separados al menos `distMin` s (por defecto 60/BPM_MAX);
  // se eligen primero los más altos.
  function detectarPicos(x, fs = FS, distMin = 60 / BPM_MAX) {
    const dist = Math.max(1, Math.floor(fs * distMin));
    const cand = [];
    for (let i = 1; i < x.length - 1; i++) {
      if (x[i] > x[i - 1] && x[i] >= x[i + 1] && x[i] > 0) cand.push(i);
    }
    cand.sort((a, b) => x[b] - x[a]);
    const elegidos = [];
    for (const i of cand) {
      if (elegidos.every((j) => Math.abs(i - j) >= dist)) elegidos.push(i);
    }
    if (!elegidos.length) return [];
    // descartar picos muy bajos (muesca dícrota, ruido)
    const altura = mediana(elegidos.map((i) => x[i]));
    return elegidos.filter((i) => x[i] >= 0.35 * altura).sort((a, b) => a - b);
  }

  // Interpolación parabólica: posición del pico con precisión menor a una muestra.
  function refinar(x, i) {
    if (i <= 0 || i >= x.length - 1) return i;
    const a = x[i - 1], b = x[i], c = x[i + 1];
    const d = a - 2 * b + c;
    return d !== 0 ? i + (0.5 * (a - c)) / d : i;
  }

  // ---------- 4b. dominio de la frecuencia ----------
  // DFT con ventana de Hann evaluada sólo en la banda de interés (paso 0,01 Hz).
  function espectro(x, fs = FS, fMin = F_BAJA, fMax = F_ALTA, paso = 0.01) {
    const n = x.length;
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) w[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
    const f = [];
    const p = [];
    const pasos = Math.round((fMax - fMin) / paso);
    for (let k = 0; k <= pasos; k++) {
      const fr = fMin + k * paso;
      const om = (2 * Math.PI * fr) / fs;
      // rotación incremental en vez de sin/cos en cada muestra
      const cr = Math.cos(om), sr = Math.sin(om);
      let c = 1, s = 0, re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        re += w[i] * c;
        im -= w[i] * s;
        const c2 = c * cr - s * sr;
        s = s * cr + c * sr;
        c = c2;
      }
      f.push(fr);
      p.push((re * re + im * im) / n);
    }
    return { f, p };
  }

  // Índice del pico dominante, corrigiendo armónicos: con FC baja (p. ej. 50 lpm) el
  // 2.º o 3.er armónico puede superar a la fundamental. Si en f/2 o f/3 hay un pico
  // con al menos 40 % de la potencia máxima, la fundamental es ese.
  function picoFundamental(esp) {
    const { f, p } = esp;
    let iMax = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[iMax]) iMax = i;
    for (const div of [3, 2]) {
      const objetivo = f[iMax] / div;
      if (objetivo < f[0]) continue;
      let mejor = -1;
      for (let i = 0; i < p.length - 1; i++) {
        const esPico = (i === 0 || p[i] >= p[i - 1]) && p[i] >= p[i + 1];
        if (esPico && Math.abs(f[i] - objetivo) <= 0.08 && (mejor < 0 || p[i] > p[mejor])) mejor = i;
      }
      if (mejor >= 0 && p[mejor] >= 0.4 * p[iMax]) return mejor;
    }
    return iMax;
  }

  // ---------- 5. calidad de la señal ----------
  // Fórmula, umbrales y limitaciones documentados en README.md ("Cómo se calcula la calidad").
  function calidad(concentracion, bpmTiempo, bpmFrec, ibis) {
    if (bpmTiempo == null || ibis.length < 2) {
      return { puntaje: 0, etiqueta: 'Sin pulso', dif: null, cv: null };
    }
    const dif = Math.abs(bpmTiempo - bpmFrec);
    const v = ibis.map((i) => i.v);
    const cv = desv(v) / media(v);
    const s1 = limitar((concentracion - 0.1) / 0.4, 0, 1);   // espectro periódico
    const s2 = limitar(1 - (dif - 3) / 10, 0, 1);            // ambos métodos coinciden
    const s3 = limitar(1 - (cv - 0.08) / 0.2, 0, 1);         // latidos regulares
    const puntaje = Math.round(100 * (0.4 * s1 + 0.3 * s2 + 0.3 * s3));
    const etiqueta = puntaje >= 70 ? 'Buena' : puntaje >= 40 ? 'Regular' : 'Mala';
    return { puntaje, etiqueta, dif, cv };
  }

  // ---------- análisis completo ----------
  // t: tiempos en segundos, r: promedio del canal rojo de cada cuadro.
  function analizar(t, r, fs = FS) {
    const rs = remuestrear(t, r, fs);
    const n = rs.v.length;
    if (n < fs * 4) return null; // se necesitan al menos 4 s

    // Con cada latido entra más sangre y la imagen se oscurece: se invierte la señal
    // para que el pulso apunte hacia arriba.
    const inv = quitarTendencia(rs.v).map((v) => -v);
    const filtrado = normalizar(pasabanda(inv, fs));

    // Primero el espectro: su estimación ayuda a no contar picos falsos.
    const esp = espectro(filtrado, fs);
    const iMax = picoFundamental(esp);
    const bpmFrec = esp.f[iMax] * 60;
    // Periodicidad: fracción de la potencia que cae en la fundamental y sus armónicos
    // (±0,15 Hz), descontando la fracción que caería ahí si fuera sólo ruido blanco.
    // 1 = pulso limpio, 0 = ruido.
    let total = 0, cerca = 0, binsCerca = 0;
    const f0 = esp.f[iMax];
    for (let i = 0; i < esp.p.length; i++) {
      total += esp.p[i];
      const k = Math.max(1, Math.round(esp.f[i] / f0));
      if (Math.abs(esp.f[i] - k * f0) <= 0.15) { cerca += esp.p[i]; binsCerca++; }
    }
    const fracRuido = binsCerca / esp.p.length;
    const concentracion = total > 0 && fracRuido < 1
      ? limitar((cerca / total - fracRuido) / (1 - fracRuido), 0, 1)
      : 0;

    // Si el espectro tiene un pico claro, los latidos no pueden estar más juntos
    // que ~55 % del período estimado (evita contar ruido o la muesca dícrota).
    const distMin = concentracion > 0.25
      ? Math.max(60 / BPM_MAX, (0.55 * 60) / bpmFrec)
      : 60 / BPM_MAX;
    // Los bordes del filtrado son poco confiables: se ignoran picos en los primeros/últimos 0,25 s.
    const borde = Math.round(0.25 * fs);
    const picos = detectarPicos(filtrado, fs, distMin).filter((i) => i >= borde && i < n - borde);
    const tPicos = picos.map((i) => rs.t[0] + refinar(filtrado, i) / fs);

    const ibis = [];
    for (let k = 1; k < tPicos.length; k++) {
      const d = tPicos[k] - tPicos[k - 1];
      if (d >= 60 / BPM_MAX && d <= 60 / BPM_MIN) ibis.push({ k, t: tPicos[k], v: d });
    }
    const medIbi = ibis.length >= 2 ? mediana(ibis.map((i) => i.v)) : null;
    const bpmTiempo = medIbi ? 60 / medIbi : null;

    const cal = calidad(concentracion, bpmTiempo, bpmFrec, ibis);
    let bpm = null;
    if (bpmTiempo != null) bpm = cal.dif <= 5 ? (bpmTiempo + bpmFrec) / 2 : bpmTiempo;

    // Variabilidad (VFC): sólo intervalos consecutivos y cercanos a la mediana
    const limpios = medIbi ? ibis.filter((i) => Math.abs(i.v - medIbi) <= 0.25 * medIbi) : [];
    let suma = 0, nDif = 0;
    for (let i = 1; i < limpios.length; i++) {
      if (limpios[i].k === limpios[i - 1].k + 1) {
        suma += ((limpios[i].v - limpios[i - 1].v) * 1000) ** 2;
        nDif++;
      }
    }
    const rmssd = nDif >= 2 ? Math.sqrt(suma / nDif) : null;
    const sdnn = limpios.length >= 3 ? desv(limpios.map((i) => i.v)) * 1000 : null;

    return {
      fs, t: rs.t, filtrado, picos, tPicos, ibis,
      bpmTiempo, bpmFrec, bpm, espectro: esp, concentracion,
      calidad: cal, rmssd, sdnn, latidos: picos.length,
      duracion: rs.t[n - 1] - rs.t[0],
    };
  }

  // ---------- comprobaciones del dedo ----------
  // Con el dedo sobre la cámara y la linterna encendida: rojo alto, verde y azul bajos.
  const dedoPresente = (r, g, b) => r > 60 && g < 0.7 * r && b < 0.7 * r;
  const saturado = (r) => r >= 250;

  // Tramo continuo más largo con el dedo puesto (índices [desde, hasta)).
  function segmentoConDedo(r, g, b) {
    let mejor = [0, 0], ini = -1;
    for (let i = 0; i <= r.length; i++) {
      const ok = i < r.length && dedoPresente(r[i], g[i], b[i]);
      if (ok && ini < 0) ini = i;
      if (!ok && ini >= 0) {
        if (i - ini > mejor[1] - mejor[0]) mejor = [ini, i];
        ini = -1;
      }
    }
    return mejor;
  }

  return {
    FS, F_BAJA, F_ALTA, media, mediana, desv,
    remuestrear, quitarTendencia, pasabanda, normalizar,
    detectarPicos, espectro, analizar, dedoPresente, saturado, segmentoConDedo,
  };
})();

if (typeof module !== 'undefined') module.exports = PPG;
