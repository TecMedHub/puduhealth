/*
 * Gráfico de líneas mínimo sobre <canvas>, sin librerías externas
 * (así funciona sin internet durante la hackatón).
 *
 * g.dibujar({
 *   series: [{ x: [...], y: [...], color, ancho, puntos }],
 *   marcas: [{ x, y, color }],
 *   xMin, xMax, yMin, yMax,      // opcionales: si faltan se calculan
 *   formatoX: (v) => '...',      // opcional
 *   pasoMinX: 1,                 // separación mínima entre marcas del eje X
 *   titulo: 'texto en la esquina'
 * })
 */
'use strict';

class Grafico {
  constructor(canvas, opc = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opc = opc;
    this.datos = null;
    if ('ResizeObserver' in window) new ResizeObserver(() => this.render()).observe(canvas);
  }

  static color(nombre, defecto) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return v || defecto;
  }

  static paso(rango, n) {
    const bruto = rango / Math.max(1, n);
    const mag = 10 ** Math.floor(Math.log10(bruto));
    const r = bruto / mag;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
  }

  static fmt(v, paso) {
    const dec = Math.min(3, Math.max(0, -Math.floor(Math.log10(paso))));
    return (Math.abs(v) < paso * 1e-6 ? 0 : v).toFixed(dec);
  }

  dibujar(datos) {
    this.datos = datos;
    this.render();
  }

  render() {
    const c = this.canvas, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const colTexto = Grafico.color('--tenue', '#8b98b8');
    const colGrid = Grafico.color('--grid', 'rgba(255,255,255,.08)');
    const m = { l: 46, r: 10, t: 10, b: 22 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const d = this.datos;
    ctx.font = '11px system-ui, sans-serif';

    const hayDatos = d && d.series && d.series.some((s) => s.x && s.x.length > 1);
    if (!hayDatos) {
      ctx.fillStyle = colTexto;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((d && d.vacio) || this.opc.vacio || 'Sin datos', W / 2, H / 2);
      return;
    }

    // --- rangos ---
    let xMin = d.xMin, xMax = d.xMax;
    if (xMin == null || xMax == null) {
      let lo = Infinity, hi = -Infinity;
      for (const s of d.series) for (const x of s.x) { if (x < lo) lo = x; if (x > hi) hi = x; }
      xMin = xMin ?? lo;
      xMax = xMax ?? hi;
    }
    if (!(xMax > xMin)) xMax = xMin + 1;

    let yMin = d.yMin, yMax = d.yMax;
    if (yMin == null || yMax == null) {
      let lo = Infinity, hi = -Infinity;
      for (const s of d.series) {
        for (let i = 0; i < s.x.length; i++) {
          const x = s.x[i], y = s.y[i];
          if (x < xMin || x > xMax || y == null || !isFinite(y)) continue;
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
      const pad = (hi - lo) * 0.08;
      yMin = yMin ?? lo - pad;
      yMax = yMax ?? hi + pad;
    }

    const X = (x) => m.l + ((x - xMin) / (xMax - xMin)) * pw;
    const Y = (y) => m.t + (1 - (y - yMin) / (yMax - yMin)) * ph;

    // --- grilla y ejes ---
    ctx.strokeStyle = colGrid;
    ctx.fillStyle = colTexto;
    ctx.lineWidth = 1;

    const py = Grafico.paso(yMax - yMin, Math.max(2, Math.floor(ph / 40)));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let k = Math.ceil(yMin / py); k * py <= yMax + 1e-9; k++) {
      const yy = Math.round(Y(k * py)) + 0.5;
      ctx.beginPath(); ctx.moveTo(m.l, yy); ctx.lineTo(m.l + pw, yy); ctx.stroke();
      ctx.fillText(Grafico.fmt(k * py, py), m.l - 6, yy);
    }

    const px = Math.max(d.pasoMinX || 0, Grafico.paso(xMax - xMin, Math.max(2, Math.floor(pw / 70))));
    const fx = d.formatoX || ((v) => Grafico.fmt(v, px));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let k = Math.ceil(xMin / px); k * px <= xMax + 1e-9; k++) {
      const xx = Math.round(X(k * px)) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, m.t); ctx.lineTo(xx, m.t + ph); ctx.stroke();
      ctx.fillText(fx(k * px), xx, m.t + ph + 5);
    }

    // --- series ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(m.l, m.t, pw, ph);
    ctx.clip();
    ctx.lineJoin = 'round';
    for (const s of d.series) {
      const col = s.color || Grafico.color('--acento', '#4fc3f7');
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = s.ancho || 1.6;
      ctx.beginPath();
      let mover = true;
      for (let i = 0; i < s.x.length; i++) {
        const y = s.y[i];
        if (y == null || !isFinite(y)) { mover = true; continue; }
        const xx = X(s.x[i]), yy = Y(y);
        if (mover) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        mover = false;
      }
      ctx.stroke();
      if (s.puntos) {
        for (let i = 0; i < s.x.length; i++) {
          if (s.y[i] == null) continue;
          ctx.beginPath();
          ctx.arc(X(s.x[i]), Y(s.y[i]), 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (const mk of d.marcas || []) {
      ctx.fillStyle = mk.color || Grafico.color('--ambar', '#ffb84d');
      ctx.beginPath();
      ctx.arc(X(mk.x), Y(mk.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (d.titulo) {
      ctx.fillStyle = colTexto;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(d.titulo, m.l + 6, m.t + 4);
    }
  }
}
