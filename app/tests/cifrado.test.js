import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevaLlaveDatos, cifrar, descifrar, llaveDePin, envolver, desenvolver } from '../js/cifrado.js';

const sal = new Uint8Array(16).fill(7);

test('cifrado: lo guardado no deja ver los datos y se recupera igual', async () => {
  const llave = await nuevaLlaveDatos();
  const texto = JSON.stringify([{ tipo: 'phq9', valor: 12, persona: 'YO' }]);
  const sobre = await cifrar(llave, texto);
  assert.ok(!JSON.stringify(sobre).includes('phq9'));
  assert.equal(await descifrar(llave, sobre), texto);
  const otro = await cifrar(llave, texto);
  assert.notEqual(otro.iv, sobre.iv); // IV nuevo en cada escritura
});

test('cifrado: un dato alterado no se descifra (GCM autentica)', async () => {
  const llave = await nuevaLlaveDatos();
  const sobre = await cifrar(llave, 'fc_reposo 61');
  const bytes = Uint8Array.from(atob(sobre.datos), (c) => c.charCodeAt(0));
  bytes[0] ^= 1;
  await assert.rejects(descifrar(llave, { ...sobre, datos: btoa(String.fromCharCode(...bytes)) }));
});

test('cifrado: sólo el PIN correcto abre la llave de datos', async () => {
  const datos = await nuevaLlaveDatos();
  const sobre = await envolver(datos, await llaveDePin('2468', sal, 1000));
  const abierta = await desenvolver(sobre, await llaveDePin('2468', sal, 1000));
  const c = await cifrar(datos, 'hola');
  assert.equal(await descifrar(abierta, c), 'hola');
  await assert.rejects(desenvolver(sobre, await llaveDePin('1357', sal, 1000)));
});

test('cifrado: textos grandes (meses de registros) también', async () => {
  const llave = await nuevaLlaveDatos();
  const texto = 'x'.repeat(600000);
  assert.equal(await descifrar(llave, await cifrar(llave, texto)), texto);
});
