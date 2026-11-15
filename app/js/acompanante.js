// Acompañante: Astropudú, un pudú astronauta en pixel art (48 × 48).
//
// Su estado depende SOLO de si hubo registro hoy y de hábitos medidos (sueño y ejercicio),
// nunca del contenido emocional de las respuestas.
//
// El dibujo se genera por código a partir de primitivas (elipses, rectángulos, trazos) sobre una
// grilla de baja resolución, con contorno oscuro automático. Para usar una hoja de sprites dibujada
// a mano, pasar `hoja` a crearAcompanante(): una fila por estado (en el orden de ESTADOS) y 2 cuadros
// por fila, cada cuadro de `tamCuadro` × `tamCuadro` píxeles.

export const ESTADOS = ['despierto', 'durmiendo', 'contento', 'ejercitandose'];
export const NOMBRE = 'Astropudú';

export function estadoAcompanante(estado, registradoHoy) {
  if (!registradoHoy) return 'durmiendo';
  const sueno = estado.variables?.sueno?.ultimo;
  const cumplimiento = estado.cumplimiento_resistencia_7d;
  if (sueno >= 7 && cumplimiento >= 0.8) return 'contento';
  return 'despierto';
}

// ---------- paleta ----------

export const TAM = 48;

export const PALETA = {
  X: '#1a1430', // contorno
  S: '#eadfce', // traje
  P: '#a99cad', // sombra y franjas del traje
  G: '#4a3d50', // guantes y botas
  g: '#2f2636', // suelas
  H: '#2b2b62', // vidrio del casco
  R: '#8d88c7', // borde del casco
  L: '#dcd8ff', // brillo del vidrio
  F: '#8b4a2b', // pelaje
  f: '#a8603a', // hocico
  E: '#d4813f', // orejas y mejillas
  e: '#6b3220', // interior de las orejas
  A: '#efe6d6', // astas
  K: '#120d14', // ojos y nariz
  W: '#ffffff', // brillo de los ojos
  B: '#4b4774', // panel del pecho
  O: '#e8833a', // luces del panel
  Z: '#b9a6f0', // efectos (Zzz, destellos)
  D: '#7fd3f7', // sudor
  s: '#140f26', // sombra en el suelo
};

// ---------- primitivas sobre la grilla ----------

const nueva = () => Array.from({ length: TAM }, () => Array(TAM).fill(null));
const espejoX = (x) => TAM - 1 - x;

function pix(g, x, y, c) {
  if (x >= 0 && y >= 0 && x < TAM && y < TAM) g[y][x] = c;
}

function rect(g, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pix(g, x, y, c);
}

function elipse(g, cx, cy, rx, ry, c, soloVacias = false) {
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!soloVacias || !g[y]?.[x])) pix(g, x, y, c);
    }
  }
}

// Elipse rotada en `ang` radianes (positivo = sentido horario en pantalla).
function elipseRotada(g, cx, cy, rx, ry, ang, c) {
  const r = Math.max(rx, ry);
  const co = Math.cos(ang);
  const se = Math.sin(ang);
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = (dx * co + dy * se) / rx;
      const v = (-dx * se + dy * co) / ry;
      if (u * u + v * v <= 1) pix(g, x, y, c);
    }
  }
}

// Anillo entre los radios r0 y r1; `angulos` limita a un arco (radianes, 0 = derecha, sentido horario).
function anillo(g, cx, cy, r0, r1, c, angulos = null) {
  for (let y = Math.floor(cy - r1) - 1; y <= Math.ceil(cy + r1) + 1; y++) {
    for (let x = Math.floor(cx - r1) - 1; x <= Math.ceil(cx + r1) + 1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d < r0 || d > r1) continue;
      if (angulos) {
        const a = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
        if (a < angulos[0] || a > angulos[1]) continue;
      }
      pix(g, x, y, c);
    }
  }
}

// Trazo grueso entre dos puntos (para brazos y piernas en diagonal).
function trazo(g, x0, y0, x1, y1, grosor, c) {
  const pasos = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) * 2;
  for (let i = 0; i <= pasos; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / pasos - grosor / 2);
    const y = Math.round(y0 + ((y1 - y0) * i) / pasos - grosor / 2);
    rect(g, x, y, x + grosor - 1, y + grosor - 1, c);
  }
}

function diamante(g, cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r) pix(g, cx + dx, cy + dy, c);
  }
}

// Contorno de 1 píxel alrededor de todo lo dibujado (estilo pixel art).
function contorno(g, c) {
  const antes = g.map((fila) => fila.slice());
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      if (antes[y][x]) continue;
      const vecino = antes[y - 1]?.[x] || antes[y + 1]?.[x] || antes[y][x - 1] || antes[y][x + 1];
      if (vecino) g[y][x] = c;
    }
  }
}

// ---------- el pudú ----------

