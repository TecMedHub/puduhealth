// Reloj virtual: se inyecta antes que los scripts de la página para grabar cuadro a cuadro.
// performance.now, Date.now, requestAnimationFrame, setTimeout y setInterval avanzan sólo cuando
// el grabador llama a __reloj.avanzar(ms), así la animación queda exacta a 30 fps aunque cada
// captura tarde más que un cuadro real.
(() => {
  let ahora = 0;
  const base = Date.now();
  const rafs = new Map();
  const timers = new Map();
  let id = 0;

  performance.now = () => ahora;
  Date.now = () => base + ahora;
  window.requestAnimationFrame = (cb) => { rafs.set(++id, cb); return id; };
  window.cancelAnimationFrame = (i) => rafs.delete(i);
  window.setTimeout = (fn, ms = 0, ...args) => { timers.set(++id, { fn, t: ahora + Math.max(0, ms), args }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => {
    const cada = Math.max(1, ms);
    timers.set(++id, { fn, t: ahora + cada, args, cada });
    return id;
  };
  window.clearTimeout = (i) => timers.delete(i);
  window.clearInterval = (i) => timers.delete(i);

  window.__reloj = {
    get ahora() { return ahora; },
    avanzar(hasta) {
      for (;;) {
        let prox = null;
        for (const [i, x] of timers) if (x.t <= hasta && (!prox || x.t < prox[1].t)) prox = [i, x];
        if (!prox) break;
        const [i, x] = prox;
        ahora = x.t;
        if (x.cada) x.t += x.cada; else timers.delete(i);
        try { if (typeof x.fn === 'function') x.fn(...x.args); } catch (e) { console.error(e); }
      }
      ahora = hasta;
      const cbs = [...rafs.values()];
      rafs.clear();
      for (const cb of cbs) { try { cb(ahora); } catch (e) { console.error(e); } }
    },
  };
})();
