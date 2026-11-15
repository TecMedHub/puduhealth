# Pulsómetro PPG — protocolo de pruebas (HTML + PHP)

Mide la frecuencia cardíaca con la cámara y el flash del celular (fotopletismografía)
y guarda en el servidor un JSON por participante y por prueba, con timestamps.
Los participantes se identifican sólo con un **código** (`P-XXXX`): nunca se pide ni se guarda el nombre.

> Prototipo de hackatón. **No es un dispositivo médico.**

## Uso

1. Al entrar por primera vez, la página muestra el **consentimiento informado**. Hay que marcar
   *Leí y acepto participar* para poder grabar. Luego el celular genera un **código de participante**
   al azar (por ejemplo `P-7KQ2`) y lo muestra arriba: la persona debe **anotarlo**, porque sirve para
   pedir que se borren sus datos. Quien ya tiene un código puede escribirlo con **Usar otro código**.
   El código queda recordado en el celular; cada cambio de código abre una nueva *sesión*.
2. Inicie la cámara (o el **modo demo** para probar), apoye el dedo sobre la cámara y el flash, y pulse una prueba:

   | Prueba | Duración |
   |---|---|
   | Descanso | 10 min |
   | Trotar | 10 min |
   | Correr | 2 min |
   | Recuperación | 10 min |

3. Cada prueba muestra una cuenta regresiva, **se detiene sola** al cumplir el tiempo, **se guarda en el
   celular** y se sube automáticamente al servidor. **Terminar** la cierra antes de tiempo como incompleta.
   Al terminar, la app pregunta el **esfuerzo percibido con la escala de Borg** (6–20, ver más abajo):
   así cada prueba queda con la FC medida **y** lo que la persona sintió. La prueba se sube cuando se
   responde (o se pulsa **Omitir**); mientras tanto ya está guardada en el celular.

   | Borg | En pantalla | Descripción guardada |
   |---|---|---|
   | 6 | Nada | Sin esfuerzo |
   | 7 | Extr. ligero | Extremadamente ligero |
   | 8 | Extr. ligero + | Un poco más que «Extremadamente ligero», sin llegar a «Muy ligero» |
   | 9 | Muy ligero | Muy ligero |
   | 10 | Muy ligero + | Un poco más que «Muy ligero», sin llegar a «Ligero» |
   | 11 | Ligero | Ligero |
   | 12 | Ligero + | Un poco más que «Ligero», sin llegar a «Algo duro» |
   | 13 | Algo duro | Algo duro |
   | 14 | Algo duro + | Un poco más que «Algo duro», sin llegar a «Duro» |
   | 15 | Duro | Duro |
   | 16 | Duro + | Un poco más que «Duro», sin llegar a «Muy duro» |
   | 17 | Muy duro | Muy duro |
   | 18 | Muy duro + | Un poco más que «Muy duro», sin llegar a «Extremadamente duro» |
   | 19 | Extr. duro | Extremadamente duro |
   | 20 | Máximo | Esfuerzo máximo |

   En la escala original los pares no tienen texto; las etiquetas "+" son una ayuda de pantalla.
   Se pregunta sólo por la prueba que se estaba grabando (no al terminar desde la lista una que estaba
   en pausa) y no se puede agregar después de subirla. Si se cierra la página con la pregunta abierta,
   la prueba se sube después sin Borg (`"borg": null`).

4. **Pausar** detiene la grabación sin cerrarla. Mientras está en pausa se pueden ver o grabar otras pruebas;
   al tocar de nuevo la prueba (o **Reanudar** en la lista) sigue donde quedó. Una prueba también se
   pausa sola si se oculta la pantalla, se apaga la cámara o se cambia de código, y si se cierra la
   pestaña o se cae el navegador se recupera **en pausa** al volver a abrir la página (se pierden a lo
   más los últimos 15 s). Se puede tener una prueba en pausa por cada prueba del protocolo.
5. Volver a grabar una prueba ya hecha crea **otro intento**: los anteriores se conservan, en el celular y
   en el servidor (cada intento es un archivo distinto).
