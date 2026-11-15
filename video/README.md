# Video de 30 s

Cuatro versiones del mismo video, en español e inglés, para presentar y para redes:

| Archivo | Formato | Uso |
|---|---|---|
| `salida/puduhealth-es-horizontal.mp4` | 1920 × 1080 (16:9) | Presentación, YouTube, entrega |
| `salida/puduhealth-en-horizontal.mp4` | 1920 × 1080 (16:9) | Presentación, YouTube, entrega |
| `salida/puduhealth-es-vertical.mp4` | 1080 × 1920 (9:16) | Instagram Reels, historias |
| `salida/puduhealth-en-vertical.mp4` | 1080 × 1920 (9:16) | Instagram Reels, historias |

Muestra **la app real funcionando**, en el escenario de viaje de ida de 210 días
(`app/?escenario=transito`): no es una maqueta. Un Chromium sin interfaz abre la app, un guion la
conduce y cada cuadro se captura con un reloj virtual, así las animaciones quedan exactas aunque
capturar tarde más que un cuadro real. La versión vertical usa la app en formato celular (sus
pestañas Pudú y Hoy), las escenas en pixel art rehechas para 9:16 y los subtítulos sobre la zona
que tapan los controles de Instagram.

| Tiempo | Escena |
|---|---|
| 0–6 s | Rumbo a Marte: los límites fijos avisan tarde y los astronautas tienden a callar síntomas |
| 6–9 s | Título: plataforma abierta de salud, con el Astropudú |
| 9–12,5 s | La plataforma: sensores propios o de terceros → API abierta `puduhealth/v1` → línea base y reglas → app (la cámara, como alternativa) |
| 12,5–16 s | Registro diario de 10 s; el Astropudú pasa de dormido a contento |
| 16–26 s | Misión simulada, día 100 → 205: ámbar, alertas, pantalla de atención clínica, rojo con su fuente |
| 26–30 s | Probado con datos reales y cierre (API abierta · cualquier sensor) |

## Generar

Requiere `chromium`, `ffmpeg` y `edge-tts` (`pip install edge-tts`). La app se abre directamente
desde `app/index.html`: no hace falta servidor. La fuente pixel (Press Start 2P) se carga desde
Google Fonts.

```bash
python video/narrar.py voz --idioma es                           # voz y tiempos de cada frase
node video/grabar.mjs --idioma es --formato vertical             # cuadros con subtítulos sincronizados
python video/narrar.py mezclar --idioma es --formato vertical    # → salida/puduhealth-es-vertical.mp4
```

Repetir con `--idioma en` y `--formato horizontal` para las otras versiones.
`node video/grabar.mjs … --cuadros 7,18,24` captura sólo esos segundos como imágenes, para revisar
el encuadre antes de grabar los 900 cuadros.

**Narración:** voz neuronal de Microsoft mediante `edge-tts`: `es-CL-CatalinaNeural` (español de
Chile) y `en-US-AndrewNeural` (inglés). Los guiones están en `narracion.es.json` y
`narracion.en.json`; los subtítulos se sincronizan con cada frase hablada.

**Música:** `musica/astropudu-tema.mp3`, tema original compuesto por Benjamín Catipillan-Ulloa
(equipo TecMedHub) para el video. `--nivel-musica` ajusta su volumen (por omisión −25 LUFS; la voz
va a −15 LUFS) y `--sin-musica` deja sólo la voz.

| Archivo | Qué hace |
|---|---|
| `reloj.js` | Reloj virtual: tiempo, animaciones y temporizadores avanzan sólo cuando el grabador lo indica |
| `director.js` | Escenas en pixel art, subtítulos y guion de acciones sobre la app, en los dos idiomas y formatos |
| `grabar.mjs` | Abre Chromium, captura los 900 cuadros y los une con ffmpeg |
| `narracion.es.json`, `narracion.en.json` | Frases de la narración, con el segundo en que empieza cada una |
| `narrar.py` | Sintetiza la voz y la mezcla con el video y la música |
| `musica/astropudu-tema.mp3` | Tema original del video, de Benjamín Catipillan-Ulloa |
