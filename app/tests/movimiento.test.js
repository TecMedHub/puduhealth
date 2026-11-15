import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const Movimiento = createRequire(import.meta.url)('../../pulsometro/assets/movimiento.js');

// Simula 3 s de lecturas a 60 Hz con una aceleración lineal dada por f(t).
function simular(f, { conGravedad = false } = {}) {
  Movimiento.detener();
  for (let i = 0; i <= 180; i++) {
    const t = i / 60;
    const a = f(t);
    if (conGravedad) Movimiento.agregar(t, null, { x: a, y: 0, z: 9.81 });
    else Movimiento.agregar(t, { x: a, y: 0, z: 0 });
  }
  return 3;
}

test('quieto con el celular en la mano: sin movimiento', () => {
  const t = simular((s) => 0.05 * Math.sin(2 * Math.PI * 8 * s));
  assert.equal(Movimiento.enMovimiento(t), false);
});

test('braceo al trotar (~1,5 Hz, 3 m/s²): movimiento', () => {
  const t = simular((s) => 3 * Math.sin(2 * Math.PI * 1.5 * s));
  assert.equal(Movimiento.enMovimiento(t), true);
});

test('sin aceleración lineal: se estima restando la gravedad', () => {
  const quieto = simular(() => 0, { conGravedad: true });
  assert.equal(Movimiento.enMovimiento(quieto), false);
  const braceo = simular((s) => 3 * Math.sin(2 * Math.PI * 1.5 * s), { conGravedad: true });
  assert.equal(Movimiento.enMovimiento(braceo), true);
});

test('sin datos: no se informa movimiento ni disponibilidad', () => {
  Movimiento.detener();
  assert.equal(Movimiento.rmsReciente(10), null);
  assert.equal(Movimiento.enMovimiento(10), false);
  assert.equal(Movimiento.disponible(), false);
});
