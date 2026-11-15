// Reglas de decisión. Cada una tiene su fuente.
//
// Formas de condición:
//   { var, op, valor }              compara contra un número
//   { var, op, ref, factor }        compara contra otra variable del estado (× factor)
//   { desviada: tipo }              la variable está fuera de su rango personal
//   { todas: [...] } / { cualquiera: [...] }
//
// Niveles: 'ambar' y 'rojo' cambian el semáforo; 'info' es un consejo preventivo que no lo cambia.

export const REGLAS = [
  {
    id: 'CV-01',
    riesgo: 'cardiovascular',
    nivel: 'rojo',
    condicion: { var: 'vo2max', op: '<', ref: 'vo2max_linea_base', factor: 0.8 },
    recomendacion: {
      es: 'Capacidad aeróbica bajo el 80 % de tu valor previo a la misión. Reforzar el ejercicio aeróbico según el plan de contramedidas e informar al oficial médico.',
      en: 'Aerobic capacity below 80% of your pre-mission value. Increase aerobic exercise per the countermeasure plan and inform the crew medical officer.',
    },
    fuente: 'NASA-STD-3001 Vol. 1 Rev. C',
  },
  {
    id: 'CV-02',
    riesgo: 'cardiovascular',
    nivel: 'rojo',
    condicion: { var: 'vo2max', op: '<', valor: 32.9 },
    recomendacion: {
      es: 'VO2max bajo el mínimo exigido para actividad extravehicular en microgravedad. No programar EVA hasta reevaluar.',
      en: 'VO2max below the minimum required for microgravity EVA. Do not schedule EVA until reassessed.',
    },
    fuente: 'NASA-STD-3001 Vol. 1 Rev. C',
  },
  {
    id: 'CV-03',
    riesgo: 'cardiovascular',
    nivel: 'ambar',
    condicion: { cualquiera: [{ desviada: 'fc_reposo' }, { desviada: 'vfc_rmssd' }] },
    recomendacion: {
      es: 'Frecuencia cardíaca en reposo o variabilidad fuera de tu rango habitual. Revisar sueño, hidratación y carga de ejercicio, y repetir la medición mañana.',
      en: 'Resting heart rate or variability outside your usual range. Review sleep, hydration and training load, and repeat the measurement tomorrow.',
    },
    fuente: 'Línea base personal (puntuación z / EWMA)',
  },
  {
    id: 'HU-01',
    riesgo: 'hueso',
    nivel: 'ambar',
    condicion: { var: 'cumplimiento_resistencia_7d', op: '<', valor: 0.8 },
    recomendacion: {
      es: 'Ejercicio de resistencia bajo el 80 % de lo prescrito esta semana. Recuperar las sesiones para frenar la pérdida ósea y muscular.',
      en: 'Resistance exercise below 80% of the prescription this week. Make up sessions to limit bone and muscle loss.',
    },
    fuente: 'Plan de contramedidas, OCHMO TB-031',
  },
  {
    id: 'CO-01',
    riesgo: 'conductual',
    nivel: 'ambar',
    condicion: { var: 'noches_cortas_7d', op: '>=', valor: 5 },
    recomendacion: {
      es: 'Dormiste menos de 7 h en 5 de las últimas 7 noches. Proteger el horario de sueño y revisar luz, ruido y temperatura del dormitorio.',
      en: 'You slept under 7 h on 5 of the last 7 nights. Protect your sleep schedule and check light, noise and temperature in your crew quarters.',
    },
    fuente: 'Consenso AASM/SRS 2015',
  },
  {
    id: 'CO-02',
    riesgo: 'conductual',
    nivel: 'rojo',
    clinica: true,
    condicion: { var: 'phq9', op: '>=', valor: 10 },
    recomendacion: {
      es: 'Puntaje PHQ-9 de 10 o más. Conversar con el oficial médico de la tripulación; esta alerta no reemplaza una evaluación.',
      en: 'PHQ-9 score of 10 or higher. Talk with the crew medical officer; this alert does not replace an assessment.',
    },
    fuente: 'Kroenke et al. 2001',
  },
  {
    id: 'CO-03',
    riesgo: 'conductual',
    nivel: 'ambar',
    condicion: { var: 'actividad_7d', op: '<', valor: 150 },
    recomendacion: {
      es: 'Menos de 150 minutos de actividad aeróbica en la última semana. Retomar al menos el mínimo semanal.',
      en: 'Less than 150 minutes of aerobic activity in the last week. Get back to at least the weekly minimum.',
    },
    fuente: 'OMS 2020',
  },
  {
    id: 'IN-01',
    riesgo: 'inmune',
    nivel: 'ambar',
    condicion: { var: 'dias_sintomas_seguidos', op: '>=', valor: 2 },
    recomendacion: {
      es: 'Síntomas dos días seguidos o más. Descansar, hidratarse, medir la temperatura y seguir registrando los síntomas. Si empeoran, informar al oficial médico.',
      en: 'Symptoms for two or more days in a row. Rest, hydrate, take your temperature and keep logging symptoms. If they get worse, inform the crew medical officer.',
    },
    fuente: 'Regla compuesta propia',
  },
  {
    id: 'IN-02',
    riesgo: 'inmune',
    nivel: 'ambar',
    condicion: { var: 'senales_infeccion', op: '>=', valor: 2 },
    recomendacion: {
      es: 'Posible infección: coinciden al menos dos señales (frecuencia cardíaca en reposo sobre tu rango, temperatura sobre tu rango, síntomas). Informar al oficial médico, repetir la temperatura en 8 horas y reducir el contacto cercano con la tripulación.',
      en: 'Possible infection: at least two signals agree (resting heart rate above your range, temperature above your range, symptoms). Inform the crew medical officer, retake your temperature in 8 hours and limit close contact with the crew.',
    },
    fuente: 'Regla compuesta propia sobre la línea base personal',
  },
  {
    id: 'IN-03',
    riesgo: 'inmune',
    nivel: 'rojo',
    clinica: true,
    // 38,0 °C y además sobre el rango personal de vuelo: el alza de adaptación (~1 °C) no basta.
    condicion: {
      todas: [
        { var: 'temperatura_hoy', op: '>=', valor: 38 },
        { var: 'temperatura_z_hoy', op: '>=', valor: 2 },
      ],
    },
    recomendacion: {
      es: 'Temperatura de 38,0 °C o más. Informar al oficial médico ahora, suspender el ejercicio y repetir la medición en 4 horas.',
      en: 'Temperature of 38.0 °C or higher. Inform the crew medical officer now, stop exercise and repeat the measurement in 4 hours.',
    },
    fuente: 'Umbral clínico convencional de fiebre (38,0 °C), sobre el rango personal en vuelo; Stahn et al. 2017',
  },
  {
    id: 'IN-04',
    riesgo: 'inmune',
    nivel: 'ambar',
    condicion: { var: 'sintomas_piel_3d', op: '>', valor: 0 },
    recomendacion: {
      es: 'Lesión en la piel o ardor localizado: puede ser la reactivación de un virus latente, como el de la varicela-zóster, más frecuente en vuelos largos. Mostrarla al oficial médico, fotografiarla y evitar que otros la toquen.',
      en: 'Skin lesion or localized burning: it may be a latent virus reactivating, such as varicella-zoster (shingles), which is more frequent on long flights. Show it to the crew medical officer, photograph it and keep others from touching it.',
    },
    fuente: 'Mehta et al. 2017, npj Microgravity',
  },
  {
    id: 'IN-05',
    riesgo: 'inmune',
    nivel: 'info',
    condicion: {
      todas: [
        { var: 'factores_inmunes', op: '>=', valor: 2 },
        { var: 'sintomas_3d', op: '<=', valor: 0 },
      ],
    },
    recomendacion: {
      es: 'Sin síntomas, pero coinciden factores que debilitan la respuesta inmune (sueño corto, ánimo bajo, radiación). Es momento de prevenir: proteger el sueño y cuidar la higiene de manos.',
      en: 'No symptoms, but factors that weaken immune response coincide (short sleep, low mood, radiation). Time to prevent: protect your sleep and keep up hand hygiene.',
    },
    fuente: 'Cohen et al. 2009; riesgo de respuesta inmune alterada, NASA HRP',
  },
  {
    id: 'RA-01',
    riesgo: 'radiacion',
    nivel: 'ambar',
    condicion: { var: 'dosis_acumulada', op: '>=', ref: 'limite_dosis', factor: 0.8 },
    recomendacion: {
      es: 'Dosis acumulada sobre el 80 % del límite de carrera. Revisar la planificación de actividades con mayor exposición.',
      en: 'Cumulative dose above 80% of the career limit. Review planning of high-exposure activities.',
    },
    fuente: 'NASA-STD-3001 Vol. 1',
  },
  {
    id: 'RA-02',
    riesgo: 'radiacion',
    nivel: 'rojo',
    condicion: { var: 'dosis_acumulada', op: '>=', ref: 'limite_dosis', factor: 1 },
    recomendacion: {
      es: 'Dosis acumulada sobre el límite de carrera. Informar al oficial médico y a control de misión.',
      en: 'Cumulative dose above the career limit. Inform the crew medical officer and mission control.',
    },
    fuente: 'NASA-STD-3001 Vol. 1',
  },
];
