// Modo sin conexión: guarda la app en el dispositivo en la primera visita.
// Con red se usa siempre la versión del servidor (y se actualiza la copia); sin red, la copia.
// Nada sale del dispositivo: sólo se guardan los archivos de la app.

const CACHE = 'puduhealth-v9';

const ARCHIVOS = [
  './',
  'index.html',
  'css/estilo.css',
  'manifest.webmanifest',
  'img/icono-192.png',
  'img/icono-512.png',
  'img/icono-maskable-512.png',
  'img/apple-touch-icon.png',
  'img/favicon-64.png',
  'fuentes/inter-latin.woff2',
  'modelos/estres.json',
  'js/acompanante.js',
  'js/aleatorio.js',
  'js/captura.js',
  'js/cifrado.js',
  'js/datos.js',
  'js/entrada.js',
  'js/escenario.js',
  'js/estado.js',
  'js/explicaciones.js',
  'js/graficos.js',
  'js/i18n.js',
  'js/lineabase.js',
  'js/medicion.js',
  'js/modelos.js',
  'js/motor.js',
  'js/panel.js',
  'js/personal.js',
  'js/reglas.js',
  'js/simulador.js',
  'js/ui.js',
  '../pulsometro/assets/ppg.js',
  '../pulsometro/assets/movimiento.js',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
});

// La versión nueva espera a que la app pida activarla (aviso "Nueva versión · Recargar").
self.addEventListener('message', (ev) => {
  if (ev.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  const { request } = ev;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  ev.respondWith(
    // no-cache: siempre se pregunta al servidor si hay versión nueva (evita mezclar archivos viejos y nuevos).
    fetch(request, { cache: 'no-cache' })
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(request, copia));
        }
        return r;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((r) => r ?? (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
