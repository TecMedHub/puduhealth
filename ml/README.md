# Entrenamiento y calibración con datos reales

Dos usos de datos públicos, ambos validados dejando fuera a una persona completa o sobre
personas que no participaron en el ajuste:

1. **Modelo de estrés agudo** (WESAD) → `app/modelos/estres.json`, evaluado en el navegador.
2. **Calibración del detector de línea base** (PMData) → parámetros de `app/js/lineabase.js`.

Y dos contrastes: las reglas inmunes en misiones simuladas y la señal de FC en infecciones reales
(Welltory). La sección 5 explica por qué la app no usa un modelo que mezcle todas las variables.

Los datos de terceros no se suben al repositorio (licencias no comerciales y privacidad):
sólo el código que los descarga y procesa.

## Preparación

```bash
python3 -m venv ml/.venv
ml/.venv/bin/pip install kaggle six numpy pandas scipy scikit-learn
ml/.venv/bin/kaggle datasets download -d orvile/wesad-wearable-stress-affect-detection-dataset -p ml/datos/wesad --unzip
ml/.venv/bin/kaggle datasets download -d vlbthambawita/pmdata-a-sports-logging-dataset -p ml/datos/pmdata --unzip
git clone --depth 1 https://github.com/Welltory/hrv-covid19 ml/datos/welltory
```

## 1. Estrés agudo (WESAD)

```bash
ml/.venv/bin/python -I ml/wesad_exportar.py     # BVP de muñeca y ventanas de 60 s (reposo, estrés, diversión)
node ml/extraer_ppg.mjs                          # FC y VFC de cada ventana con pulsometro/assets/ppg.js
ml/.venv/bin/python -I ml/wesad_ecg.py           # FC y VFC de referencia desde el ECG de pecho
ml/.venv/bin/python -I ml/entrenar_estres.py d_bpm
```

- **Datos:** 15 personas, protocolo de estrés de Trier (hablar en público + cálculo mental).
- **Entrada:** FC de una medición de 60 s en reposo menos la FC de la línea base personal.
- **Entrenamiento:** ECG de pecho, que es la referencia limpia también durante el estrés.
- **Uso en la app:** FC del PPG (`ppg.js`) medida en reposo.

| Resultado | Valor |
|---|---|
| AUC dejando fuera a una persona (ECG) | **0,93 ± 0,15** |
| Exactitud balanceada | 0,83 |
| Alertas en reposo (falsos positivos) | 8 % |
| Umbral aprendido | **FC ≥ línea base + 8,3 lpm** → probabilidad ≥ 0,5 |
| Error de FC de `ppg.js` contra ECG, en reposo | **0,8 lpm** (mediana, calidad ≥ 40) |
| Error de RMSSD de `ppg.js` contra ECG, en reposo | 18,7 ms (mediana) |

**Por qué sólo FC:**

- Agregar RMSSD apenas mejora el AUC con ECG (0,94 contra 0,93).
- El RMSSD del PPG a 30 Hz tiene un error grande.
- Con la FC ya incluida, el RMSSD recibe un coeficiente de signo contrario a la fisiología.

**Por qué entrenar con ECG y no con PPG:** durante el estrés de WESAD la persona habla y
gesticula, y el PPG de muñeca se llena de artefactos de movimiento. La calidad mediana de esas
ventanas es 11/100 y en varias personas la FC estimada queda *bajo* la de reposo. Un modelo
entrenado ahí aprende a reconocer señal contaminada, no estrés. La app mide en reposo, donde el
PPG coincide con el ECG.

## 2. Calibración del detector de línea base (PMData)

```bash
ml/.venv/bin/python -I ml/pmdata_exportar.py     # tabla diaria: FC en reposo, sueño, pasos, bienestar
node ml/pmdata_detector.mjs                      # detector de la app sobre datos reales
node ml/calibrar_detector.mjs                    # falsas alarmas y sensibilidad por combinación de parámetros
```

- **Datos:** 14 personas con Fitbit durante ~5 meses, en vida diaria y sin vuelo espacial.
- **Línea base:** los primeros 21 días de cada persona; el resto hace de "misión".
- **Falsas alarmas:** % de días con alerta.
- **Sensibilidad:** alza artificial y sostenida de FC sumada desde el día 30 al dato real; días hasta la primera alerta.

| Parámetros | Días con alerta de FC | Alza de +5 lpm | Alza de +8 lpm |
|---|---|---|---|
| Iniciales (DE mín. 2 lpm, EWMA ≥ 1, 7 mediciones) | 20,8 % | 1 día | 1 día |
| **Calibrados** (DE mín. 3 lpm, EWMA ≥ 1,5, 10 mediciones) | **2,5 %** | **3 días** | **1 día** |

- Sueño: 0,4 % de días con alerta, con cualquiera de las combinaciones.
- La anticipación de la alerta en la misión simulada de la demo no cambia (55 días antes del umbral rojo de VO2max).

## 3. Evaluación de las reglas inmunes (misiones simuladas)

```bash
node ml/evaluar_inmune.mjs 30                    # 30 misiones, 4 personas, 210 días (escenario de viaje de ida)
```