// pose: { ojos: 'abiertos'|'cerrados'|'felices', brazos: 'abajo'|'arriba', piernas: 'juntas'|'abiertas',
//         sentado, salto (px hacia arriba, todo el cuerpo), respira (px, sólo el torso y la cabeza), efectos }
export function dibujarPudu({
  ojos = 'abiertos', brazos = 'abajo', piernas = 'juntas', sentado = false,
  salto = 0, respira = 0, efectos = [], fase = 0,
} = {}) {
  const g = nueva();
  const dy = -salto;
  const oy = dy + respira + (sentado ? 4 : 0);

  // Piernas y botas
  if (sentado) {
    rect(g, 17, 36 + dy, 22, 39 + dy, 'S');
    rect(g, 25, 36 + dy, 30, 39 + dy, 'S');
    rect(g, 15, 39 + dy, 22, 42 + dy, 'G');
    rect(g, 25, 39 + dy, 32, 42 + dy, 'G');
    rect(g, 15, 42 + dy, 22, 42 + dy, 'g');
    rect(g, 25, 42 + dy, 32, 42 + dy, 'g');
  } else if (piernas === 'abiertas') {
    trazo(g, 20, 35 + dy, 16, 39 + dy, 5, 'S');
    trazo(g, 27, 35 + dy, 31, 39 + dy, 5, 'S');
    rect(g, 12, 40 + dy, 18, 42 + dy, 'G');
    rect(g, 29, 40 + dy, 35, 42 + dy, 'G');
  } else {
    rect(g, 18, 35 + dy, 22, 39 + dy, 'S');
    rect(g, 25, 35 + dy, 29, 39 + dy, 'S');
    rect(g, 18, 37 + dy, 22, 37 + dy, 'P');
    rect(g, 25, 37 + dy, 29, 37 + dy, 'P');
    rect(g, 17, 40 + dy, 22, 42 + dy, 'G');
    rect(g, 25, 40 + dy, 30, 42 + dy, 'G');
    rect(g, 17, 42 + dy, 22, 42 + dy, 'g');
    rect(g, 25, 42 + dy, 30, 42 + dy, 'g');
  }

  // Torso con cinturón y panel del pecho
  rect(g, 16, 25 + oy, 31, 34 + oy, 'S');
  rect(g, 30, 26 + oy, 31, 34 + oy, 'P');
  rect(g, 16, 33 + oy, 31, 33 + oy, 'P');
  rect(g, 20, 27 + oy, 27, 31 + oy, 'B');
  pix(g, 21, 28 + oy, 'O');
  pix(g, 22, 30 + oy, 'O');
  pix(g, 25, 28 + oy, 'W');
  pix(g, 26, 30 + oy, 'O');

  // Brazos y guantes
  if (brazos === 'arriba') {
    trazo(g, 15, 27 + oy, 10, 17 + oy, 4, 'S');
    trazo(g, 32, 27 + oy, 37, 17 + oy, 4, 'S');
    rect(g, 7, 12 + oy, 10, 15 + oy, 'G');
    rect(g, 37, 12 + oy, 40, 15 + oy, 'G');
  } else {
    rect(g, 12, 25 + oy, 15, 32 + oy, 'S');
    rect(g, 32, 25 + oy, 35, 32 + oy, 'S');
    rect(g, 12, 28 + oy, 15, 28 + oy, 'P');
    rect(g, 32, 28 + oy, 35, 28 + oy, 'P');
    rect(g, 12, 33 + oy, 15, 35 + oy, 'G');
    rect(g, 32, 33 + oy, 35, 35 + oy, 'G');
  }

  // Cuello del traje
  rect(g, 18, 24 + oy, 29, 25 + oy, 'P');

  // Casco: vidrio, astas, orejas, cabeza, brillo y borde
  const cy = 14 + oy;
  elipse(g, 24, cy, 10.5, 10.5, 'H');
  // Astas cortas
  for (const [x, y] of [[21, 10], [21, 9], [21, 8], [20, 7]]) {
    pix(g, x, y + oy, 'A');
    pix(g, espejoX(x), y + oy, 'A');
  }
  // Orejas grandes y puntiagudas, inclinadas hacia afuera
  elipseRotada(g, 17.5, cy - 2.5, 2.4, 3.9, -0.55, 'E');
  elipseRotada(g, 30.5, cy - 2.5, 2.4, 3.9, 0.55, 'E');
  elipseRotada(g, 17.9, cy - 2.1, 1.1, 2.4, -0.55, 'e');
  elipseRotada(g, 30.1, cy - 2.1, 1.1, 2.4, 0.55, 'e');
  // Cabeza con hocico alargado
  elipse(g, 24, cy + 2.5, 6, 5.5, 'F');
  elipse(g, 24, cy + 6, 3, 2.6, 'f');
  pix(g, 19, cy + 3, 'E');
  pix(g, espejoX(19), cy + 3, 'E');
  rect(g, 23, cy + 6, 24, cy + 7, 'K');

  const yo = cy + 1;
  if (ojos === 'abiertos') {
    rect(g, 20, yo, 21, yo + 1, 'K');
    rect(g, 26, yo, 27, yo + 1, 'K');
    pix(g, 20, yo, 'W');
    pix(g, 26, yo, 'W');
  } else if (ojos === 'cerrados') {
    rect(g, 19, yo + 1, 21, yo + 1, 'K');
    rect(g, 26, yo + 1, 28, yo + 1, 'K');
  } else {
    for (const [x, y] of [[19, yo + 1], [20, yo], [21, yo + 1]]) {
      pix(g, x, y, 'K');
      pix(g, espejoX(x), y, 'K');
    }
  }

  anillo(g, 24, cy, 8, 9.3, 'L', [2.75, 3.45]);
  pix(g, 30, cy - 7, 'L');
  pix(g, 31, cy - 6, 'L');
  anillo(g, 24, cy, 10, 11, 'R');

  // Efectos
  if (efectos.includes('zzz')) {
    const z = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];
    const sube = fase % 3;
    for (const [x, y] of z) pix(g, 36 + x, 9 + oy - sube + y, 'Z');
    if (sube > 0) for (const [x, y] of z) pix(g, 41 + x, 3 + oy - sube + y, 'Z');
  }
  if (efectos.includes('destellos')) {
    const r = fase % 2 ? 2 : 1;
    diamante(g, 4, 20 + oy, r, 'Z');
    diamante(g, espejoX(4), 20 + oy, r, 'Z');
    diamante(g, 6, 30 + oy, 3 - r, 'Z');
    diamante(g, espejoX(6), 30 + oy, 3 - r, 'Z');
    rect(g, 24, 0 + oy, 24, 1 + oy, 'Z');
    pix(g, 19, 2 + oy, 'Z');
    pix(g, espejoX(19), 2 + oy, 'Z');
  }
  if (efectos.includes('sudor')) {
    pix(g, 38, 8 + oy, 'D');
    rect(g, 38, 9 + oy, 39, 10 + oy, 'D');
  }

  contorno(g, 'X');
  elipse(g, 24, 44.5, 10, 1.6, 's', true);
  return g;
}

