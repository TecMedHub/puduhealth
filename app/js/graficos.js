// Gráfico de tendencia en SVG: valores, rango personal (media ± 2 DE) y umbrales.

const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

export function mediaMovil(serie, n) {
  let suma = 0;
  return serie.map((p, i) => {
    suma += p.valor;
    if (i >= n) suma -= serie[i - n].valor;
    return { dia: p.dia, valor: suma / Math.min(i + 1, n) };
  });
}

// suavizado: ventana de la media móvil (1 = sin suavizar; el dato crudo queda tenue detrás).
export function graficoTendencia({ serie, base, umbrales = [], suavizado = 1, ancho = 320, alto = 120 }) {
  if (!serie.length) return '<svg class="grafico" aria-hidden="true"></svg>';

  const m = { izq: 34, der: 8, sup: 8, inf: 18 };
  const banda = base ? [base.media - 2 * base.de, base.media + 2 * base.de] : [];
  const ys = [...serie.map((p) => p.valor), ...banda, ...umbrales.map((u) => u.valor)];
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const pad = (yMax - yMin || 1) * 0.1;
  yMin -= pad;
  yMax += pad;

  const dMin = serie[0].dia;
  const dMax = Math.max(serie.at(-1).dia, dMin + 1);
  const x = (d) => m.izq + ((d - dMin) / (dMax - dMin)) * (ancho - m.izq - m.der);
  const y = (v) => m.sup + (1 - (v - yMin) / (yMax - yMin)) * (alto - m.sup - m.inf);

  const partes = [];
  if (base) {
    partes.push(`<rect class="g-banda" x="${m.izq}" y="${y(banda[1])}" width="${ancho - m.izq - m.der}" height="${y(banda[0]) - y(banda[1])}"/>`);
    partes.push(`<line class="g-media" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(base.media)}" y2="${y(base.media)}"/>`);
  }
  if (dMin < 0) {
    partes.push(`<line class="g-despegue" x1="${x(0)}" x2="${x(0)}" y1="${m.sup}" y2="${alto - m.inf}"/>`);
  }
  for (const u of umbrales) {
    partes.push(`<line class="g-umbral" x1="${m.izq}" x2="${ancho - m.der}" y1="${y(u.valor)}" y2="${y(u.valor)}"/>`);
    partes.push(`<text class="g-umbral-txt" x="${ancho - m.der - 2}" y="${y(u.valor) - 3}" text-anchor="end">${u.etiqueta}</text>`);
  }
  const linea = (pts, clase) =>
    `<polyline class="${clase}" points="${pts.map((p) => `${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}"/>`;
  if (suavizado > 1) {
    partes.push(linea(serie, 'g-crudo'));
    partes.push(linea(mediaMovil(serie, suavizado), 'g-linea'));
  } else {
    partes.push(linea(serie, 'g-linea'));
  }
  const u = serie.at(-1);
  partes.push(`<circle class="g-punto" cx="${x(u.dia)}" cy="${y(u.valor)}" r="3"/>`);
  partes.push(`<text class="g-eje" x="${m.izq - 4}" y="${y(yMax - pad) + 4}" text-anchor="end">${fmt(yMax - pad)}</text>`);
  partes.push(`<text class="g-eje" x="${m.izq - 4}" y="${y(yMin + pad) + 4}" text-anchor="end">${fmt(yMin + pad)}</text>`);
  partes.push(`<text class="g-eje" x="${m.izq}" y="${alto - 4}">${dMin}</text>`);
  partes.push(`<text class="g-eje" x="${ancho - m.der}" y="${alto - 4}" text-anchor="end">${dMax}</text>`);

  // Guía de lectura (se mueve al tocar el gráfico) y escala para convertir un toque en un día.
  partes.push(`<line class="g-guia" x1="0" x2="0" y1="${m.sup}" y2="${alto - m.inf}" visibility="hidden"/>`);
  partes.push(`<circle class="g-marca" cx="0" cy="0" r="4" visibility="hidden"/>`);
  const escala = { dMin, dMax, yMin, yMax, ancho, alto, ...m };
  return `<svg class="grafico" viewBox="0 0 ${ancho} ${alto}" role="img" data-escala='${JSON.stringify(escala)}'>${partes.join('')}</svg>`;
}

// Punto de la serie más cercano a una posición x del gráfico (en unidades del viewBox).
export function puntoCercano(serie, escala, xVista) {
  const { dMin, dMax, ancho, izq, der } = escala;
  const dia = dMin + ((xVista - izq) / (ancho - izq - der)) * (dMax - dMin);
  let mejor = null;
  for (const p of serie) if (!mejor || Math.abs(p.dia - dia) < Math.abs(mejor.dia - dia)) mejor = p;
  return mejor;
}

// Coordenadas de un punto en el viewBox del gráfico.
export function aVista(escala, p) {
  const { dMin, dMax, yMin, yMax, ancho, alto, izq, der, sup, inf } = escala;
  return {
    x: izq + ((p.dia - dMin) / (dMax - dMin)) * (ancho - izq - der),
    y: sup + (1 - (p.valor - yMin) / (yMax - yMin)) * (alto - sup - inf),
  };
}

// Mini-gráfico para las tarjetas: últimos días contra el rango personal, sin ejes.
export function graficoMini({ serie, base, ancho = 100, alto = 26 }) {
  if (serie.length < 2) return '';
  const banda = base ? [base.media - 2 * base.de, base.media + 2 * base.de] : [];
  const ys = [...serie.map((p) => p.valor), ...banda];
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const dMin = serie[0].dia;
  const dMax = Math.max(serie.at(-1).dia, dMin + 1);
  const x = (d) => ((d - dMin) / (dMax - dMin)) * ancho;
  const y = (v) => 2 + (1 - (v - yMin) / (yMax - yMin || 1)) * (alto - 4);
  const rect = base ? `<rect class="s-banda" x="0" y="${y(banda[1]).toFixed(1)}" width="${ancho}" height="${(y(banda[0]) - y(banda[1])).toFixed(1)}"/>` : '';
  const pts = serie.map((p) => `${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  return `<svg class="ind-spark" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" aria-hidden="true">${rect}<polyline class="s-linea" points="${pts}"/></svg>`;
}