| Regla | Enfermedades detectadas | Retraso mediano | Días con alerta sin enfermedad ni lesión |
|---|---|---|---|
| IN-01 anterior (síntomas + 2 factores) | 18 % | 0 días | 0,48 % |
| **IN-01 a IN-04** (semáforo inmune) | **100 %** | **1 día** | **0,05 %** |
| IN-05 (consejo preventivo, no cambia el semáforo) | — | — | 6,8 % |

**Límite:** la enfermedad la define el propio simulador (alza de FC, de temperatura y síntomas), así
que este resultado verifica que la lógica responde al escenario. No es una validación clínica: no hay
datos públicos de infecciones en vuelo con mediciones diarias.

## 4. La señal de FC en infecciones reales (Welltory)

```bash
ml/.venv/bin/python -I ml/welltory_exportar.py   # FC diaria por persona, respecto del inicio de los síntomas
node ml/welltory_detector.mjs --detalle          # detector de la app, sin cambios, sobre esos datos
```

- **Datos:** personas con COVID-19 (2020) que midieron su FC con la cámara del celular o con reloj
  antes y durante la enfermedad. Licencia CC0.
- **Línea base:** la primera mitad de los días sanos de cada persona (hasta 7 días antes de los síntomas).
- **Falsas alarmas:** el resto de sus días sanos. **Detección:** días 0 a 14 desde los síntomas.

| Medida | Cámara del celular (6 personas) | Reloj (9 personas) |
|---|---|---|
| Infecciones con FC sobre el rango personal | 2 de 6 | 1 de 9 |
| Días sanos con alerta | 1 de 238 (0,4 %) | 0 de 265 |
| Alza de FC en la enfermedad (mediana) | +1,4 lpm | +1,9 lpm |
| Personas en que la FC subió | 4 de 6 | 7 de 9 |

**Qué dice:**

- La FC sola alerta en pocas infecciones reales con los parámetros calibrados; por eso IN-02 exige
  dos señales y las reglas inmunes descansan en síntomas y temperatura.
- Las falsas alarmas se mantienen bajas en datos independientes de PMData.
- El alza de FC por enfermedad del simulador se ajustó de +6 a +2 lpm según esta mediana.

**Límites:** pocas personas, COVID-19 mayormente leve, inicio de síntomas autorreportado y mediciones
ni diarias ni estandarizadas en reposo. Es un primer contraste, no una cifra de sensibilidad. El
conjunto no trae temperatura ni síntomas diarios: IN-01, IN-03 e IN-04 siguen sin contraste real.

## 5. ¿Más variables, mejor modelo? (resultado negativo)

```bash
ml/.venv/bin/python -I ml/pmdata_multivariable.py
```

La app registra muchas variables. Antes de combinarlas con reglas probamos si un modelo que las
mezcle todas estima mejor el estado de la persona.

- **Datos:** PMData, las mismas 14 personas. Variables equivalentes a las de la app: FC en reposo,
  sueño, pasos y el reporte diario de ánimo, fatiga, estrés y calidad del sueño.
- **Objetivo:** un "día malo", disposición para rendir (*readiness*) 1,5 DE o más bajo el rango de
  la persona (9 % de los días). Hoy, o anticiparlo para mañana.
- **Entradas:** desviaciones respecto de la línea base personal (primeros 21 días), como en la app.
- **Validación:** regresión logística dejando fuera a una persona completa (AUC, media ± DE; entre
  paréntesis, personas con días malos y buenos para evaluar).

| Entradas | Anticipar mañana | Reconocer hoy |
|---|---|---|
| Solo FC | 0,54 ± 0,17 (10) | 0,63 ± 0,14 (9) |
| Sensores (FC, sueño, pasos y tendencias de 7 días) | 0,46 ± 0,24 (10) | 0,63 ± 0,21 (8) |
| Registro diario (ánimo, fatiga, estrés, calidad del sueño) | 0,54 ± 0,16 (12) | **0,79 ± 0,13** (13) |
| Sensores + registro | 0,46 ± 0,16 (9) | 0,78 ± 0,10 (8) |

**Qué dice:**

- Ninguna combinación anticipa el día siguiente mejor que el azar.
- Para el día de hoy, casi todo lo aporta lo que la persona responde; los sensores no suman. Un
  modelo así sólo le repetiría lo que acaba de decir.
- Por eso la app no mezcla todo en un puntaje: cada variable tiene su propia línea base y las
  reglas las combinan de forma explícita y citada.

**Límites:** vida diaria con Fitbit, no vuelo espacial; *readiness* es autorreportado; pocas personas.

## Fuentes

- Schmidt P, Reiss A, Duerichen R, Marberger C, Van Laerhoven K. *Introducing WESAD, a multimodal dataset for wearable stress and affect detection.* ICMI 2018.
- Thambawita V, et al. *PMData: a sports logging dataset.* MMSys 2020.
- Welltory. *COVID-19 and Wearables Open Data Research.* 2020. https://github.com/Welltory/hrv-covid19
