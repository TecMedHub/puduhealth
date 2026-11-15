<p align="center">
  <img src="docs/img/astropudu.png" alt="Astropudú, un pudú astronauta en pixel art" width="200">
</p>

# PuduHealth · TecMedHub · NASA Space Apps Challenge 2026

> 🇬🇧 [English](README.md) · 🇨🇱 Español

**Reto:** [Create Health Monitoring Software for Astronauts on Space Missions](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/)
**Equipo:** [TecMedHub](https://www.spaceappschallenge.org/2026/find-a-team/tecmedhub/) · **Sede local:** Quemchi, Chiloé, Chile

<p align="center">
  <a href="https://tecmedhub.github.io/puduhealth/app/"><b>▶&nbsp;Abrir la app</b></a> &nbsp;·&nbsp;
  <a href="https://tecmedhub.github.io/puduhealth/pitch/es/"><b>🎤&nbsp;Ver la presentación (7 diapositivas)</b></a> &nbsp;·&nbsp;
  <a href="https://tecmedhub.github.io/puduhealth/app/?demo=1"><b>🚀&nbsp;Misión de ejemplo a Marte</b></a> &nbsp;·&nbsp;
  <a href="https://tecmedhub.github.io/puduhealth/?lang=es"><b>🌐&nbsp;Sitio del proyecto</b></a>
</p>

<p align="center">
  <a href="https://tecmedhub.github.io/puduhealth/app/?demo=1"><img src="docs/img/vista-app.png" alt="PuduHealth en un celular: acompañante, riesgos de hoy, indicadores y tendencias" width="100%"></a>
</p>

| Video de 30 segundos (desde la app real) | Presentación con la app funcionando adentro |
|---|---|
| <a href="https://tecmedhub.github.io/puduhealth/?lang=es"><img src="docs/img/demo.gif" alt="Vista previa del video" width="100%"></a> | <a href="https://tecmedhub.github.io/puduhealth/pitch/es/"><img src="docs/img/vista-pitch.png" alt="Diapositiva del pitch con la app en vivo" width="100%"></a> |
| Español [16:9](video/salida/puduhealth-es-horizontal.mp4) · [9:16](video/salida/puduhealth-es-vertical.mp4) · inglés [16:9](video/salida/puduhealth-en-horizontal.mp4) · [9:16](video/salida/puduhealth-en-vertical.mp4) | Español: [pitch/es/](https://tecmedhub.github.io/puduhealth/pitch/es/) · inglés: [pitch/](https://tecmedhub.github.io/puduhealth/pitch/) |

En el celular, abre la app y elige *Instalar*: queda como cualquier otra app y funciona sin conexión.

---

## En 30 segundos

**PuduHealth es una plataforma abierta de monitoreo de salud para misiones espaciales. Cualquier
sensor médico, de diseño propio o de terceros, se conecta por una API abierta; el motor compara a
cada astronauta con su propia línea base y marca cuando se aleja de ella, antes de cruzar un límite estándar.** Le dice a quien tiene que actuar qué hacer y
cuándo avisar al oficial médico de la tripulación, cita la fuente de cada recomendación, mantiene
las respuestas privadas y cifradas en el dispositivo, y funciona sin enlace con la Tierra.

| | |
|---|---|
| **Impacto** | Los límites fijos avisan tarde. Con datos reales de Fitbit de 14 personas, el detector personal marca un **alza sostenida de +5 lpm en 3 días** (mediana, alza agregada a los datos) y alerta sólo en el 2,5 % de los días comunes. El mismo enfoque sirve a las postas rurales de Chiloé, donde lo construimos |
| **Creatividad** | Una plataforma, no un sensor: cualquier equipo se conecta por una API abierta, así que el hardware cambia sin tocar el motor. Cada persona es su propia referencia, las respuestas se quedan con el astronauta y un acompañante premia los hábitos sin juzgar las emociones |
| **Validez** | Reglas deterministas con umbrales citados. Un **modelo entrenado de estrés agudo** (AUC 0,93, WESAD) que corre en el teléfono con la frecuencia cardíaca de cualquier sensor. Detector de desviaciones calibrado con datos reales (14 personas, ~5 meses). 64 pruebas automáticas |
| **Pertinencia** | Reúne indicadores, evalúa cinco riesgos de NASA, muestra tendencias y recomienda acciones. El escenario se apoya en estándares de NASA, informes técnicos de OCHMO y la radiación medida por MSL RAD en Curiosity |
| **Presentación** | Una app de celular instalable, en español e inglés. Cada indicador se explica solo, y una misión de ejemplo muestra el sistema completo en un minuto |
| **Datos personales** | Los datos de salud no salen del teléfono: cifrado AES-256, PIN opcional, sin servidor, cuentas ni analítica. Ver, exportar o borrar cuando quieras. [Cómo tratamos los datos](docs/privacidad.es.md) |

---

## 1. Impacto: el problema y el cambio que produce

### El problema

En una misión a Marte nadie en la Tierra puede seguir día a día la salud de cada astronauta, y la
ayuda está a meses de distancia. Hoy, tres cosas lo empeoran:

- **Los límites fijos avisan tarde.** Un umbral como "VO2max bajo el 80 % del valor previo al
  vuelo" se dispara cuando la pérdida ya ocurrió. Las personas son muy distintas, así que un límite
  poblacional queda demasiado holgado para unos o demasiado estricto para otros.
- **Los síntomas no se informan.** Se sabe que los astronautas informan de menos sus síntomas
  físicos y conductuales a los médicos de vuelo, por miedo a perder futuras misiones:
  > *"The fear of mission disqualification increases their reluctance to report medical
  > information."* ("El miedo a quedar fuera de una misión aumenta su reticencia a informar datos
  > médicos". Institute of Medicine, [*Safe Passage*](https://doi.org/10.17226/10218), 2001, cap. 6,
  > p. 174; también cap. 5, p. 140, y cap. 6, p. 183)

  > *"…the actual incidence may be underestimated due to the reluctance of astronauts to report
  > them."* ("La incidencia real puede estar subestimada por la reticencia de los astronautas a
  > informarlos". NASA, [OCHMO-TB-014 Behavioral Health Mishaps](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-014-behavioral-health-mishaps.pdf), Rev. B, 2023, resumen ejecutivo)

- **El enlace se corta.** Cada dos años el Sol bloquea la comunicación con Marte durante unas dos
  semanas (conjunción solar). Un software que depende de la Tierra deja de ayudar justo entonces.

### Qué cambia con PuduHealth

- **Alertas personales y más tempranas.** Cada valor se compara con el rango propio del astronauta.
  Una desviación sostenida se marca en ámbar antes de la línea roja de un estándar. Ejemplo
  simulado: escribimos un deterioro para la comandante (desde el día 135 duerme y entrena menos) y
  el simulador baja su VO2max como lo haría la falta de ejercicio. Sus primeros ámbar llegan 55 días
  antes del rojo de VO2max. Ilustra el mecanismo, no es una medición; la evidencia con datos reales
  es la prueba del detector más abajo.
- **Se le avisa a quien puede actuar.** El ejercicio y el sueño dependen del astronauta. La app le
  muestra cada día su propia tendencia, qué hacer y por qué, en vez de esperar a que alguien en la
  Tierra lo note en los datos descargados.
- **Privada por diseño.** Las respuestas detalladas nunca salen del dispositivo y van cifradas con
  AES-256. En una misión, el oficial médico vería sólo el semáforo, con permiso del astronauta
  (diseñado, aún no construido). Una pantalla clínica clara, sin el acompañante, indica cuándo
  llamarlo (fiebre, tamizaje de depresión).
- **Autónoma.** Todo funciona a bordo, sin conexión, en el propio dispositivo del astronauta.

### De vuelta en la Tierra: Chiloé

Lo construimos en Quemchi, en el archipiélago de Chiloé, sede local de Space Apps, donde el mismo problema existe en la Tierra.
En Chile, la atención diaria de una posta de salud rural la da un técnico en enfermería (TENS)
residente, y los médicos y otros profesionales llegan en rondas ([Revista Médica de Chile, 2025](https://www.revistamedicadechile.cl/index.php/rmedica/article/download/11124/38109/140209);
Norma Técnica 211, 2021). En las islas de Chiloé esas rondas van por mar, y el mal tiempo puede atrasar una lancha.

| Camino a Marte | En una posta rural de Chile |
|---|---|
| Un oficial médico de la tripulación, no un médico | Un técnico en enfermería (TENS) en la posta |
| Un límite fijo marca el problema cuando ya existe | Un paciente con hipertensión o diabetes puede alejarse de su rango por semanas entre rondas |
| Nadie en la Tierra sigue la tendencia diaria de cada astronauta | El médico ve al paciente en la próxima ronda |
| Evacuar no es una opción | Una lancha, cuando el tiempo lo permite |

La pregunta es la misma en ambos lugares: *¿esto es normal para esta persona, qué hago y cuándo
aviso?* El mismo motor (línea base personal, reglas citadas, cuándo avisar) podría apoyar a una
posta rural con otro conjunto de reglas. Una pieza ya funciona allá hoy: la frecuencia cardíaca
medida con la cámara de un celular común, como lo hicieron en sus casas las personas del conjunto
abierto de Welltory. El resto es una dirección que aún no construimos ni probamos, porque las reglas
actuales están escritas para astronautas.

Contexto local: [ronda de especialistas por mar en Isla Tac, Quemchi](https://www.minsal.cl/exitoso-operativo-dental-y-de-especialistas-en-isla-tac/) (Ministerio de Salud de Chile, 2017). Las rondas por mar siguen: [el patrullero Cirujano Videla de la Armada y equipos del Servicio de Salud en las islas de Chiloé durante 2025](https://www.24horas.cl/regiones/zona-sur/los-lagos/patrullero-cirujano-videla-atenciones-medicas-chiloe) (24 Horas, 2025). Camino a Marte no hay un Cirujano Videla interplanetario.

**Huella.** La app es un conjunto de archivos estáticos (HTML, JavaScript y un modelo de 1,6 KB).
No necesita servidores, nube ni cuentas. Funciona en un celular modesto, sin conexión, y cualquier
servidor web puede entregarla, desde GitHub Pages hasta un computador a bordo.

---

## 2. Creatividad: qué tiene de nuevo

- **Una plataforma, no un sensor.** Toda fuente (sensores propios, equipos de terceros, equipos de
  la nave, el registro diario) entrega mediciones por una API abierta (`puduhealth/v1`), y el motor
  las trata igual. El hardware se puede cambiar o agregar sin tocar la línea base, las reglas ni la
  app. [Documentación de la API](https://github.com/TecMedHub/puduhealth/wiki).
- **Cada persona es su propia referencia.** La mayoría de los sistemas de monitoreo compara a las
  personas con una población. La app aprende el rango de cada astronauta antes de la misión y vigila
  cuándo se aleja de él. En *Mi registro* cualquiera arma el suyo: los primeros 7 días calibran la
  línea base y desde el octavo cada valor se compara con ella.
- **La privacidad como medida de salud, no sólo como política.** El diseño parte de la evidencia de
  que los astronautas ocultan síntomas. Que las respuestas se queden en el dispositivo busca que sea
  más probable informar con honestidad.
- **Un acompañante que premia hábitos, no emociones.** El **Astropudú** es un pudú astronauta en
  pixel art (el ciervo más pequeño del mundo, nativo de Chiloé), diseñado por el equipo y dibujado
  por código en la app. Reacciona al registro, al sueño y al ejercicio. Nunca reacciona al contenido
  emocional de las respuestas y nunca castiga. Cuando aparece una pantalla clínica, se hace a un lado.
- **Un dato que falta no es un cero.** Si algo no se ha medido, la tarjeta dice cómo conseguirlo
  (registro diario, cámara, equipo de a bordo) en vez de mostrar un número engañoso. Las reglas
  semanales esperan a tener una semana completa de historia.
- **La cámara del celular, un adaptador alternativo.** Para el reto no teníamos hardware, así que
  construimos un adaptador: una medición de 60 segundos con la cámara y la linterna entrega la
  frecuencia cardíaca en reposo y la VFC, y el acelerómetro verifica que la persona estuviera quieta.
  Es una fuente más, no el producto.
- **Radiación real, reproducida.** La tripulación de ejemplo vive día a día lo que midió el
  instrumento RAD de Curiosity camino a Marte y en la superficie, incluidas las tormentas solares que
  registró.

---

## 3. Validez: ciencia y factibilidad

### Cómo decide

```
MEDIR ──► ESTIMAR (línea base personal, puntuación z, tendencia EWMA) ──► DECIDIR (reglas citadas) ──► ACTUAR
```

- **Línea base personal.** Para cada variable: media y desviación estándar de los días de línea base
  de la persona, la puntuación z de cada valor nuevo y una tendencia EWMA. Una variable se marca
  cuando dos valores seguidos llegan a z ≥ 2 en la dirección desfavorable, o cuando la EWMA se
  mantiene en ≥ 1,5 durante 10 mediciones.
- **Muchas variables, combinadas a la vista.** La app registra 17 tipos de medición. Ocho de ellas
  (frecuencia cardíaca en reposo, VFC, VO2max, sueño, ánimo, somnolencia, PHQ-9, temperatura) tienen
  su propia línea base y su detector de desviaciones. Las reglas las combinan de forma explícita: una
  alerta de infección exige que coincidan dos entre frecuencia cardíaca, temperatura y síntomas.
- **Los modelos sólo estiman; las reglas recomiendan.** Las 14 reglas son deterministas, auditables y
  citadas. El aprendizaje automático calibra el detector y estima el estrés agudo. Un modelo que
  mezclaba todas las variables no funcionó mejor con datos reales ([`ml/README.md`](ml/README.md),
  sección 5).
- **Ámbar** significa una desviación sostenida del rango propio de la persona. **Rojo** significa que
  se cruzó un umbral de un estándar o guía. Reglas y fuentes: [`app/js/reglas.js`](app/js/reglas.js)
  (español e inglés) y el [plan del proyecto](docs/plan.es.md).

### El modelo entrenado: estrés agudo

| | |
|---|---|
| **Qué estima** | La probabilidad de estrés agudo ahora, según cuánto sube la frecuencia cardíaca en reposo de hoy sobre la línea base de la persona |
| **Modelo** | Regresión logística, una entrada (FC − línea base personal), 1,6 KB: [`app/modelos/estres.json`](app/modelos/estres.json) |
| **Datos de entrenamiento** | WESAD (Schmidt et al. 2018): 15 personas, ECG de pecho, reposo frente a una prueba de estrés estandarizada |
| **Validación** | Dejando fuera a una persona completa: **AUC 0,93 ± 0,15**, exactitud balanceada 0,83, falsos positivos en reposo 8 %. Con PPG de muñeca en vez de la FC del ECG, el AUC baja a 0,57 |
| **En la app** | Corre en el teléfono sobre la FC en reposo de hoy **de cualquier fuente** que llegue por la API (banda de pecho, reloj, equipo de la nave, cámara), en *Datos → Estrés agudo (modelo)*, con su explicación |
| **Por qué importa para la plataforma** | Rinde mejor con un sensor de calidad ECG, como una banda de pecho conectada por la API, que con la cámara como alternativa |
| **Límites** | No distingue el estrés de otras causas de una FC alta (enfermedad, ejercicio, cafeína); informa, y las reglas deciden |

Script de entrenamiento: [`ml/entrenar_estres.py`](ml/entrenar_estres.py); método y resultados: [`ml/README.md`](ml/README.md), sección 1.

### Evidencia

| Qué | Resultado | Datos |
|---|---|---|
| Detector de desviaciones, falsas alarmas | 2,5 % de días con alerta de frecuencia cardíaca en la vida diaria | PMData, 14 personas, ~5 meses |
| Detector de desviaciones, sensibilidad | Un alza sostenida de +5 lpm se marca en 3 días (mediana) | PMData con un alza agregada |
| Frecuencia cardíaca del algoritmo PPG de la app | Error mediano de 0,8 lpm contra ECG de pecho en reposo | WESAD |
| Modelo de estrés agudo | AUC 0,93 dejando fuera a una persona | WESAD, 15 personas |
| Reglas inmunes | 100 % de las enfermedades simuladas detectadas, retraso mediano de 1 día, 0,05 % de días sanos con alerta | 30 misiones simuladas |
| Señal de frecuencia cardíaca en infecciones reales | Pequeña pero sostenida: mediana de +1,9 lpm (reloj, 9 personas) y +1,4 lpm (cámara del celular, 6), días 0 a 14 desde los síntomas. Muestra chica; se usó para ajustar el simulador | Datos abiertos de COVID-19 de Welltory |
| Código | 64 pruebas automáticas (motor, reglas, entrada, simulador, caché sin conexión, Mi registro, cifrado) | `cd app && npm test` |

Scripts y resultados completos: [`ml/README.md`](ml/README.md).

### Factible hoy

- **Funciona en cualquier parte.** Archivos estáticos sin backend. Se instala como app de celular
  (manifiesto web y service worker) y se puede usar por completo sin conexión después de la primera
  visita.
- **API abierta.** Un solo formato de medición, `{ tipo, valor, persona?, dia?, fuente?, calidad? }`,
  con unidades verificadas (una temperatura en °F se rechaza en vez de entrar mal). Construido hoy:
  `window.puduHealth.registrar(...)` en la página, importación JSON / JSON Lines / CSV (*Ajustes →
  Mis datos → Importar*, [archivo de ejemplo](docs/ejemplo-mediciones.csv)) y el adaptador de la
  cámara. Documentación: [wiki de la API](https://github.com/TecMedHub/puduhealth/wiki) y [`docs/conexion.md`](docs/conexion.md).
- **Cifrada en reposo.** AES-GCM de 256 bits con una llave del dispositivo no exportable, o con una
  llave derivada de un PIN opcional (PBKDF2-SHA-256, 600 000 iteraciones). Detalles y límites:
  [tratamiento de datos personales](docs/privacidad.es.md).
- **Camino al hardware.** Proponemos los perfiles estándar de Bluetooth Low Energy Heart Rate y
  Health Thermometer, para que funcione cualquier banda de pecho o reloj compatible. Ese adaptador aún
  no está construido.

### Qué es real y qué es simulado

| Real | Simulado |
|---|---|
| *Mi registro*: tus propias mediciones de cualquier fuente (API, archivo, adaptador de la cámara) y registros diarios, guardados sólo en tu dispositivo | *Misión de ejemplo*: una tripulación de cuatro personas (`app/js/simulador.js`, reproducible a partir de una semilla) en una misión completa de 860 días a Marte, o el viaje de ida de 210 días que muestra el video (`?escenario=transito`) |
| La API abierta, la importación de archivos y el adaptador de la cámara | Eventos de enfermedad, falta de sueño y conflicto en la tripulación de ejemplo |
| Modelo de estrés y detector de desviaciones, entrenado y calibrado con datos públicos | Dosis de radiación, a partir de las tasas de MSL RAD en tránsito y en la superficie |

**Es un prototipo de hackatón. No es un dispositivo médico y no está validado clínicamente.** Las
limitaciones están en el [plan del proyecto](docs/plan.es.md), sección 13.

---

## 4. Pertinencia: el reto y los datos

### Qué pide el reto y dónde está

| El astronauta… | Cómo |
|---|---|
| reúne indicadores | De cualquier sensor o equipo médico por la API abierta (de diseño propio o de terceros), más un registro diario de 10 segundos. La cámara del celular sirve como adaptador alternativo |
| evalúa | Un semáforo de cinco riesgos (cardiovascular, hueso y músculo, conductual, inmune, radiación) y tendencias dibujadas contra el rango personal |
| actúa | Cada alerta entrega la acción y su fuente. Una pantalla clínica clara, sin el acompañante, aparece cuando hay que contactar al oficial médico |
| entiende | Tocar cualquier indicador explica qué es, cómo se mide en el espacio, por qué importa allá, los peligros del vuelo espacial de NASA relacionados, cuándo pedir ayuda y qué hacer |
| se mantiene | El Astropudú, y un registro lo bastante corto como para hacerlo todos los días |

### Datos y recursos de NASA

| Recurso | Uso |
|---|---|
| NASA-STD-3001 Vol. 1 Rev. C | Umbrales de VO2max, límite de radiación de carrera, límites expresados como % del valor previo a la misión |
| Informes técnicos de OCHMO TB-030 (pérdida ósea), TB-031 (ejercicio), TB-020 (radiación) | Tasa de pérdida ósea, prescripción de ejercicio, límites de dosis |
| MSL RAD en Curiosity (Zeitlin et al. 2013; Hassler et al. 2014; Guo et al. 2015), datos crudos en el Planetary Data System de NASA | La tripulación de ejemplo vive día a día lo que midió Curiosity: la tasa de dosis del crucero y sus cinco tormentas solares, y luego la tasa en la superficie y la tormenta solar del sol 242. También alimenta la proyección de dosis |
| Mars Design Reference Architecture 5.0 (NASA, 2009) | Forma de la misión completa: unos 180 días de ida, 500 en la superficie y 180 de regreso |
| NASA Human Research Program: [5 peligros](https://www.nasa.gov/hrp/hazards/), [riesgos](https://www.nasa.gov/hrp/risks/), [investigación en curso](https://www.nasa.gov/hrp/ongoing-hrp-research/) | Elección de los riesgos; peligros mostrados en cada explicación |
| Earth Independent Medical Operations (EIMO) | El llamado de NASA a contar con apoyo a la decisión clínica a bordo, con tendencias y alertas tempranas |
| OCHMO-TB-014 Behavioral Health Mishaps (2023) | La reticencia de los astronautas a informar problemas de salud conductual; por qué las respuestas son privadas |
| Estudios financiados por NASA: Moore et al. 2014 (VO2peak en la ISS), Barger et al. 2014 (sueño en vuelo espacial), Mehta et al. 2017 (reactivación de virus latentes) | Explicaciones y reglas inmunes |

### Otras fuentes científicas

| Recurso | Uso |
|---|---|
| Agencia Espacial Canadiense: [Bio-Monitor](https://asc-csa.gc.ca/eng/sciences/astroskin.asp), [monitoreo de radiación](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp), [ciencia en el espacio](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) | Qué se puede medir a bordo |
| WESAD (Schmidt et al. 2018) | Entrenamiento del modelo de estrés agudo, el único modelo entrenado |
| PMData (Thambawita et al. 2020) | Calibración del detector de línea base personal |
| Welltory COVID-19 and Wearables Open Data (CC0) | Prueba de la señal de frecuencia cardíaca en infecciones reales |
| AASM/SRS 2015, Kroenke et al. 2001 (PHQ-9), OMS 2020, Cohen et al. 2009, Stahn et al. 2017 | Umbrales y explicaciones |
| Institute of Medicine 2001, *Safe Passage: Astronaut Care for Exploration Missions* | Subregistro de síntomas ante los médicos de vuelo por miedo a perder futuras misiones |

Los conjuntos de datos de terceros no se guardan en este repositorio, sólo el código que los
descarga y procesa. Lista completa con enlaces: [plan del proyecto](docs/plan.es.md), sección 15.

---

## 5. La app

- **API abierta para equipos.** *Conectar sensor*, en la pantalla principal, muestra las fuentes con
  su estado (Bluetooth estándar: diseñado; importar de un equipo y API para desarrolladores:
  funcionan; cámara del celular: alternativa). Sensores y equipos envían mediciones en el formato `puduhealth/v1`;
  la app las muestra con la misma línea base y las mismas reglas, venga de donde venga ([wiki de la API](https://github.com/TecMedHub/puduhealth/wiki)).
- **Celular primero, instalable.** Cuatro secciones en una barra inferior: **Pudú** (acompañante,
  registro, medición), **Hoy** (estado general, cinco riesgos, alertas), **Datos** (indicadores con
  su tendencia de 30 días) y **Tendencias** (gráficos que se leen con el dedo, en 30 días, 90 días o
  la misión completa). En pantallas anchas se ven juntas en dos columnas.
- **Dos modos.** *Mi registro* es la app propiamente tal, con tus datos en tu dispositivo. La *misión
  de ejemplo* muestra la tripulación simulada; ahí se puede elegir tripulante y recorrer los días. Se
  elige al terminar la introducción y se cambia en Ajustes.
- **Español e inglés** (`?lang=en`). Tres temas de color sacados de la historia del proyecto:
  Astropudú, Chiloé y Marte.
- **Tus datos son tuyos.** Cifrados en el dispositivo, con PIN opcional. Se exportan en el formato
  abierto, o se borran. *Ajustes → Cómo tratamos tus datos* lo explica en la app.

---

## 6. Datos personales

PuduHealth trata datos de salud, que son datos sensibles. En resumen:

| | |
|---|---|
| **Qué** | Sólo lo que la persona registra y el resultado de las mediciones con la cámara. Nunca se guardan imágenes |
| **Dónde** | Sólo en el dispositivo de la persona. Sin servidor, cuentas, publicidad ni analítica; la app no envía datos personales a ninguna parte |
| **Cómo** | Cifrado AES-GCM de 256 bits en reposo; la llave queda envuelta por una llave del dispositivo no exportable o por un PIN opcional |
| **Cuánto tiempo** | Hasta que la persona los borra; borrar elimina los datos y la llave |
| **Derechos** | Acceso, rectificación, supresión y portabilidad (exportar en el formato abierto), desde Ajustes |
| **Nuestro estudio** | El pulsómetro usó códigos de participante, consentimiento informado, almacenamiento en el servidor fuera del alcance web y borrado a pedido o a los 12 meses |

Política completa, marco de referencia (leyes chilenas 19.628, 21.719 y 20.584; RGPD, artículos 9
y 25) y límites conocidos: [tratamiento de datos personales](docs/privacidad.es.md).

---

## Uso de IA

Como exige el reglamento de Space Apps, estas son las partes donde se usaron herramientas de IA:

- **Código y documentación:** escritos con un asistente de programación con IA (Claude, de Anthropic), y
  revisados y probados por el equipo (`cd app && npm test`). Las traducciones de los documentos también
  tuvieron asistencia de IA.
- **Investigación y análisis:** la IA ayudó a buscar y verificar fuentes. Cada cifra sale de los documentos
  citados o de los scripts de [`ml/`](ml/), corridos sobre los conjuntos de datos públicos.
- **Narración del video:** voces sintéticas de IA (Microsoft neural TTS: `en-US-AndrewNeural`,
  `es-CL-CatalinaNeural`, vía `edge-tts`). Cada video lo indica en pantalla y en sus metadatos.
- **Ilustración del Astropudú** (logo, íconos de la app, tarjeta para redes): generada con IA a partir de un
  diseño del equipo, y marcada "AI-generated art" en cada imagen. El acompañante en pixel art dentro de la
  app está dibujado por código.
- **Sin IA:** la música (Benjamín Catipillan-Ulloa), las reglas y sus umbrales (de los estándares citados) y
  las mediciones. No se usan logos ni marcas de NASA.

## Repositorio

| Carpeta | Contenido |
|---|---|
| [`index.html`](index.html) | Sitio del proyecto: accesos a la app y al pitch, y los videos |
| [`app/`](app/) | La plataforma: API abierta para equipos, línea base personal, motor de reglas, interfaz, acompañante, adaptador de la cámara, simulador, con pruebas |
| [`ml/`](ml/) | Scripts de entrenamiento, calibración y evaluación con conjuntos de datos públicos |
| [`docs/`](docs/) | Plan del proyecto en [español](docs/plan.es.md) e [inglés](docs/plan.en.md): idea, reglas, fuentes, limitaciones. [Tratamiento de datos personales](docs/privacidad.es.md) ([inglés](docs/privacidad.en.md)). Especificación de conexión de datos |
| [`pitch/`](pitch/) | Las 7 diapositivas del pitch (HTML, español e inglés), con la app funcionando adentro |
| [`video/`](video/) | El video de demostración de 30 segundos en español e inglés, 16:9 y 9:16 (Instagram), y su generador, grabado desde la app real. Tema musical original compuesto por Benjamín Catipillan-Ulloa |
| [`pulsometro/`](pulsometro/) | Primer prototipo: monitor de frecuencia cardíaca con cámara usado para reunir nuestras propias grabaciones (HTML + PHP) |

## Ejecutar

```bash
python3 -m http.server 8080      # desde la raíz del repositorio
# abrir http://localhost:8080/app/

cd app && npm test               # Node 20 o superior
```

La cámara y el cifrado necesitan HTTPS (o `localhost`): `cd app && npm run https` la sirve en la
red local. Diapositivas: <http://localhost:8080/pitch/es/>.

### Publicar en GitHub Pages

Todo es estático, así que GitHub Pages lo sirve tal cual: en el repositorio, *Settings → Pages →
Deploy from a branch → `main` / raíz*. La app queda en `https://<usuario>.github.io/<repo>/app/` y
las diapositivas en `.../pitch/` (en inglés; en español, `.../pitch/es/`), ambas por HTTPS.

---

## Equipo

| Nombre | Space Apps |
|---|---|
| Nicolás Baier Quezada (owner) | `@debaq` |
| Vanessa Soledad Uribe Hernández | `@vanessa_uribe` |
| Benjamín Catipillan-Ulloa | `@pukem` |
| Haydeé Valentina Barrientos Toledo | `@chochoca` |
| Fernanda Andrea López Moncada | `@fernandandrea` |

## Sobre TecMedHub

Laboratorio de ciencia aplicada de la Universidad Austral de Chile (Puerto Montt). Resolvemos problemas reales con tecnología, desde el sur de Chile. Código abierto.

🌐 [tecmedhub.org](https://tecmedhub.org) · 💻 [github.com/TecMedHub](https://github.com/TecMedHub)

## Licencia

[MIT](LICENSE) © 2026 TecMedHub
