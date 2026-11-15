// Piezas de interfaz genéricas: hoja inferior, avisos breves y vibración.

export const pantallaAncha = () => matchMedia('(min-width: 900px)').matches;

// Vibración corta al confirmar una acción (si el equipo la tiene).
export const vibrar = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* sin vibración */ } };

// Hoja que sube desde abajo en el celular (en pantallas anchas, panel lateral; ver CSS).
// Se cierra con el fondo, con Escape o arrastrando hacia abajo desde el tirador.
export function crearHoja(hoja, fondo) {
  let abierta = false;
  let origen = null;

  const abrir = () => {
    if (abierta) return;
    abierta = true;
    fondo.hidden = false;
    hoja.classList.add('abierta');
    hoja.setAttribute('role', 'dialog');
    hoja.setAttribute('aria-modal', 'true');
    hoja.scrollTop = 0;
    hoja.querySelector('button, input, select')?.focus({ preventScroll: true });
  };
  const cerrar = () => {
    if (!abierta) return;
    abierta = false;
    fondo.hidden = true;
    hoja.classList.remove('abierta');
    hoja.style.transform = '';
    hoja.removeAttribute('role');
    hoja.removeAttribute('aria-modal');
  };

  fondo.addEventListener('click', cerrar);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && abierta) cerrar(); });

  hoja.addEventListener('pointerdown', (ev) => {
    if (!abierta || hoja.scrollTop > 0 || !ev.target.closest('.tirador, .demo-cabeza')) return;
    origen = { y: ev.clientY, id: ev.pointerId };
    hoja.setPointerCapture(ev.pointerId);
    hoja.style.transition = 'none';
  });
  hoja.addEventListener('pointermove', (ev) => {
    if (!origen || ev.pointerId !== origen.id) return;
    hoja.style.transform = `translateY(${Math.max(0, ev.clientY - origen.y)}px)`;
  });
  const soltar = (ev) => {
    if (!origen || ev.pointerId !== origen.id) return;
    const dy = ev.clientY - origen.y;
    origen = null;
    hoja.style.transition = '';
    hoja.style.transform = '';
    if (dy > 80) cerrar();
  };
  hoja.addEventListener('pointerup', soltar);
  hoja.addEventListener('pointercancel', soltar);

  return { abrir, cerrar, get abierta() { return abierta; } };
}

// Aviso breve sobre la barra inferior. `accion` agrega un botón (p. ej. "Actualizar").
export function aviso(texto, { accion = null, alAccionar = null, ms = 3200 } = {}) {
  const caja = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.append(Object.assign(document.createElement('span'), { textContent: texto }));
  const quitar = () => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 300);
  };
  if (accion) {
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: accion });
    b.addEventListener('click', () => { quitar(); alAccionar?.(); });
    el.append(b);
  }
  caja.append(el);
  while (caja.children.length > 2) caja.firstElementChild.remove();
  if (!accion) setTimeout(quitar, ms);
  return quitar;
}

// Diálogos (registro, explicaciones, conectar sensor…): se abren como paneles fijos normales con un
// velo propio, igual que la hoja del modo demo. El modo modal del navegador (showModal) dejaba la
// hoja fuera de la pantalla en Safari del iPhone.
const abiertos = [];
const velo = () => document.getElementById('velo-dialogo');

export function abrirDialogo(d) {
  if (d.open) return;
  d.show();
  abiertos.push(d);
  velo().hidden = false;
  d.querySelector('.hoja-scroll, form')?.scrollTo?.(0, 0);
  d.querySelector('input:not([hidden]), button, [href]')?.focus({ preventScroll: true });
}

document.addEventListener('close', (ev) => {
  const i = abiertos.indexOf(ev.target);
  if (i >= 0) abiertos.splice(i, 1);
  if (!abiertos.length && velo()) velo().hidden = true;
}, true);
document.addEventListener('click', (ev) => {
  if (ev.target === velo()) abiertos.at(-1)?.close();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && abiertos.length) abiertos.at(-1).close();
});
