// Graba el video de 30 s: la app real + escenas, cuadro a cuadro, a 30 fps.
//   horizontal: 1920 × 1080 (16:9)      vertical: 1080 × 1920 (9:16, Instagram Reels)
//
// Requisitos: chromium y ffmpeg. Abre app/index.html directamente (no necesita servidor).
// Uso: node video/grabar.mjs --idioma es|en --formato horizontal|vertical [--cuadros 7,18,24]
//   → video/salida/cuadros-<idioma>-<formato>.mp4 (sin sonido; luego narrar.py mezclar)
//   --cuadros sólo captura esos segundos como PNG, para revisar el encuadre.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const aqui = dirname(fileURLToPath(import.meta.url));
const { values: op } = parseArgs({
  options: {
    idioma: { type: 'string', default: 'en' },
    formato: { type: 'string', default: 'horizontal' },
    cuadros: { type: 'string' },
    url: { type: 'string' },
  },
});
if (!['es', 'en'].includes(op.idioma) || !['horizontal', 'vertical'].includes(op.formato)) {
  throw new Error('Uso: --idioma es|en --formato horizontal|vertical');
}
const VERTICAL = op.formato === 'vertical';
const archivoApp = pathToFileURL(join(aqui, '..', 'app', 'index.html')).href;
const URL_APP = op.url ?? `${archivoApp}?escenario=transito&intro=0&lang=${op.idioma}`;
const FPS = 30;
const PUERTO = 9333;
const nombre = `${op.idioma}-${op.formato}`;
const salida = join(aqui, 'salida');
const cuadros = join(salida, op.cuadros ? `prueba-${nombre}` : `cuadros-${nombre}`);
const perfil = join(homedir(), '.cache', 'puduhealth', `chromium-video-${nombre}`);

// Perfil limpio en cada grabación: sin datos ni preferencias de una corrida anterior.
rmSync(cuadros, { recursive: true, force: true });
rmSync(perfil, { recursive: true, force: true });
mkdirSync(cuadros, { recursive: true });
mkdirSync(perfil, { recursive: true });

const chrome = spawn('chromium', [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, '--allow-file-access-from-files',
  '--hide-scrollbars', '--mute-audio', '--no-first-run', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

const esperar = (ms) => new Promise((r) => globalThis.setTimeout(r, ms));
async function objetivo() {
  for (let i = 0; i < 50; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const pagina = lista.find((x) => x.type === 'page');
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch { /* aún no arranca */ }
    await esperar(200);
  }
  throw new Error('Chromium no respondió');
}

const ws = new WebSocket(await objetivo());
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pendientes = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) {
    const { ok, error } = pendientes.get(m.id);
    pendientes.delete(m.id);
    if (m.error) error(new Error(m.error.message)); else ok(m.result);
  } else if (m.method === 'Runtime.exceptionThrown') {
    console.error('Excepción en la página:', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  }
};
const cdp = (method, params = {}) => new Promise((ok, error) => {
  pendientes.set(++id, { ok, error });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluar(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

try {
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', VERTICAL
    ? { width: 360, height: 640, deviceScaleFactor: 3, mobile: true }
    : { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(join(aqui, 'reloj.js'), 'utf8') });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `window.__VIDEO = ${JSON.stringify({ idioma: op.idioma, formato: op.formato })};` });
  await cdp('Page.navigate', { url: URL_APP });

  for (let i = 0; ; i++) {
    await esperar(200);
    const listo = await evaluar(`document.readyState === 'complete' && !!document.querySelector('#tripulacion button')`).catch(() => false);
    if (listo) break;
    if (i > 100) throw new Error('La app no cargó');
  }
  await evaluar('__reloj.avanzar(100)');
  const tiempos = join(salida, `narracion-${op.idioma}`, 'tiempos.json');
  if (existsSync(tiempos)) {
    await evaluar(`window.__NARRACION = ${readFileSync(tiempos, 'utf8')}; 1`);
    console.log('Subtítulos sincronizados con la narración');
  }
  await evaluar(readFileSync(join(aqui, 'director.js'), 'utf8'));
  for (let i = 0; !(await evaluar('!!window.__video')); i++) {
    if (i > 100) throw new Error('El director no arrancó');
    await esperar(100);
  }

  const total = Math.round((await evaluar('__video.DURACION')) * FPS);
  const inicio = Date.now();
  if (op.cuadros) {
    for (const seg of op.cuadros.split(',').map(Number).sort((a, b) => a - b)) {
      const i = Math.round(seg * FPS);
      await evaluar(`__video.cuadro(${i / FPS}); __reloj.avanzar(${(1000 * i / FPS + 100).toFixed(3)}); 1`);
      const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(cuadros, `t${String(seg).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
    }
    console.log(`→ ${cuadros}`);
    ws.close();
    chrome.kill();
    process.exit(0);
  }
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await evaluar(`__video.cuadro(${t}); __reloj.avanzar(${(1000 * t + 100).toFixed(3)}); 1`);
    const { data } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
    writeFileSync(join(cuadros, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
    if (i % 90 === 0) process.stdout.write(`cuadro ${i}/${total} (${((Date.now() - inicio) / 1000).toFixed(0)} s)\n`);
  }

  const mp4 = join(salida, `cuadros-${nombre}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(cuadros, '%04d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4,
  ]);
  console.log(`→ ${mp4}`);
} finally {
  ws.close();
  chrome.kill();
}
