> 🇬🇧 [English](plan.en.md) · 🇨🇱 Español

# Plan del proyecto PuduHealth · TecMedHub · NASA Space Apps 2026

> Reto: *Create Health Monitoring Software for Astronauts on Space Missions*.

---

## 1. La idea

**Una plataforma abierta de apoyo a la decisión de salud a bordo que avisa semanas antes de cruzar
un límite estándar.** Cualquier sensor o equipo médico, de diseño propio o de terceros, entrega sus
mediciones por una API abierta con un formato único (`puduhealth/v1`). La plataforma compara al
astronauta con su propia línea base tomada en tierra, detecta tendencias y recomienda qué hacer
según las normas de NASA y guías clínicas. Cada recomendación lleva su cita.

> "Un límite fijo avisa cuando el problema ya existe. Nosotros avisamos cuando la persona empieza a
> alejarse de sí misma."

Por qué a bordo y por qué personal:

- **Los límites fijos avisan tarde.** Un umbral como VO2max bajo el 80 % del valor previo se cruza
  cuando la pérdida ya ocurrió. En la misión simulada, las primeras alertas ámbar de la comandante
  (sueño corto y luego ejercicio de resistencia insuficiente) llegan 55 días antes del rojo de
  VO2max, cuando aún hay tiempo para corregir.
- **Quien tiene que actuar ve la alerta.** El ejercicio y el sueño dependen del astronauta. La app
  le muestra su tendencia cada día con la acción y la fuente, en vez de esperar que alguien en
  Tierra lo note en los datos descargados.
- **Privada, para que sea más fácil reportar síntomas.** Los astronautas tienden a no informar síntomas
  físicos y conductuales a los médicos de vuelo, por miedo a quedar fuera de misiones futuras
  (Institute of Medicine 2001, *Safe Passage*, cap. 5 y 6); NASA reconoce que por eso la incidencia
  real de problemas de salud conductual puede estar subestimada (OCHMO-TB-014). Las respuestas
  detalladas quedan con el astronauta (sección 11).
- **Funciona sin enlace.** Todo corre a bordo, también durante las dos semanas cada dos años en que
  el Sol corta la comunicación con Marte.

El programa **EIMO** (*Earth Independent Medical Operations*) de NASA pide justamente un apoyo a la
decisión clínica a bordo, con tendencias y alertas tempranas. El retraso de la señal (hasta 22
minutos por tramo) no es el argumento central: las recomendaciones de la app actúan en días o
semanas.

| Existe | Qué hace | Qué le falta |
|---|---|---|
| Apple Watch, Oura, Whoop | Consumo masivo, procesamiento en la nube, reglas genéricas | No funciona sin conexión; no considera normas espaciales |
| Bio-Monitor / Astroskin (CSA, ISS) | Camiseta con sensores; los datos se analizan en la Tierra | El astronauta no ve su tendencia ni qué hacer; depende de que alguien en Tierra lo note |

**El aporte no es el sensor:**