6. Abajo del protocolo está la lista **Pruebas de (código)**: todo lo grabado con ese código en este celular,
   con su estado (completa / incompleta / en pausa, ✓ en el servidor / ⚠ sin subir), **Ver en el visor** y
   **Descargar JSON**.

### Lo que queda guardado en el celular

Todo se guarda en el navegador del celular (IndexedDB) y **no se borra al subirlo al servidor**: sólo se
marca como subido. Si falla la conexión, las pruebas sin subir se reintentan solas al volver la conexión o
al abrir la página, o con **Reintentar subir**. La lista agrupa por código, así que se ven las
pruebas aunque se haya cambiado de código y se vuelva a escribir el mismo.

Los datos del celular sólo se pierden si se borran los datos del sitio en el navegador (o se desinstala el
navegador). La app le pide al navegador almacenamiento persistente para que no los borre por falta de espacio.

| Clave en IndexedDB (`pulsometro` → `pruebas`) | Contenido |
|---|---|
| `p_<inicio_ms>_<prueba>` | prueba terminada: `datos` (lo que se envía al servidor), `subida`, `archivo`, `resumen` |
| `pausa_<código>_<prueba>` | prueba en pausa, con todo lo necesario para reanudarla |
| `en_curso` | copia cada 15 s de la prueba que se está grabando |

## Privacidad y consentimiento

Los datos de frecuencia cardíaca ligados a un nombre serían datos personales sensibles, por eso:

