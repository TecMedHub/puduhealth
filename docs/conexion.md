# Conectar una fuente de datos

La app no depende de un sensor. Cualquier fuente (un wearable, un equipo de la nave, el celular,
otro sistema) entrega **mediciones** con un formato único y la app las trata igual: la línea base
personal, las reglas y el semáforo no saben de dónde vienen. El código está en
[`app/js/entrada.js`](../app/js/entrada.js).

```
fuente ──► adaptador ──► medición { tipo, valor, … } ──► registro ──► línea base, reglas, semáforo
```

## La medición

```json
{ "tipo": "fc_reposo", "valor": 61, "persona": "P01", "dia": 300, "fuente": "banda-ble", "calidad": 85 }
```

| Campo | Obligatorio | Qué es |
|---|---|---|
| `tipo` | sí | Uno de los tipos de la tabla de abajo |
| `valor` | sí | Número, en la unidad del tipo |
| `persona` | no | Tripulante; si falta, el que se está viendo |
| `dia` | no | Día de misión (negativo = línea base en tierra); si falta, el que se está viendo |
| `t` | no | Fecha y hora ISO 8601; si falta, se calcula desde el día |
| `fuente` | no | Quién midió (`reloj`, `celular-ppg`, `termometro`…); por defecto `externo` |
| `calidad` | no | 0 a 100, si el sensor la entrega |
| `unidad` | no | Si viene, debe coincidir con la del tipo: una temperatura en °F o una dosis en mGy se rechaza en vez de entrar mal |

La fase de misión (tierra, tránsito, superficie, regreso) la pone la app según el día. Una medición
reemplaza a la del mismo tipo, persona y día. Las que tienen errores se informan una por una y no
detienen a las demás.

### Tipos

| Tipo | Unidad | Riesgo |
|---|---|---|
| `fc_reposo` | lpm | cardiovascular |
| `vfc_rmssd` | ms | cardiovascular |
| `vo2max` | ml/kg/min | cardiovascular |
| `ejercicio_aerobico` | min | cardiovascular |
| `ejercicio_resistencia` | min | hueso |
| `sueno` | h | conductual |
| `animo_valencia` | 1-9 | conductual |
| `animo_activacion` | 1-9 | conductual |
| `kss` | 1-9 | conductual |
| `phq9` | puntos | conductual |
| `sintomas` | n | inmune |
| `sintoma_respiratorio`, `sintoma_digestivo`, `sintoma_fatiga`, `sintoma_piel` | 0-1 | inmune |
| `temperatura` | °C | inmune |
| `dosis_radiacion` | mSv | radiación |

## Tres formas de entregarla

**1. Desde el mismo navegador.** Otro programa en la página (un puente Bluetooth, una prueba, otro
sistema) llama a:

```js
window.astroHealth.registrar({ tipo: 'fc_reposo', valor: 61, fuente: 'banda-ble' });
window.astroHealth.registrar([{ tipo: 'sueno', valor: 6.5 }, { tipo: 'kss', valor: 4 }]);
// → { registros: [...], errores: [] }
```

**2. Con un archivo.** *Simulación → Importar mediciones* acepta:

- JSON: una medición, una lista, o `{ "formato": "puduhealth/v1", "mediciones": [...] }`;
- JSON Lines: una medición por línea;
- CSV con encabezado:

```csv
tipo,valor,dia,fuente
fc_reposo,58,10,reloj
sueno,6.5,10,reloj
```

**3. La cámara del celular**, el adaptador que ya funciona: una medición válida de 60 s entra como
`fc_reposo` y `vfc_rmssd` del día, con `fuente: celular-ppg` y su calidad. La señal de prueba no
se guarda. El procesamiento es `pulsometro/assets/ppg.js` (error mediano de 0,8 lpm contra ECG en
reposo).

## Propuesta para el hardware: estándares abiertos

En vez de un protocolo propio, la conexión con sensores puede apoyarse en los perfiles estándar de
Bluetooth Low Energy, que ya usan bandas de pecho, relojes y termómetros comerciales. La app los leería
con Web Bluetooth (Chrome y Edge en computadores y Android) y los traduciría a mediciones:

| Servicio GATT estándar | Característica | Medición |
|---|---|---|
| Heart Rate (0x180D) | Heart Rate Measurement (0x2A37), con intervalos RR | `fc_reposo`; `vfc_rmssd` calculada desde los RR |
| Health Thermometer (0x1809) | Temperature Measurement (0x2A1C) | `temperatura` |

Así el wearable del producto (ESP32-S3 con sensor PPG, sección 12 del [plan](plan.es.md)) sólo
tiene que anunciar el servicio estándar de frecuencia cardíaca para funcionar con la app, y la app
funciona con cualquier banda que ya lo haga. **Estado:** propuesta; el adaptador Bluetooth no está
construido ni probado.

## En la Tierra

El mismo formato sirve fuera de la nave. En una posta rural, el técnico paramédico puede medir el
pulso de un paciente con la cámara de un celular, o importar las mediciones de un equipo que ya
tenga, y la app compara a cada paciente consigo mismo. Medir la frecuencia cardíaca con la cámara
del celular ya se hace en la vida diaria: el conjunto abierto de Welltory reúne mediciones así,
hechas por personas en sus casas antes y durante la COVID-19 (ver `ml/README.md`, sección 4).