- una API abierta: cualquier sensor o equipo entra con el mismo formato, y el hardware se cambia o
  se agrega sin tocar el motor (la cámara del celular es sólo un adaptador alternativo, construido
  para el reto porque no teníamos hardware; ver la [wiki de la API](https://github.com/TecMedHub/puduhealth/wiki));
- la línea base personal previa a la misión, que avisa antes que los límites fijos;
- la capa de decisión a bordo, en manos de quien tiene que actuar;
- la privacidad de las respuestas;
- la trazabilidad de cada recomendación.

---

## 2. Ciclo y principios

```
MEDIR ──► ESTIMAR (línea base, z, tendencia) ──► DECIDIR (reglas citadas) ──► ACTUAR ──► ¿se corrigió?
```

- **El modelo no recomienda:** sólo estima el estado y la tendencia.
- **Las reglas recomiendan:** son deterministas, auditables y cada una tiene su fuente.
- **Sin LLM y sin nube:** todo corre a bordo, en hardware pequeño.

---

## 3. Escenario de misión

Cada medición se asigna a una fase. Varias pruebas físicas dependen de la gravedad.

| Fase | Gravedad | Prueba cardiovascular | Otras mediciones |
|---|---|---|---|
| Línea base en tierra (2–4 semanas) | 1 g | Prueba submáxima en cicloergómetro | Batería completa |
| Tránsito Tierra–Marte | 0 g | Cicloergómetro submáximo (como CEVIS en la ISS) | FC/VFC, ánimo, KSS, sueño, síntomas, cumplimiento del ejercicio |
| Superficie de Marte | 0,38 g | Cicloergómetro | Las de tránsito + respuesta ortostática como señal |
| Regreso Marte–Tierra | 0 g | Como en el tránsito | Como en el tránsito |

La app trae dos escenarios simulados (`app/js/escenario.js`):

| Escenario | Días | Fases | Para qué |
|---|---|---|---|
| **Misión completa a Marte** (por defecto) | 860 | 180 de ida, 500 en la superficie, 180 de regreso (clase conjunción, NASA DRA 5.0) | La misión real: la dosis supera el límite de carrera y hay dos semanas sin enlace por la conjunción solar |
| Viaje de ida (`?escenario=transito`) | 210 | Tránsito | La historia de la comandante en el video y en la historia ilustrada |

- **Radiación medida por Curiosity (MSL RAD), día por día de cada fase:**
  - Ida: 1,84 mSv/día y las cinco tormentas solares del crucero (24,7 mSv), en el mismo día de viaje.
  - Superficie: 0,64 mSv/día desde el aterrizaje (6-8-2012) y la tormenta del sol 242 (12-4-2013),
    que en la superficie sumó sólo 0,025 mSv porque la atmósfera frena casi todo. Las otras dos
    tormentas de su primer año marciano (soles 420 y 504) no tienen dosis publicada y se omiten.
  - Regreso: Curiosity no volvió; se repite el crucero medido (supuesto).
  - Con la semilla de la demo la tripulación llega a ~1.030 mSv: ámbar (RA-01) cerca del día 375 y
    rojo (RA-02) cerca del día 562, ambos en la superficie.
- **Proyección de dosis:** acumulada + tasa de cada fase hasta el fin de la misión, y el día en que
  se cruzaría el límite. Los eventos solares no se pueden prever, así que la proyección es un piso.
- **Conjunción solar:** días 428 a 441, centrada en la que vivió Curiosity (18-4-2013). La tormenta
  del sol 242 llega en esos días, sin enlace con la Tierra; la app sigue funcionando igual.
- **Supuesto declarado:** no hay datos de cómo cambian el hueso, el músculo o el VO2max con 0,38 g;
  en la superficie el simulador usa las mismas tasas que en el viaje.

---

## 4. Riesgos cubiertos

| Riesgo | Qué se mide | Cómo se decide |
|---|---|---|
| **Cardiovascular** | FC en reposo, VFC, recuperación de FC, VO2max estimado | VO2max < 80 % del previo → rojo (NASA-STD-3001). Desviación contra la línea base → ámbar |
| **Hueso y músculo** | Cumplimiento del ejercicio de resistencia | Cumplimiento bajo → ámbar. La pérdida ósea se estima con las tasas de OCHMO TB-030 |
| **Conductual** | Ánimo en 2 ejes, KSS, horas de sueño, actividad diaria, PHQ-9 | Sueño < 7 h sostenido → ámbar. PHQ-9 ≥ 10 → pantalla de atención clínica |
| **Inmune** | Síntomas por tipo (respiratorio, digestivo, fatiga, piel), temperatura, FC en reposo y factores de riesgo (sueño, ánimo, dosis de radiación) | Síntomas 2 días seguidos, dos señales de infección que coinciden o una lesión en la piel → ámbar. Temperatura ≥ 38,0 °C → rojo. Factores de riesgo sin síntomas → consejo preventivo |

Además, como contexto:

- la **dosis de radiación acumulada**;
- el **sueño**, que alimenta los riesgos conductual e inmune.

---

## 5. Línea base

- **Alerta ámbar:** una desviación contra el rango propio en la dirección desfavorable. Se cumple
  con dos mediciones seguidas con |z| ≥ 2, o con una tendencia EWMA (λ = 0,2) ≥ 1,5 sostenida durante
  10 mediciones o más. Una medición aislada no genera alerta.
- **Calibración con datos reales** (PMData, 14 personas, ~5 meses): 2,5 % de días con alerta de FC en
  vida diaria y un alza sostenida de +5 lpm detectada en 3 días (mediana). Detalle en `ml/README.md`.
- **Línea base móvil para la temperatura.** La temperatura central en reposo sube cerca de 1 °C en
  los primeros 2,5 meses de vuelo (Stahn et al. 2017): contra la línea base de Tierra quedaría siempre
  fuera de rango. En vuelo, su rango se recalcula cada día con los días 21 a 4 anteriores (mínimo 10
  mediciones), con mediana y MAD para que una enfermedad pasada no lo infle. Los últimos 3 días quedan
  fuera de la ventana: una fiebre aguda no entra en su propio rango. Las demás variables se comparan con
  la línea base de Tierra, porque su cambio en vuelo es justamente lo que se quiere detectar.
- **Alerta roja:** cruzar el umbral de la norma o de la guía.
- **Consejo preventivo (`info`):** se muestra como alerta pero no cambia el semáforo.
- Es coherente con NASA-STD-3001, que expresa sus límites como "% del valor previo a la misión".

---

## 6. Reglas

| ID | Regla | Fuente |
|---|---|---|
| CV-01 | VO2max < 80 % del previo → rojo | NASA-STD-3001 Vol. 1 Rev. C |
| CV-02 | VO2max < 32,9 ml/kg/min → no apto para EVA en microgravedad | NASA-STD-3001 Vol. 1 Rev. C |
| CV-03 | FC en reposo o VFC fuera del rango personal → ámbar | Línea base personal (z / EWMA) |
| HU-01 | Cumplimiento del ejercicio de resistencia < 80 % de lo prescrito → ámbar | Plan de contramedidas, OCHMO TB-031 |
| CO-01 | Sueño < 7 h en 5 o más de 7 noches → ámbar | Consenso AASM/SRS 2015 |
| CO-02 | PHQ-9 ≥ 10 → pantalla de atención clínica + oficial médico | Kroenke et al. 2001 |
| CO-03 | Actividad < 150 min/semana → ámbar | OMS 2020 |
| IN-01 | Síntomas 2 días seguidos o más → ámbar | Regla compuesta propia |
| IN-02 | Coinciden 2 señales de infección o más (FC en reposo sobre el rango personal, temperatura sobre el rango personal, síntomas) → ámbar | Regla compuesta propia sobre la línea base personal |
| IN-03 | Temperatura ≥ 38,0 °C y sobre el rango personal de vuelo (z ≥ 2) → rojo + pantalla de atención clínica | Umbral clínico convencional de fiebre; Stahn et al. 2017 |
| IN-04 | Lesión en la piel (posible reactivación de un virus latente, como varicela-zóster) → ámbar | Mehta et al. 2017 |
| IN-05 | 2 factores de riesgo o más (sueño corto, ánimo bajo, radiación) sin síntomas → consejo preventivo, no cambia el semáforo | Cohen et al. 2009; riesgo inmune del HRP |
| RA-01 | Dosis efectiva acumulada contra el límite de carrera | NASA-STD-3001 Vol. 1 |

IN-03 combina el umbral convencional con el rango personal. El umbral solo, con el alza de
adaptación, dejaría a un astronauta sano cerca de 38 °C en rojo permanente; el rango solo marcaría
como fiebre variaciones pequeñas. Exigir ambas mantiene los 38,0 °C de la práctica clínica y descarta
el alza lenta del vuelo. Como pide avisar al oficial médico de inmediato, abre la misma pantalla de
atención clínica que CO-02, con su propio texto.

### Formato

```json
{
  "id": "CV-01",
  "riesgo": "cardiovascular",
  "condicion": { "var": "vo2max", "op": "<", "ref": "linea_base", "factor": 0.80 },
  "nivel": "rojo",
  "recomendacion": "Aumentar sesiones de ejercicio aeróbico según plan de contramedidas.",
  "fuente": "NASA-STD-3001 Vol. 1 Rev. C"
}
```

---

## 7. Datos y recursos de NASA

| Recurso | Uso |
|---|---|
| NASA-STD-3001 Vol. 1 Rev. C | Umbrales de VO2max, límite de radiación, límites como % del valor previo |
| Riesgos del Human Research Program (HRP) | Selección y nombre de los riesgos |
| OCHMO TB-030 / TB-031 | Tasa de pérdida ósea y prescripción de ejercicio |
| MSL RAD (Curiosity) | Tasa de dosis en el viaje y en la superficie de Marte, y las cinco tormentas solares del crucero (23–29 ene, 7–15 mar y 17–18 may de 2012: 24,7 mSv en total), que la tripulación simulada recibe en el mismo día de viaje; en la superficie, la tormenta del sol 242 (Zeitlin et al. 2013; Hassler et al. 2014; Guo et al. 2015). Datos crudos en el Planetary Data System de NASA |
| EIMO | NASA pide apoyo a la decisión clínica a bordo, con tendencias y alertas tempranas |
| OCHMO-TB-014 Behavioral Health Mishaps | Los astronautas son reacios a reportar problemas de salud conductual: por qué las respuestas son privadas |

---

## 8. Modelo

- **Línea base personal + puntuación z + tendencia EWMA**, con parámetros calibrados en datos reales (PMData).
- **Estrés agudo:** regresión logística sobre la FC de una medición en reposo contra la línea base
  personal. Entrenada con el ECG de WESAD (15 personas) y validada dejando fuera a una persona
  completa: AUC 0,93. La FC del celular (`ppg.js`) coincide con el ECG en reposo (error mediano 0,8 lpm).
- Los modelos se exportan como JSON de pocos KB y se evalúan en el navegador: interpretables,
  livianos y sin nube.
- **Sin modelo que mezcle todo:** en PMData, un modelo con FC, sueño, pasos y el reporte diario no
  anticipa un día malo mejor que el azar (AUC 0,46–0,54), y para el día de hoy los sensores no suman
  a lo que la persona responde (0,78 contra 0,79). Cada variable tiene su línea base y las reglas
  las combinan de forma explícita (`ml/README.md`, sección 5).

---

## 9. Simulador de tripulación

Muestra meses de misión que no se pueden medir en vivo.

```
semilla + escenario ──► perfil ──► línea base en tierra ──► misión de N días por fases
                                                (pérdidas según literatura, frenadas por contramedidas,
                                                 dosis y tormentas solares de MSL RAD, eventos: enfermedad, falta de
                                                 sueño, conflicto)
```

- Usa el mismo formato que los datos reales: la aplicación no distingue la fuente.
- **Misma semilla, misma tripulación:** la demostración es reproducible.
- Permite verificar la lógica de alertas con muchas tripulaciones: anticipación de la detección y
  tasa de falsas alarmas.

---

## 10. Acompañante

Es la interfaz que sostiene el registro diario: **Astropudú**, un pudú astronauta en pixel art. El
pudú es el ciervo más pequeño del mundo y vive en el sur de Chile, incluida Chiloé, donde está
nuestro evento local.

1. **Su estado no depende del contenido emocional de las respuestas.** Depende sólo de registrar y
   de los hábitos medidos.
2. **No muere ni castiga.** Si no hay registro, duerme.
3. **Duerme cuando el astronauta duerme:** el desfase circadiano se ve sin necesidad de gráficos.
4. **Las alertas clínicas no las da el acompañante.** Aparece una pantalla sobria con el paso a seguir.
5. **Siempre se puede deslizar para ver los datos reales.**
6. **El registro toma 10 segundos o menos.**

---

## 11. Privacidad

| Nivel | Quién ve | Qué ve |
|---|---|---|
| Privado | Sólo el astronauta | Sus respuestas detalladas y su trayectoria |
| Oficial médico de la tripulación | Con autorización del astronauta | Semáforo y alertas, sin detalle |
| Psicólogo en Tierra | Con retraso y consentimiento | Resumen periódico |

---

## 12. Arquitectura

### Prototipo

```
fuentes: sensores propios o de terceros, registro diario, cámara (alternativa)
   ──► API abierta puduhealth/v1 (app/js/entrada.js)
   ──► motor: línea base z/EWMA + reglas citadas ──► app web estática HTML + JS
```

- La API (`window.puduHealth`, importación JSON/CSV) está documentada en la [wiki](https://github.com/TecMedHub/puduhealth/wiki) y en
  [`conexion.md`](conexion.md).
- El adaptador de la cámara usa el procesamiento de señal de `pulsometro/assets/ppg.js`.
- Cualquier servidor web entrega los archivos (GitHub Pages en la demo, un computador de a bordo en
  una misión); todo el cálculo ocurre en el dispositivo y los datos no salen de él.
- Modo sin conexión: `app/sw.js` guarda la app en la primera visita. Con red usa siempre la versión
  del servidor; sin red, la copia guardada.

Formato de datos:

```json
{ "persona": "P01", "tipo": "fc_reposo", "valor": 58, "unidad": "lpm", "dia": 42,
  "t": "2027-04-12T07:00:00-03:00", "fase": "transito", "fuente": "celular-ppg", "calidad": 82 }
```

`dia` es el día de misión: negativo durante la línea base en tierra, 0 en el despegue.

### Producto

```
ESP32-S3 (en el cuerpo)              Hub de borde (en el hábitat)
MAX30102 (PPG + SpO2)                Linux, SQLite
IMU, temperatura      ── BLE ──►     historial y línea base por persona
pantalla redonda                     modelos y motor de reglas
(acompañante, alertas)               servidor web ──WiFi──► tableta
```

---

## 13. Limitaciones

- Es un prototipo: **no es un dispositivo médico ni está validado clínicamente.**
- Los datos de misión de la demostración son simulados. Los datos individuales de astronautas están
  restringidos por privacidad.
- Ningún sensor del sistema mide la densidad ósea; la pérdida ósea es una estimación.
- Las reglas inmunes IN-01 e IN-02 son reglas compuestas propias, no provienen de una guía clínica.
  En 30 misiones simuladas alertan en todas las enfermedades del simulador con 1 día de retraso
  (mediana) y en 0,05 % de los días sin enfermedad (`ml/evaluar_inmune.mjs`). La enfermedad la
  define el propio simulador: esto verifica la lógica, no valida la detección de infecciones.
- Con infecciones reales (COVID-19, conjunto abierto de Welltory), la FC sobre el rango personal alertó
  en 3 de 15 casos y en menos de 0,5 % de los días sanos (`ml/welltory_detector.mjs`). La FC sola no
  basta para detectar una infección: por eso IN-02 exige dos señales. Son pocas personas y mediciones
  no estandarizadas; los síntomas y la temperatura no tienen aún contraste con datos reales.
- No hay un sensor de función inmune: se vigilan sus consecuencias (síntomas, fiebre, lesiones) y sus
  factores de riesgo. En vuelo, la reactivación viral se confirma con PCR en saliva, que el sistema no mide.
- El alza de la temperatura en vuelo (Stahn et al. 2017) se midió como temperatura central con un
  sensor de frente y pecho; con un termómetro oral puede ser distinta. El simulador no la incluye: la
  línea base móvil se verifica con una serie sintética (`app/tests/inmune.test.js`), no con datos de vuelo.
- El modelo de estrés se entrenó con estrés de laboratorio de corta duración (prueba de Trier); no
  distingue estrés de otras causas de alza de la FC en reposo, como una enfermedad.
- La VFC (RMSSD) medida con la cámara a 30 Hz tiene un error alto y no se usa para decidir.

---

## 14. Trabajo futuro

- FC con movimiento (PPG-DaLiA) y trayectorias de bienestar de largo plazo (LifeSnaps).
- SpO2 con cámara (Hoffman et al. 2022).
- Más pruebas: PVT, rejilla de Amsler, audición, equilibrio, GAD-7, WHO-5, soledad.
- Panel cooperativo de la tripulación; mensajes grabados por la familia antes de la misión.
- Prototipo de hardware ESP32-S3 + MAX30102 con hub de borde.

---

## 15. Fuentes

- NASA-STD-3001 Vol. 1 Rev. C — https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf
- OCHMO TB-031 Ejercicio — https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf
- OCHMO TB-030 Pérdida ósea — https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf
- EIMO — https://ntrs.nasa.gov/citations/20230016189
- Human Exploration of Mars Design Reference Architecture 5.0, NASA/SP-2009-566 — https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf
- OCHMO-TB-014 Behavioral Health Mishaps, Rev. B (2023) — https://www.nasa.gov/sites/default/files/atoms/files/behavioral_health_mishaps_technical_brief_ochmo.pdf
- Institute of Medicine 2001, *Safe Passage: Astronaut Care for Exploration Missions*, cap. 5 (p. 140) y 6 (pp. 174 y 183), subreporte de síntomas — https://doi.org/10.17226/10218
- What's Mars Solar Conjunction, and Why Does It Matter? (NASA) — https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/
- Riesgo cognitivo y conductual — https://www.nasa.gov/directorates/esdmd/hhp/risk-of-adverse-cognitive-or-behavioral-conditions-and-psychiatric-disorders
- Bio-Monitor (CSA) — https://asc-csa.gc.ca/eng/sciences/astroskin.asp
- Consenso AASM/SRS — https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf
- Kroenke et al. 2001, PHQ-9 — https://pubmed.ncbi.nlm.nih.gov/11556941/
- Riesgo de respuesta inmune alterada (HRP, informe de evidencia) — https://ntrs.nasa.gov/citations/20140002769
- Mehta et al. 2017, reactivación de virus latentes en la ISS — https://doi.org/10.1038/s41526-017-0015-y
- Cohen et al. 2009, sueño y susceptibilidad al resfrío — https://pubmed.ncbi.nlm.nih.gov/19139325/
- Welltory, COVID-19 and Wearables Open Data — https://github.com/Welltory/hrv-covid19
- Stahn et al. 2017, temperatura corporal en vuelos largos — https://doi.org/10.1038/s41598-017-15560-w
- Basner et al. 2013, Mars-500 — https://www.med.upenn.edu/uep/assets/user-content/documents/PNAS2013Basner1212646110withSupportingAppendix.pdf
- Stuster, Journals — https://ntrs.nasa.gov/api/citations/20100026549/downloads/20100026549.pdf
- Schmidt et al. 2018, WESAD — https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection
- Thambawita et al. 2020, PMData — https://datasets.simula.no/pmdata
- Guo et al. 2015, variaciones de la dosis medida por MSL RAD en tránsito a Marte — https://arxiv.org/abs/1503.06631
- Guo et al. 2015, dosis de radiación en la superficie de Marte medida por MSL RAD (ApJ 810:24) — https://arxiv.org/abs/1507.03473
- Hassler et al. 2014, ambiente de radiación en la superficie de Marte (Science) — https://doi.org/10.1126/science.1244797
- Datos crudos de MSL RAD: NASA Planetary Data System, nodo PPI — https://pds-ppi.igpp.ucla.edu/
- Moore et al. 2014, VO2 máximo durante y después de vuelos largos — https://doi.org/10.1152/japplphysiol.01251.2013
- Barger et al. 2014, sueño y uso de hipnóticos en astronautas — https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436
- OCHMO TB-020 Protección contra la radiación ionizante — https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
- Ejercicio en la Estación Espacial (ARED, CEVIS, T2) — https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/

### Recursos oficiales del reto

- 5 Hazards of Human Spaceflight (NASA HRP) — https://www.nasa.gov/hrp/hazards/ — peligros que muestra cada explicación de la app
- Risks of Human Spaceflight (NASA HRP) — https://www.nasa.gov/hrp/risks/ — selección de los cinco riesgos del semáforo
- Ongoing HRP Research in Space (NASA HRP) — https://www.nasa.gov/hrp/ongoing-hrp-research/
- Monitoring Radiation for Astronaut Health (CSA) — https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Why Do We Conduct Science Experiments in Space? (CSA) — https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
