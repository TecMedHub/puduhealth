# App web — monitoreo de salud a bordo

Aplicación estática (HTML + JavaScript, sin backend ni nube; funciona sin conexión tras la primera visita) que compara a cada tripulante con su propia
línea base y decide con reglas citadas. El diseño completo está en [`docs/plan.es.md`](../docs/plan.es.md).

## Módulos

| Archivo | Qué hace |
|---|---|
| `js/datos.js` | Formato común de registro, tipos de medición y fases de misión |
| `js/aleatorio.js` | Generador pseudoaleatorio con semilla (misma semilla, mismos datos) |
| `js/escenario.js` | Dos escenarios con sus fuentes: misión completa a Marte (por defecto, 860 días) y viaje de ida (210 días); fases y dosis por fase |
| `js/simulador.js` | Tripulación simulada: perfiles, línea base en tierra, misión y eventos |
| `js/lineabase.js` | Línea base personal, puntuación z y tendencia EWMA |
| `js/estado.js` | Estado de una persona en un día: variables e indicadores derivados |
| `js/reglas.js` | Reglas de decisión, cada una con su fuente (español e inglés) |
| `js/motor.js` | Motor de reglas: estado → alertas → semáforo por riesgo |
| `js/panel.js` | Interfaz: secciones Pudú, Hoy, Datos y Tendencias, modo demo, registro diario y pantalla de atención clínica |
| `js/cifrado.js` | Cifrado en el dispositivo: AES-GCM de 256 bits, llave del dispositivo no exportable o PIN opcional (PBKDF2). Ver [`docs/privacidad.es.md`](../docs/privacidad.es.md) |
| `js/personal.js` | Mi registro: días de calibración, escenario personal y datos guardados en el dispositivo |
| `js/ui.js` | Piezas de interfaz: hoja inferior, avisos breves y vibración |
| `index.html` → *Conectar sensor* | Hoja con las fuentes de la API y su estado: Bluetooth estándar (diseñado), importar de un equipo y API para desarrolladores (funcionan), cámara del celular (alternativa) |
| `js/entrada.js` | API abierta de la plataforma (`window.puduHealth`): cualquier sensor o equipo entrega mediciones en un formato único (`puduhealth/v1`), por la API en la página, por archivo JSON/CSV o por el adaptador de la cámara. Ver [`docs/conexion.md`](../docs/conexion.md) y la [wiki de la API](https://github.com/TecMedHub/puduhealth/wiki) |
| `sw.js` | Modo sin conexión: guarda los archivos de la app en el dispositivo en la primera visita; una versión nueva se activa al aceptar el aviso |
| `manifest.webmanifest` | App instalable: nombre, íconos (dibujados desde el sprite del acompañante) y atajos |
| `js/acompanante.js` | Acompañante en pixel art y su estado (depende de hábitos, no del contenido emocional) |
| `js/graficos.js` | Tendencias en SVG con rango personal y umbrales |
| `js/i18n.js` | Textos en español e inglés |
| `js/explicaciones.js` | Explicaciones por indicador para el astronauta (español e inglés) |

## Uso

```bash
npm test     # pruebas (Node 20 o superior)
npm start    # sirve el repositorio; abrir http://localhost:8080/app/
npm run https  # HTTPS en la red local, para medir con la cámara del celular
```

```js
import { simularTripulacion } from './js/simulador.js';
import { indexar, calcularEstado } from './js/estado.js';
import { evaluarReglas, semaforo } from './js/motor.js';
import { ESCENARIOS } from './js/escenario.js';

const sim = simularTripulacion('mision-17'); // misión completa a Marte
const estado = calcularEstado(indexar(sim.registros), 'P01', 500, sim.escenario);
semaforo(evaluarReglas(estado)); // { …, radiacion: 'rojo' }: la dosis ya superó el límite de carrera
estado.dosis_proyectada;         // ≈ 1.050 mSv al final de la misión

simularTripulacion('mision-17', ESCENARIOS.transito); // viaje de ida de 210 días (el del video)
```

## Interfaz

Pensada primero para el celular, como app instalable (`manifest.webmanifest`): desde Chrome en Android,
"Instalar app"; en iPhone, Compartir → Añadir a pantalla de inicio. Abre a pantalla completa, sin
barra del navegador, y funciona sin conexión.

- **Dos modos**, elegidos al terminar la introducción y cambiables en Ajustes:
  - **Mi registro** (la app): una persona, hoy, con sus propios datos guardados sólo en el dispositivo
    (`js/personal.js`). Los primeros 7 días calibran la línea base personal; desde el octavo, cada valor
    se compara con ella. Un dato que falta no cuenta como cero (la tarjeta dice cómo obtenerlo: registro
    diario, cámara o equipo de a bordo), y las reglas sobre 7 días esperan a tener 7 días de historia;
    las reglas absolutas (fiebre, síntomas, PHQ-9) valen desde el primer día. Los datos se exportan en
    el formato de entrada (`puduhealth/v1`) y se pueden borrar.
  - **Misión de ejemplo**: la tripulación simulada camino a Marte (`?demo=1` la abre directamente).
- **Cuatro secciones** en la barra inferior, que también se recorren deslizando: **Pudú** (acompañante,
  registro y medición), **Hoy** (estado general, riesgos y alertas), **Datos** (indicadores) y
  **Tendencias**. En pantallas anchas se ven juntas en dos columnas.
- **Ajustes** (el engranaje en Mi registro, la insignia DEMO en la misión de ejemplo): modo, mis datos
  (importar, exportar, borrar), idioma, tema e instalar. En la misión de ejemplo, además, tripulante,
  día de misión (‹ › o las flechas ← → del teclado), escenario y semilla.
- **ES / EN** cambia el idioma de toda la interfaz, incluidas las recomendaciones.
  Con `?lang=en` en la dirección la app abre en inglés.
- **Tres temas de color**, elegibles en el modo demo y recordados en el dispositivo (o con `?tema=`):
  **Astropudú** (`astropudu`, por defecto: índigo del casco, crema del traje y naranja de las luces del
  pecho), **Chiloé** (`chiloe`: bosque de noche, musgo y cobre del pelaje) y **Marte** (`marte`: roca,
  óxido y turquesa). Cada tema define una docena de colores en `css/estilo.css`; verde, ámbar y rojo
  significan lo mismo en todos (en rango, atención, actuar) y la pantalla de atención clínica se mantiene
  clara y neutra (blanca) en cualquier tema.
- Al primer uso, una **introducción** de tres pasos (se puede saltar y volver a ver desde el modo demo).
- Con PHQ-9 ≥ 10 el acompañante se hace a un lado y aparece una pantalla clínica clara con el paso a seguir: contactar al oficial médico.
- El **registro diario** pide ánimo y somnolencia (obligatorios); horas de sueño, minutos de ejercicio
  aeróbico y de resistencia, síntomas por tipo y temperatura son opcionales. Volver a registrar el mismo día reemplaza lo anterior; sin síntomas marcados, el día
  queda sin síntomas.
- **Temperatura** y **síntomas de los últimos 3 días** aparecen en Datos; la temperatura tiene
  su tendencia con el umbral de 38 °C.
- Cada tarjeta de **Datos** muestra los últimos 30 días contra el rango personal y, al tocarla, abre una
  explicación: cómo se mide en el espacio, por qué importa allá, qué peligros del vuelo espacial
  (NASA HRP) se relacionan, cuándo pedir ayuda y qué hacer (`js/explicaciones.js`).
- En **Tendencias**, tocar o arrastrar sobre un gráfico muestra el día y el valor; el período se elige
  entre 30 días, 90 días o la misión completa.
- Atajos del ícono instalado: `?accion=registrar` y `?accion=medir`.

## Acompañante: Astropudú

Un pudú astronauta. El pudú es el ciervo más pequeño del mundo y vive en el sur de Chile, incluida
Chiloé. Se dibuja en pixel art (48 × 48) por código en `js/acompanante.js`, a partir del diseño del
equipo y su paleta, con cuatro estados animados:

| Estado | Pose |
|---|---|
| `despierto` | de pie, parpadea |
| `durmiendo` | sentado, ojos cerrados, Zzz (aún no hay registro hoy) |
| `contento` | brazos arriba y destellos (registró, durmió bien y cumplió el ejercicio) |
| `ejercitandose` | salto de tijera (al tocarlo) |

Para usar una hoja de sprites dibujada a mano, dejarla en `img/` y apuntar `HOJA_SPRITES` en
`js/panel.js` a ese archivo: una fila por estado en el orden de la tabla, 2 cuadros por fila,
cada cuadro de 48 × 48 píxeles con fondo transparente.

## Medición de FC con el celular

**Medir FC (60 s)** usa la cámara trasera y la linterna con el mismo procesamiento de señal del
pulsómetro (`pulsometro/assets/ppg.js`, validado contra ECG en `ml/README.md`).

- El tiempo empieza a correr cuando el dedo cubre la cámara.
- Las mediciones de buena calidad se pueden agregar a la **línea base de este dispositivo**: la
  mediana de hasta 5 mediciones en reposo.
- Con línea base, la app estima el **estrés agudo** con `modelos/estres.json`.
- **Descargar grabación** guarda la señal cruda en JSON: `[t (s), timestamp (ms), R, G, B]` por
  cuadro, el mismo formato que el pulsómetro, más el resultado.
- **Señal de prueba** genera un pulso sintético para probar sin cámara.

La cámara exige HTTPS. Para probar desde el celular en la misma WiFi: `npm run https`, abrir la
dirección que muestra y aceptar la advertencia del certificado autofirmado.
