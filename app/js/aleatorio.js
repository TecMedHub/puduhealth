// Generador pseudoaleatorio con semilla: misma semilla, mismos datos.
// mulberry32 sobre un hash FNV-1a de la semilla (acepta texto o número).

function hashSemilla(semilla) {
  let h = 2166136261;
  for (const c of String(semilla)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function crearRng(semilla) {
  let s = hashSemilla(semilla);

  const uniforme = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let guardada = null;
  const normal = (media = 0, de = 1) => {
    if (guardada !== null) {
      const z = guardada;
      guardada = null;
      return media + de * z;
    }
    let u = 0;
    while (u === 0) u = uniforme();
    const v = uniforme();
    const r = Math.sqrt(-2 * Math.log(u));
    guardada = r * Math.sin(2 * Math.PI * v);
    return media + de * r * Math.cos(2 * Math.PI * v);
  };

  const entero = (min, max) => min + Math.floor(uniforme() * (max - min + 1));
  const rango = (min, max) => min + uniforme() * (max - min);
  const prob = (p) => uniforme() < p;

  return { uniforme, normal, entero, rango, prob };
}

export const limitar = (x, min, max) => Math.min(max, Math.max(min, x));
