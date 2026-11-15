import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS, TAM, dibujarPudu, poseDeEstado, estadoAcompanante } from '../js/acompanante.js';

test('cada estado se dibuja en una grilla de 48 × 48 con contenido', () => {
  for (const estado of ESTADOS) {
    for (const t of [0, 300, 1300, 2500]) {
      const g = dibujarPudu(poseDeEstado(estado, t));
      assert.equal(g.length, TAM);
      g.forEach((fila) => assert.equal(fila.length, TAM));
      const llenos = g.flat().filter(Boolean).length;
      assert.ok(llenos > 400, `${estado} t=${t}: ${llenos} píxeles`);
    }
  }
});

test('de pie, la silueta es simétrica', () => {
  const g = dibujarPudu({ ojos: 'cerrados' });
  for (let y = 0; y < TAM; y++) {
    for (let x = 0; x < TAM; x++) {
      assert.equal(Boolean(g[y][x]), Boolean(g[y][TAM - 1 - x]), `(${x}, ${y})`);
    }
  }
});

test('sin registro hoy, el acompañante duerme', () => {
  assert.equal(estadoAcompanante({ variables: { sueno: { ultimo: 8 } }, cumplimiento_resistencia_7d: 1 }, false), 'durmiendo');
});

test('con registro y buenos hábitos, está contento', () => {
  assert.equal(estadoAcompanante({ variables: { sueno: { ultimo: 7.5 } }, cumplimiento_resistencia_7d: 0.9 }, true), 'contento');
});

test('el contenido emocional de las respuestas no cambia su estado', () => {
  const base = { variables: { sueno: { ultimo: 6 } }, cumplimiento_resistencia_7d: 0.9 };
  const triste = { ...base, variables: { ...base.variables, animo_valencia: { ultimo: 1, desviada: true } }, phq9: 20 };
  const feliz = { ...base, variables: { ...base.variables, animo_valencia: { ultimo: 9, desviada: false } }, phq9: 0 };
  assert.equal(estadoAcompanante(triste, true), estadoAcompanante(feliz, true));
});