- **No se pide ni se guarda el nombre.** El servidor rechaza cualquier envío que traiga un campo `nombre`.
- **Seudónimo:** cada persona tiene un código aleatorio `P-XXXX` (4 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`)
  generado en su celular. Los datos se vinculan sólo a ese código.
- **Consentimiento informado** antes de la primera grabación (versión `1`). Se explica qué se registra
  (señal de color de la yema del dedo, frecuencia cardíaca, movimiento, esfuerzo percibido opcional y horas
  de las pruebas), para qué (desarrollar y validar la medición de PuduHealth: NASA Space Apps Challenge 2026,
  TecMedHub, Universidad Austral de Chile), que no se guardan nombre, fotos ni video (sólo promedios de color
  por cuadro), cuánto se conservan, que la participación es voluntaria y que **no es un dispositivo médico**.
  Cada envío al servidor incluye `consentimiento: { version, fecha }`; sin él, `guardar.php` lo rechaza.
- **Qué se guarda y dónde:** un JSON por prueba (ver **Formato del JSON**) en la carpeta de datos del servidor
  del equipo, que **no se puede leer por la web**: los `.htaccess` (`datos/` e `inc/`, más la regla del
  `.htaccess` principal) lo bloquean, y el sitio sólo escribe. Los datos se descargan únicamente por SFTP/SSH.
  El análisis posterior se hace con los datos sin identificación personal.
- **Conservación:** los datos se borran a más tardar **12 meses después de recogerlos**, o antes si la
  persona lo pide.
- **Retiro y borrado:** cualquier participante puede retirarse y pedir el borrado de sus datos en cualquier
  momento **entregando su código al equipo**. El equipo borra la carpeta `datos/P-XXXX/` del servidor
  (`rm -r /var/lib/pulsometro/P-XXXX`). Los datos que quedaron en el celular se eliminan borrando los datos
  del sitio en el navegador.

## Dónde quedan los datos

```
datos/
└── P-7KQ2/                                            una carpeta por código de participante
    ├── 20261114-153000_descanso_9f2c41a0b7e3.json     fecha-hora de inicio _ prueba _ código aleatorio
    ├── 20261114-154200_trotar_1d77e0c2a95b.json
    ├── 20261114-155300_correr_c03be9917f40.json
    └── 20261114-155700_recuperacion_58aa1e0d4c26.json
```

La carpeta se configura con `dir_datos` (ver **Configuración**). **Por la web no hay ninguna forma de leer,
listar ni borrar los datos**: el sitio sólo los recibe. Para bajarlos use SFTP/SSH, por ejemplo:

```bash
scp -r usuario@su-servidor:/var/lib/pulsometro ./datos-pulsometro
```

### Formato del JSON

```json
{
    "formato": "pulsometro-ppg/1",
    "participante": { "codigo": "P-7KQ2", "carpeta": "P-7KQ2" },
    "consentimiento": { "version": "1", "fecha": "2026-11-14T15:20:00-03:00" },
    "sesion_id": "a1b2c3d4e5f6",
    "prueba": { "codigo": "trotar", "nombre": "Trotar", "duracion_objetivo_s": 600 },
    "completa": true,
    "borg": { "escala": "Borg RPE 6-20", "valor": 13, "etiqueta": "Algo duro", "descripcion": "Algo duro",
              "respondido": "2026-11-14T15:52:20.512-03:00", "respondido_ms": 1794684740512 },
    "origen": "camara",
    "inicio": "2026-11-14T15:42:00.123-03:00",  "inicio_ms": 1794684120123,
    "fin":    "2026-11-14T15:52:00.140-03:00",  "fin_ms":    1794684720140,
    "duracion_s": 600.017,
    "recibido": "2026-11-14T15:52:01-03:00",
    "dispositivo": { "navegador": "Mozilla/5.0 (Linux; Android 14…)", "fps_medio": 30.0 },
    "resumen": { "fc_media_lpm": 128.4, "fc_min_lpm": 96.0, "fc_max_lpm": 151.2,
                 "segundos_con_fc": 512, "calidad_media": 63, "n_muestras": 18001 },
    "columnas_muestras": ["t_s", "timestamp_ms", "r", "g", "b"],
    "columnas_fc": ["timestamp_ms", "fc_lpm", "calidad"],
    "columnas_eventos": ["timestamp_ms", "tipo"],
    "eventos": [[1794684120120, "inicio"], [1794684120160, "dedo_apoyado"], …, [1794684720141, "fin"]],
    "fc":       [[1794684121130, 98.2, 85], [1794684122131, null, null], …],
    "movimiento": [[1794684121130, 0.084], [1794684122131, 1.92], …],
    "muestras": [[0.0, 1794684120123, 205.31, 27.9, 14.02], …]
}
```

- `muestras`: cada cuadro de la cámara (≈30 por segundo): `t_s` = **segundos grabados** (no cuenta las
  pausas, así la señal queda continua), **timestamp Unix (ms)** con la hora real (ahí sí se ven los huecos
  de las pausas) y promedio de los canales rojo, verde y azul (0–255). Son datos crudos: se pueden reprocesar.
- `fc`: frecuencia cardíaca estimada en el celular **cada segundo**, con su calidad (0–100). `null` = sin señal válida.
- `movimiento`: aceleración del celular (RMS del último segundo, m/s², sin gravedad) **cada segundo**.
  Sobre `umbral_movimiento` (0,5 m/s²) hubo movimiento y la FC de ese tramo no es confiable: el PPG con
  cámara falla en movimiento, y un movimiento periódico como el braceo al trotar puede parecer un pulso
  limpio y engañar a la calidad. `null` = el equipo no entregó datos del acelerómetro.
- `eventos`: `inicio`, `fin`, `detenida`, `pausa`, `reanudada`, `interrumpida`, `dedo_apoyado`,
  `dedo_retirado`, `pantalla_oculta`, `pantalla_visible`.
- `duracion_s` (= `fin` − `inicio`) es tiempo real e incluye las pausas; el tiempo grabado es el último `t_s`.
  El servidor acepta hasta 12 h entre inicio y fin.
- `resumen`: lo calcula el servidor con los segundos de calidad ≥ 40.
- `borg`: esfuerzo percibido (escala de Borg 6–20) respondido al terminar la prueba, con su hora.
  `etiqueta` es lo que decía el botón y `descripcion` el texto completo (ver la tabla de **Uso**);
  `borg` es `null` si no se respondió.
- `sesion_id` agrupa las pruebas de un mismo código en una misma visita.
- `consentimiento`: versión del texto aceptado y fecha de aceptación (la fecha la envía el celular).
- Los registros anteriores al uso de códigos pueden traer `participante.nombre`; el visor los muestra como
  «(registro anterior)». Deben borrarse o seudonimizarse en el servidor.

Para leerlo en Python:

```python
import json, pandas as pd
j = json.load(open('datos/P-7KQ2/20261114-154200_trotar_1d77e0c2a95b.json'))
muestras = pd.DataFrame(j['muestras'], columns=j['columnas_muestras'])
fc = pd.DataFrame(j['fc'], columns=j['columnas_fc'])
```

El **Visor** del sitio abre estos JSON (y también CSV `t,r,g,b`) directamente en el navegador.

---

## Instalación en el servidor

**Requisitos:** PHP 7.4 o superior (probado con 8.5) con la extensión `mbstring` (viene en casi
todos los hostings). No usa base de datos ni librerías externas.

1. Copie la carpeta `pulsometro/` completa, **incluidos los archivos ocultos `.htaccess`**.
2. **Carpeta de datos fuera del sitio público (recomendado):**
   ```bash
   sudo mkdir -p /var/lib/pulsometro
   sudo chown www-data:www-data /var/lib/pulsometro   # en Arch/CachyOS el usuario es "http"
   sudo chmod 770 /var/lib/pulsometro
   ```
   y en `config.local.php` (ver **Configuración** más abajo): `'dir_datos' => '/var/lib/pulsometro',`.
   Si la deja en `pulsometro/datos/`, dele permiso de escritura al usuario del servidor web
   (`sudo chown -R www-data:www-data datos && sudo chmod 770 datos`).
3. **HTTPS es obligatorio** para usar la cámara del celular. Instale un certificado
   (`sudo certbot --apache` o `--nginx`) y active `'forzar_https' => true` en `config.local.php`.
   Detrás de un proxy que termina TLS, el proxy debe enviar `X-Forwarded-Proto: https`.

### Configuración

`config.php` trae los valores por defecto y **está en el repositorio: no lo edite en el servidor**.
Cree en el servidor un `pulsometro/config.local.php` sólo con lo que cambia:

```php
<?php
return [
    'dir_datos'    => '/var/lib/pulsometro',
    'forzar_https' => true,
];
```

`config.local.php` está en `.gitignore` (nunca se sube al repo) y la web lo bloquea igual que
`config.php`. Claves disponibles: `dir_datos`, `forzar_https`, `zona_horaria`,
`max_guardados_por_hora_ip`, `max_espacio_mb`.

**Nunca suba al repositorio:** la carpeta `datos/` (datos de salud), `config.local.php`, claves,
contraseñas, IPs o nombres del servidor. El `.gitignore` ya excluye los casos habituales.

### Apache

No hace falta nada más: los `.htaccess` bloquean `datos/`, `inc/`, `config.php`, los archivos
ocultos y los respaldos, desactivan el listado de carpetas y agregan cabeceras de seguridad.
Necesitan `AllowOverride All`. Si el sitio responde **500**, el hosting no permite `Options`:
borre sólo la línea `Options -Indexes` del `.htaccess` principal.

### Nginx (importante)

Nginx ignora los `.htaccess`. **Si los datos quedan dentro del sitio, agregue estas reglas**
al bloque `server` (ajuste la ruta), o mueva `dir_datos` fuera del sitio público:

```nginx
autoindex off;
location ~ ^/pulsometro/(datos|inc)/ { return 404; }
location ~ ^/pulsometro/(config.*\.php|README\.md)$ { return 404; }
location ~ /\. { return 404; }
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
location ~ ^/pulsometro/assets/.*\.(js|css)$ { add_header Cache-Control no-cache; }
```

### Verificar después de subir

```bash
SITIO=https://su-dominio/pulsometro
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/                    # 200
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/datos/              # 403 o 404
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/datos/.htaccess     # 403 o 404
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/config.php          # 403 o 404
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/config.local.php    # 403 o 404
curl -s -o /dev/null -w '%{http_code}\n' $SITIO/guardar.php         # 405 (sólo acepta POST)
```

**¿Quedó subida la última versión?** Al pie de cada página aparece `Versión xxxxxxxx`, una huella de todo
el código. Compárela con la de su copia local:

```bash
cd pulsometro && php -r 'require "inc/plantilla.php"; echo version_app(), "\n";'
```

Si no coinciden, falta subir algún archivo. Si coinciden pero la página sigue igual, el servidor puede
tener OPcache sin revisar cambios (`opcache.validate_timestamps=0`): reinicie PHP-FPM o Apache.
No hace falta forzar la recarga en el navegador: el HTML no se guarda en caché y el JS/CSS se piden
con `?v=<huella del contenido>`, así que cambian de URL cada vez que cambian.

Luego haga una prueba completa en **modo demo** y compruebe que aparece el JSON en la carpeta de datos.

## Seguridad

El sitio no tiene clave de acceso; en su lugar:

- **Sólo escritura:** `guardar.php` recibe pruebas y no existe ninguna ruta para leer, listar ni borrar datos.
- **Sólo desde la propia página:** exige JSON y la cabecera `X-Pulsometro`, y compara el `Origin`.
  Otra web no puede enviar datos (el navegador lo bloquea por CORS).
- **Validación estricta:** código de participante (`P-XXXX`), consentimiento con versión y fecha, prueba del protocolo, tipos,
  rangos (colores 0–255, tiempos crecientes, timestamps dentro de la prueba), máximo 6 MB.
- **Nombres de carpeta seguros:** la carpeta es el código (`P-7KQ2`): sólo `A-Z`, `2-9` y `-`;
  no se puede salir de la carpeta de datos.
- **Sin nombres:** un envío con campo `nombre` se rechaza y no se guarda nada.
- **Nombres de archivo imposibles de adivinar:** sufijo aleatorio de 48 bits.
- **Contra abuso:** máximo de guardados por hora por IP (`max_guardados_por_hora_ip`, la IP se
  guarda sólo como hash) y espacio máximo en disco (`max_espacio_mb`).
- **Escritura atómica:** nunca queda un JSON a medias.
- **Cabeceras:** CSP estricta (sin scripts en línea, sólo conexiones al propio sitio), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (sólo cámara), `no-store` y HSTS bajo HTTPS.
- **Sin sesiones ni cookies.** Los errores de PHP van al log del servidor, nunca a la pantalla.

Como no hay clave, cualquiera que conozca la URL puede **enviar** pruebas, pero nunca **ver**
las de otros. Si eso fuera un problema, se puede limitar el acceso por IP o agregar una clave.

## Desarrollo local

```bash
cd pulsometro
php -S 0.0.0.0:8000
```

Abra `http://localhost:8000`. Para probar la cámara desde el celular sin certificado use un
túnel HTTPS (`cloudflared tunnel --url http://localhost:8000` o `ngrok http 8000`).
Use **Chrome en Android**: en iPhone la linterna no se puede encender desde la web.

## Estructura

```
pulsometro/
├── index.php            medición en vivo + protocolo de pruebas
├── visor.php            visor de JSON/CSV (local, en el navegador)
├── guardar.php          recibe y guarda las pruebas (sólo POST)
├── config.php           configuración por defecto (versionada)
├── config.local.php     configuración del servidor (NO versionada; se crea en el servidor)
├── .htaccess            protección para Apache
├── inc/
│   ├── nucleo.php       cabeceras de seguridad
│   ├── datos.php        protocolo, carpetas, límites, escritura
│   └── plantilla.php    encabezado y pie comunes
├── assets/
│   ├── ppg.js           procesamiento de señal
│   ├── movimiento.js    detección de movimiento con el acelerómetro (compartido con app/)
│   ├── grafico.js       gráficos en <canvas>, sin librerías
│   ├── app.js           cámara, análisis en vivo, pruebas, respaldo y envío
│   ├── visor.js         análisis completo de un archivo
│   └── estilo.css
└── datos/               JSON guardados (si no se cambió dir_datos)
```

## Algoritmo (`assets/ppg.js`)

1. Remuestreo a 30 Hz exactos (los cuadros de la cámara no llegan a intervalos fijos).
2. Quitar la tendencia lineal e invertir la señal (más sangre = imagen más oscura).
3. Pasabanda 0,7–3,5 Hz (42–210 lpm): Butterworth de orden 2 aplicado ida y vuelta, sin desfase.
4. **Espectro** (DFT con ventana de Hann): pico dominante, con corrección de armónicos para FC baja.
5. **Picos**: máximos locales con distancia mínima fijada a partir del espectro; se descartan
   picos bajos (muesca dícrota) y los de los bordes.
6. FC = mediana de los intervalos entre latidos. Si coincide con el espectro (±5 lpm) se promedian.
7. **Calidad (0–100)**: periodicidad del espectro, acuerdo entre ambos métodos y regularidad
   (detalle en **Cómo se calcula la calidad**).
8. VFC: RMSSD y SDNN con intervalos consecutivos y cercanos a la mediana.

Probado con señales sintéticas de 42 a 190 lpm: error menor a 2 lpm salvo a 190 lpm (≈ 5 lpm).
**Falta validarlo con personas reales**, en especial durante Trotar y Correr, donde el movimiento
del dedo sobre la cámara genera mucho ruido. Compare contra un oxímetro o una banda Polar H10.

### Cómo se calcula la calidad

Función `calidad()` en `assets/ppg.js`, llamada desde `analizar()`. Combina tres indicadores,
cada uno llevado a una escala de 0 a 1:

| Indicador | Qué mide | Escala | Peso |
|---|---|---|---|
| **s1 – Periodicidad** | Fracción de la potencia del espectro que cae en la fundamental y sus armónicos (±0,15 Hz) | concentración ≤ 0,1 → 0 · ≥ 0,5 → 1 | 40 % |
| **s2 – Acuerdo entre métodos** | Diferencia entre la FC por picos (`bpmTiempo`) y por espectro (`bpmFrec`) | ≤ 3 lpm → 1 · ≥ 13 lpm → 0 | 30 % |
| **s3 – Regularidad** | Coeficiente de variación (desviación / media) de los intervalos entre latidos | CV ≤ 0,08 → 1 · ≥ 0,28 → 0 | 30 % |

```
puntaje = round(100 · (0,4·s1 + 0,3·s2 + 0,3·s3))
```

| Puntaje | Etiqueta | Barra |
|---|---|---|
| ≥ 70 | Buena | verde |
| 40–69 | Regular | ámbar |
| < 40 | Mala | rojo |
| 0 | Sin pulso (menos de 2 intervalos válidos) | rojo |

**De dónde sale cada indicador:**

- **Concentración (s1):** potencia cerca de la fundamental y sus armónicos dividida por la potencia
  total en 0,7–3,5 Hz, descontando la fracción que caería ahí si fuera sólo ruido blanco.
  Así el ruido vale 0 y un pulso limpio vale 1.
- **Diferencia entre métodos (s2):** `bpmTiempo` = 60 / mediana de los intervalos entre picos;
  `bpmFrec` = pico dominante del espectro (con corrección de armónicos). Con buena señal coinciden.
- **CV de los intervalos (s3):** sólo intervalos de 0,29 a 1,43 s (42–210 lpm).

**Dónde se usa:**

- **Medición en vivo (`app.js`):** cada segundo se guarda la FC y su calidad en `fc` del JSON. A la
  tendencia en pantalla sólo entran los valores con calidad ≥ 40. Si los métodos difieren en más
  de 5 lpm se muestra "los métodos no coinciden".
- **Servidor (`guardar.php`):** `resumen` se calcula sólo con los segundos de calidad ≥ 40.
  Por eso `calidad_media` es el promedio **de los segundos válidos**, no de toda la prueba: para
  saber cuánto se descartó, compare `segundos_con_fc` con `duracion_s`.
- **Visor (`visor.js`):** "Calidad global" analiza el tramo continuo más largo con el dedo apoyado;
  "Rango FC" usa ventanas de 10 s (paso 1 s) y sólo las de calidad ≥ 40.

**Limitaciones:**

- Los umbrales y pesos (0,1/0,4 · 3/10 lpm · 0,08/0,2 · 40/30/30 %) están **ajustados a mano**,
  no calibrados con datos de referencia.
- s3 penaliza por igual el ruido y una **arritmia real**: un ritmo muy irregular baja la calidad
  aunque la señal esté limpia.
- Si se cambia la fórmula, los puntajes de los JSON guardados antes dejan de ser comparables con
  los nuevos (los datos crudos de `muestras` sí permiten recalcularlos).
