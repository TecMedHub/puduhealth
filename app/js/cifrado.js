// Cifrado de los datos personales en el dispositivo (Web Crypto, sin dependencias).
//
// Esquema (envoltura de llave):
//   - Una llave de datos AES-GCM de 256 bits cifra los registros y la línea base de la cámara.
//     Cada escritura usa un vector de inicialización (IV) nuevo de 96 bits; GCM además autentica:
//     un dato alterado no se descifra.
//   - La llave de datos nunca se guarda en claro: se guarda envuelta (cifrada) por
//       · una llave del dispositivo, AES-GCM no exportable, guardada en IndexedDB (modo 'dispositivo'), o
//       · una llave derivada del PIN con PBKDF2-SHA-256 y 600 000 iteraciones (modo 'pin').
//     Sin el PIN no hay forma de abrir los datos; olvidar el PIN obliga a borrarlos.
//   - Nada de esto sale del dispositivo. El archivo que exporta la persona va sin cifrar, a pedido suyo.

export const ITERACIONES_PIN = 600000; // recomendación OWASP 2023 para PBKDF2-HMAC-SHA256
const AES = { name: 'AES-GCM', length: 256 };

const sutil = () => globalThis.crypto?.subtle;
export const cifradoDisponible = () => Boolean(sutil());

// Por bloques: con meses de registros el texto pasa el límite de argumentos de una llamada.
function aB64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));

// ---------- primitivas ----------

export const nuevaLlaveDatos = () => sutil().generateKey(AES, true, ['encrypt', 'decrypt']);
export const nuevaLlaveDispositivo = () => sutil().generateKey(AES, false, ['wrapKey', 'unwrapKey']);

export async function cifrar(llave, texto) {
  const iv = aleatorio(12);
  const datos = await sutil().encrypt({ name: 'AES-GCM', iv }, llave, new TextEncoder().encode(texto));
  return { v: 1, iv: aB64(iv), datos: aB64(datos) };
}

export async function descifrar(llave, sobre) {
  const claro = await sutil().decrypt({ name: 'AES-GCM', iv: deB64(sobre.iv) }, llave, deB64(sobre.datos));
  return new TextDecoder().decode(claro);
}

export async function llaveDePin(pin, sal, iteraciones = ITERACIONES_PIN) {
  const base = await sutil().importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return sutil().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    base, AES, false, ['wrapKey', 'unwrapKey'],
  );
}

export async function envolver(llaveDatos, llaveEnvoltura) {
  const iv = aleatorio(12);
  const envuelta = await sutil().wrapKey('raw', llaveDatos, llaveEnvoltura, { name: 'AES-GCM', iv });
  return { iv: aB64(iv), envuelta: aB64(envuelta) };
}

export const desenvolver = (sobre, llaveEnvoltura) => sutil().unwrapKey(
  'raw', deB64(sobre.envuelta), llaveEnvoltura, { name: 'AES-GCM', iv: deB64(sobre.iv) },
  AES, true, ['encrypt', 'decrypt'],
);

// ---------- bóveda: la llave de datos de este dispositivo ----------

const CLAVE_LLAVE = 'puduhealth.llave';
const BD = 'puduhealth';
const ALMACEN = 'llaves';

function bd() {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open(BD, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}
async function bdLeer(clave) {
  const base = await bd();
  return new Promise((ok, mal) => {
    const p = base.transaction(ALMACEN).objectStore(ALMACEN).get(clave);
    p.onsuccess = () => ok(p.result ?? null);
    p.onerror = () => mal(p.error);
  });
}
async function bdEscribir(clave, valor) {
  const base = await bd();
  return new Promise((ok, mal) => {
    const tx = base.transaction(ALMACEN, 'readwrite');
    tx.objectStore(ALMACEN).put(valor, clave);
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
  });
}

const leerJSON = (clave) => { try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; } };
const escribirJSON = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

async function llaveDispositivo() {
  let llave = await bdLeer('dispositivo');
  if (!llave) {
    llave = await nuevaLlaveDispositivo();
    await bdEscribir('dispositivo', llave);
  }
  return llave;
}

// Estado de la bóveda: 'sin-cifrado' (el navegador no lo permite), 'nueva', 'dispositivo' o 'pin'.
export function modoBoveda() {
  if (!cifradoDisponible() || typeof indexedDB === 'undefined') return 'sin-cifrado';
  return leerJSON(CLAVE_LLAVE)?.modo ?? 'nueva';
}

// Abre la bóveda y devuelve la llave de datos. Con PIN, `pin` es obligatorio; un PIN incorrecto
// lanza un error (GCM no deja desenvolver con otra llave). La primera vez crea la llave.
export async function abrirBoveda(pin = null) {
  const guardada = leerJSON(CLAVE_LLAVE);
  if (!guardada) {
    const llave = await nuevaLlaveDatos();
    escribirJSON(CLAVE_LLAVE, { v: 1, modo: 'dispositivo', ...(await envolver(llave, await llaveDispositivo())) });
    return llave;
  }
  if (guardada.modo === 'pin') {
    if (!pin) throw new Error('pin-requerido');
    return desenvolver(guardada, await llaveDePin(pin, deB64(guardada.sal), guardada.iteraciones));
  }
  return desenvolver(guardada, await llaveDispositivo());
}

// Pone, cambia o quita el PIN (pin = null vuelve a la llave del dispositivo). Los datos no se
// vuelven a cifrar: sólo cambia la envoltura de la llave de datos.
export async function fijarPin(llaveDatos, pin) {
  if (!pin) {
    escribirJSON(CLAVE_LLAVE, { v: 1, modo: 'dispositivo', ...(await envolver(llaveDatos, await llaveDispositivo())) });
    return;
  }
  const sal = aleatorio(16);
  const envuelta = await envolver(llaveDatos, await llaveDePin(pin, sal));
  escribirJSON(CLAVE_LLAVE, { v: 1, modo: 'pin', sal: aB64(sal), iteraciones: ITERACIONES_PIN, ...envuelta });
}

export function olvidarBoveda() {
  try { localStorage.removeItem(CLAVE_LLAVE); } catch { /* sin almacenamiento */ }
}

// Lee y escribe un valor cifrado con la llave de datos. Un valor antiguo sin cifrar se acepta
// una vez (y queda cifrado en la siguiente escritura).
export async function leerCifrado(llave, clave) {
  const v = leerJSON(clave);
  if (v === null || v === undefined) return null;
  if (!(v && v.v === 1 && v.iv && v.datos)) return v;
  return JSON.parse(await descifrar(llave, v));
}

export async function escribirCifrado(llave, clave, valor) {
  escribirJSON(clave, llave ? await cifrar(llave, JSON.stringify(valor)) : valor);
}
