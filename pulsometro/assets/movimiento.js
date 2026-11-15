/*
 * Detección de movimiento con el acelerómetro del celular durante una medición PPG.
 * La usan la medición del pulsómetro (app.js) y la de la app de salud (app/js/medicion.js).
 *
 * Por qué: el PPG con cámara no es confiable en movimiento, y un movimiento periódico
 * (p. ej. el braceo al trotar) puede verse como un pulso limpio y engañar a la calidad de señal.
 *
 * Aceleración sin gravedad (m/s²): `acceleration` si el equipo la entrega; si no, se estima
 * restando la gravedad (filtro paso bajo) a `accelerationIncludingGravity`.
 * Movimiento: RMS de la magnitud en el último segundo > UMBRAL_RMS.
 */
'use strict';

const Movimiento = (() => {
  const UMBRAL_RMS = 0.5;   // m/s²; quieto con el celular en la mano ≈ 0,05–0,2
  const VENTANA_S = 1;
  const ALFA_GRAVEDAD = 0.1;

  let muestras = [];        // { t (s), a (m/s²) }
  let gravedad = null;
  let manejador = null;
  let recibidas = 0;

  const ahoraS = () => performance.now() / 1000;

  // Agrega una lectura. `lineal` = aceleración sin gravedad; si falta, se usa `conGravedad`.
  function agregar(t, lineal, conGravedad) {
    let x, y, z;
    if (lineal && lineal.x != null && lineal.y != null && lineal.z != null) {
      ({ x, y, z } = lineal);
    } else if (conGravedad && conGravedad.x != null) {
      if (!gravedad) gravedad = { ...conGravedad };
      for (const k of ['x', 'y', 'z']) gravedad[k] += ALFA_GRAVEDAD * (conGravedad[k] - gravedad[k]);
      x = conGravedad.x - gravedad.x;
      y = conGravedad.y - gravedad.y;
      z = conGravedad.z - gravedad.z;
    } else {
      return;
    }
    recibidas++;
    muestras.push({ t, a: Math.sqrt(x * x + y * y + z * z) });
    while (muestras.length && muestras[0].t < t - 5) muestras.shift();
  }

  // Pide permiso (iOS lo exige y debe llamarse desde un toque del usuario) y empieza a escuchar.
  async function iniciar() {
    detener();
    if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
    }
    manejador = (e) => agregar(ahoraS(), e.acceleration, e.accelerationIncludingGravity);
    window.addEventListener('devicemotion', manejador);
    return true;
  }

  function detener() {
    if (manejador) window.removeEventListener('devicemotion', manejador);
    manejador = null;
    muestras = [];
    gravedad = null;
    recibidas = 0;
  }

  // RMS de la aceleración en el último segundo; null si no hay datos recientes.
  function rmsReciente(t = ahoraS()) {
    const v = muestras.filter((m) => m.t > t - VENTANA_S && m.t <= t);
    if (v.length < 3) return null;
    return Math.sqrt(v.reduce((s, m) => s + m.a * m.a, 0) / v.length);
  }

  const disponible = () => recibidas > 0;
  const enMovimiento = (t) => {
    const r = rmsReciente(t);
    return r !== null && r > UMBRAL_RMS;
  };

  return { UMBRAL_RMS, agregar, iniciar, detener, rmsReciente, enMovimiento, disponible };
})();

if (typeof module !== 'undefined') module.exports = Movimiento;