// Pose de cada estado en el instante t (ms).
export function poseDeEstado(estado, t) {
  switch (estado) {
    case 'durmiendo':
      return { sentado: true, ojos: 'cerrados', respira: Math.floor(t / 1200) % 2, efectos: ['zzz'], fase: Math.floor(t / 700) };
    case 'contento':
      return { brazos: 'arriba', ojos: 'felices', salto: Math.floor(t / 400) % 2, efectos: ['destellos'], fase: Math.floor(t / 300) };
    case 'ejercitandose': {
      const arriba = Math.floor(t / 250) % 2 === 1;
      return arriba
        ? { brazos: 'arriba', piernas: 'abiertas', ojos: 'felices', salto: 2, efectos: ['sudor'] }
        : { ojos: 'abiertos', efectos: ['sudor'] };
    }
    default:
      return { ojos: t % 3200 < 160 ? 'cerrados' : 'abiertos', respira: Math.floor(t / 900) % 2 };
  }
}

// ---------- animación ----------

const memoria = new Map();
function grillaDe(pose) {
  const clave = JSON.stringify(pose);
  if (!memoria.has(clave)) memoria.set(clave, dibujarPudu(pose));
  return memoria.get(clave);
}

function pintar(ctx, g) {
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = PALETA[c];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function crearAcompanante(canvas, { hoja = null, tamCuadro = TAM } = {}) {
  const ctx = canvas.getContext('2d');
  let estado = 'despierto';
  let imagen = null;
  let temporal = null;

  if (hoja) {
    const img = new Image();
    img.onload = () => { imagen = img; };
    img.src = hoja;
  }

  canvas.width = TAM;
  canvas.height = TAM;
  ctx.imageSmoothingEnabled = false;

  let id = 0;
  const cuadro = (t) => {
    const actual = temporal && t < temporal.hasta ? temporal.estado : estado;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imagen) {
      if (canvas.width !== tamCuadro) canvas.width = canvas.height = tamCuadro;
      const fila = ESTADOS.indexOf(actual);
      const col = Math.floor(t / 400) % 2;
      ctx.drawImage(imagen, col * tamCuadro, fila * tamCuadro, tamCuadro, tamCuadro, 0, 0, tamCuadro, tamCuadro);
    } else {
      pintar(ctx, grillaDe(poseDeEstado(actual, t)));
    }
    id = requestAnimationFrame(cuadro);
  };
  id = requestAnimationFrame(cuadro);

  return {
    fijarEstado(e) { estado = e; },
    // Muestra un estado por unos segundos (p. ej. al tocar al acompañante).
    mostrar(e, ms = 2500) { temporal = { estado: e, hasta: performance.now() + ms }; },
    detener() { cancelAnimationFrame(id); },
  };
}
