> 🇬🇧 English · 🇨🇱 [Español](plan.es.md)

# PuduHealth project plan · TecMedHub · NASA Space Apps 2026

> Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*.

---

## 1. The idea

**An open onboard health decision-support platform that warns weeks before a standard limit is
crossed.** Any sensor or medical device, of our own design or third-party, delivers its measurements
through an open API with a single format (`puduhealth/v1`). The platform compares the astronaut with
their own baseline taken on Earth, detects trends and recommends what to do according to NASA
standards and clinical guidelines. Every recommendation carries its citation.

> "A fixed limit warns when the problem already exists. We warn when the person starts to move away
> from themselves."

Why onboard and why personal:

- **Fixed limits warn late.** A threshold such as VO2max below 80 % of the previous value is crossed
  when the loss has already happened. In the simulated mission, the commander's first amber alerts
  (short sleep, then insufficient resistance exercise) arrive 55 days before the VO2max red, while
  there is still time to correct course.
- **The person who has to act sees the alert.** Exercise and sleep depend on the astronaut. The app
  shows them their trend every day, with the action and the source, instead of waiting for someone on
  Earth to notice it in the downlinked data.
- **Private, so that reporting symptoms is easier.** Astronauts tend not to report physical and
  behavioral symptoms to flight surgeons, for fear of being left out of future missions (Institute of
  Medicine 2001, *Safe Passage*, ch. 5 and 6); NASA acknowledges that, for this reason, the real
  incidence of behavioral health problems may be underestimated (OCHMO-TB-014). The detailed answers
  stay with the astronaut (section 11).
- **Works without a link.** Everything runs onboard, including the two weeks every two years when the
  Sun cuts communication with Mars.

NASA's **EIMO** (*Earth Independent Medical Operations*) program calls for exactly this: onboard
clinical decision support, with trends and early alerts. Signal delay (up to 22 minutes each way) is
not the central argument: the app's recommendations act over days or weeks.

| What exists | What it does | What it lacks |
|---|---|---|
| Apple Watch, Oura, Whoop | Mass-market, cloud processing, generic rules | Does not work offline; does not consider space standards |
| Bio-Monitor / Astroskin (CSA, ISS) | Sensor shirt; data is analyzed on Earth | The astronaut does not see their trend or what to do; depends on someone on Earth noticing |

**The contribution is not the sensor:**

- an open API: any sensor or device enters with the same format, and hardware can be changed or
  added without touching the engine (the phone camera is only a fallback adapter, built for the
  challenge because we had no hardware; see the [API wiki](https://github.com/TecMedHub/puduhealth/wiki));
- the personal baseline taken before the mission, which warns earlier than fixed limits;
- the decision layer onboard, in the hands of the person who has to act;
- the privacy of the answers;
- the traceability of every recommendation.

---

## 2. Cycle and principles

```
MEASURE ──► ESTIMATE (baseline, z, trend) ──► DECIDE (cited rules) ──► ACT ──► was it corrected?
```

- **The model does not recommend:** it only estimates state and trend.
- **The rules recommend:** they are deterministic, auditable, and each one has its source.
- **No LLM and no cloud:** everything runs onboard, on small hardware.

---

## 3. Mission scenario

Each measurement is assigned to a phase. Several physical tests depend on gravity.

| Phase | Gravity | Cardiovascular test | Other measurements |
|---|---|---|---|
| Ground baseline (2–4 weeks) | 1 g | Submaximal cycle ergometer test | Full battery |
| Earth–Mars transit | 0 g | Submaximal cycle ergometer (like CEVIS on the ISS) | HR/HRV, mood, KSS, sleep, symptoms, exercise compliance |
| Mars surface | 0.38 g | Cycle ergometer | Those from transit + orthostatic response as a signal |
| Mars–Earth return | 0 g | As in transit | As in transit |

The app ships with two simulated scenarios (`app/js/escenario.js`):

| Scenario | Days | Phases | Purpose |
|---|---|---|---|
| **Full Mars mission** (default) | 860 | 180 outbound, 500 on the surface, 180 return (conjunction class, NASA DRA 5.0) | The real mission: the dose exceeds the career limit and there are two weeks without a link because of solar conjunction |
| Outbound trip (`?escenario=transito`) | 210 | Transit | The commander's story in the video and in the illustrated story |

- **Radiation measured by Curiosity (MSL RAD), day by day for each phase:**
  - Outbound: 1.84 mSv/day and the five solar storms of the cruise (24.7 mSv), on the same travel day.
  - Surface: 0.64 mSv/day from landing (August 6, 2012) and the sol 242 storm (April 12, 2013),
    which on the surface added only 0.025 mSv because the atmosphere stops almost all of it. The other
    two storms of its first Martian year (sols 420 and 504) have no published dose and are omitted.
  - Return: Curiosity did not return; the measured cruise is repeated (assumption).
  - With the demo seed the crew reaches ~1,030 mSv: amber (RA-01) near day 375 and red (RA-02) near
    day 562, both on the surface.
- **Dose projection:** accumulated dose + the rate of each phase until the end of the mission, and the
  day the limit would be crossed. Solar events cannot be predicted, so the projection is a floor.
- **Solar conjunction:** days 428 to 441, centered on the one Curiosity lived through (April 18, 2013).
  The sol 242 storm arrives in those days, with no link to Earth; the app keeps working the same.
- **Declared assumption:** there are no data on how bone, muscle or VO2max change at 0.38 g; on the
  surface the simulator uses the same rates as in transit.

---

## 4. Risks covered

| Risk | What is measured | How it is decided |
|---|---|---|
| **Cardiovascular** | Resting heart rate, HRV, HR recovery, estimated VO2max | VO2max < 80 % of previous → red (NASA-STD-3001). Deviation from the baseline → amber |
| **Bone and muscle** | Resistance exercise compliance | Low compliance → amber. Bone loss is estimated with the OCHMO TB-030 rates |
| **Behavioral** | Mood on 2 axes, KSS, hours of sleep, daily activity, PHQ-9 | Sleep < 7 h sustained → amber. PHQ-9 ≥ 10 → clinical attention screen |
| **Immune** | Symptoms by type (respiratory, digestive, fatigue, skin), temperature, resting heart rate and risk factors (sleep, mood, radiation dose) | Symptoms 2 days in a row, two coinciding infection signals or a skin lesion → amber. Temperature ≥ 38.0 °C → red. Risk factors without symptoms → preventive advice |

In addition, as context:

- the **accumulated radiation dose**;
- **sleep**, which feeds the behavioral and immune risks.

---

## 5. Baseline

- **Amber alert:** a deviation from one's own range in the unfavorable direction. It is met with two
  consecutive measurements with |z| ≥ 2, or with an EWMA trend (λ = 0.2) ≥ 1.5 sustained for 10
  measurements or more. A single isolated measurement does not raise an alert.
- **Calibration with real data** (PMData, 14 people, ~5 months): 2.5 % of days with an HR alert in
  daily life and a sustained rise of +5 bpm detected in 3 days (median). Details in `ml/README.md` (Spanish).
- **Moving baseline for temperature.** Resting core temperature rises about 1 °C in the first 2.5
  months of flight (Stahn et al. 2017): against the Earth baseline it would always be out of range.
  In flight, its range is recalculated every day using days 21 to 4 before (minimum 10 measurements),
  with median and MAD so that a past illness does not inflate it. The last 3 days are left out of the
  window: an acute fever does not enter its own range. The other variables are compared with the Earth
  baseline, because their change in flight is precisely what we want to detect.
- **Red alert:** crossing the threshold of the standard or the guideline.
- **Preventive advice (`info`):** shown as an alert but does not change the traffic light.
- It is consistent with NASA-STD-3001, which expresses its limits as "% of the pre-mission value".

---

## 6. Rules

| ID | Rule | Source |
|---|---|---|
| CV-01 | VO2max < 80 % of previous → red | NASA-STD-3001 Vol. 1 Rev. C |
| CV-02 | VO2max < 32.9 ml/kg/min → not fit for EVA in microgravity | NASA-STD-3001 Vol. 1 Rev. C |
| CV-03 | Resting heart rate or HRV outside the personal range → amber | Personal baseline (z / EWMA) |
| HU-01 | Resistance exercise compliance < 80 % of prescribed → amber | Countermeasures plan, OCHMO TB-031 |
| CO-01 | Sleep < 7 h on 5 or more of 7 nights → amber | AASM/SRS consensus 2015 |
| CO-02 | PHQ-9 ≥ 10 → clinical attention screen + crew medical officer | Kroenke et al. 2001 |
| CO-03 | Activity < 150 min/week → amber | WHO 2020 |
| IN-01 | Symptoms for 2 or more days in a row → amber | Own compound rule |
| IN-02 | 2 or more infection signals coincide (resting heart rate above the personal range, temperature above the personal range, symptoms) → amber | Own compound rule on the personal baseline |
| IN-03 | Temperature ≥ 38.0 °C and above the personal in-flight range (z ≥ 2) → red + clinical attention screen | Conventional clinical fever threshold; Stahn et al. 2017 |
| IN-04 | Skin lesion (possible reactivation of a latent virus, such as varicella-zoster) → amber | Mehta et al. 2017 |
| IN-05 | 2 or more risk factors (short sleep, low mood, radiation) without symptoms → preventive advice, does not change the traffic light | Cohen et al. 2009; HRP immune risk |
| RA-01 | Accumulated effective dose against the career limit | NASA-STD-3001 Vol. 1 |

IN-03 combines the conventional threshold with the personal range. The threshold alone, given the
adaptation rise, would leave a healthy astronaut near 38 °C in permanent red; the range alone would
flag small variations as fever. Requiring both keeps the 38.0 °C of clinical practice and rules out
the slow rise of flight. Since it calls for notifying the crew medical officer immediately, it opens
the same clinical attention screen as CO-02, with its own text.

### Format

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

## 7. NASA data and resources

| Resource | Use |
|---|---|
| NASA-STD-3001 Vol. 1 Rev. C | VO2max thresholds, radiation limit, limits as % of the pre-mission value |
| Human Research Program (HRP) risks | Selection and naming of the risks |
| OCHMO TB-030 / TB-031 | Bone loss rate and exercise prescription |
| MSL RAD (Curiosity) | Dose rate in transit and on the surface of Mars, and the five solar storms of the cruise (January 23–29, March 7–15 and May 17–18, 2012: 24.7 mSv in total), which the simulated crew receives on the same travel day; on the surface, the sol 242 storm (Zeitlin et al. 2013; Hassler et al. 2014; Guo et al. 2015). Raw data in NASA's Planetary Data System |
| EIMO | NASA calls for onboard clinical decision support, with trends and early alerts |
| OCHMO-TB-014 Behavioral Health Mishaps | Astronauts are reluctant to report behavioral health problems: why the answers are private |

---

## 8. Model

- **Personal baseline + z-score + EWMA trend**, with parameters calibrated on real data (PMData).
- **Acute stress:** logistic regression on the heart rate of a resting measurement against the
  personal baseline. Trained on the WESAD ECG (15 people) and validated by leaving one whole person
  out: AUC 0.93. The phone's heart rate (`ppg.js`) matches the ECG at rest (median error 0.8 bpm).
- The models are exported as JSON of a few KB and evaluated in the browser: interpretable,
  lightweight and cloud-free.
- **No model that mixes everything:** in PMData, a model with HR, sleep, steps and the daily report
  does not anticipate a bad day better than chance (AUC 0.46–0.54), and for the current day the
  sensors add nothing to what the person reports (0.78 versus 0.79). Each variable has its own
  baseline and the rules combine them explicitly (`ml/README.md`, section 5).

---

## 9. Crew simulator

It shows months of mission that cannot be measured live.

```
seed + scenario ──► profile ──► ground baseline ──► N-day mission by phases
                                                (losses per the literature, slowed by countermeasures,
                                                 dose and solar storms from MSL RAD, events: illness, lack of
                                                 sleep, conflict)
```

- It uses the same format as real data: the application does not distinguish the source.
- **Same seed, same crew:** the demonstration is reproducible.
- It makes it possible to verify the alert logic across many crews: detection lead time and
  false alarm rate.

---

## 10. Companion

It is the interface that sustains the daily check-in: **Astropudú**, a pixel-art astronaut pudú. The
pudú is the smallest deer in the world and lives in southern Chile, including Chiloé, where our local
event takes place.

1. **Its state does not depend on the emotional content of the answers.** It depends only on
   checking in and on the measured habits.
2. **It does not die or punish.** If there is no check-in, it sleeps.
3. **It sleeps when the astronaut sleeps:** circadian misalignment shows without the need for charts.
4. **Clinical alerts are not given by the companion.** A clear clinical screen appears, without the companion, with the next step.
5. **You can always swipe to see the real data.**
6. **The check-in takes 10 seconds or less.**

---

## 11. Privacy

| Level | Who sees | What they see |
|---|---|---|
| Private | Only the astronaut | Their detailed answers and their trajectory |
| Crew medical officer | With the astronaut's authorization | Traffic light and alerts, without detail |
| Psychologist on Earth | With delay and consent | Periodic summary |

---

## 12. Architecture

### Prototype

```
sources: own or third-party sensors, daily check-in, camera (fallback)
   ──► open API puduhealth/v1 (app/js/entrada.js)
   ──► engine: z/EWMA personal baseline + cited rules ──► static web app HTML + JS
```

- The API (`window.puduHealth`, JSON/CSV import) is documented in the [wiki](https://github.com/TecMedHub/puduhealth/wiki) and in
  [`conexion.md`](conexion.md) (Spanish).
- The camera adapter uses the signal processing in `pulsometro/assets/ppg.js`.
- Any web server delivers the files (GitHub Pages in the demo, an onboard computer on a mission); all
  computation happens on the device and the data does not leave it.
- Offline mode: `app/sw.js` caches the app on the first visit. With a network it always uses the
  server's version; without a network, the cached copy.

Data format:

```json
{ "persona": "P01", "tipo": "fc_reposo", "valor": 58, "unidad": "lpm", "dia": 42,
  "t": "2027-04-12T07:00:00-03:00", "fase": "transito", "fuente": "celular-ppg", "calidad": 82 }
```

`dia` is the mission day: negative during the ground baseline, 0 at launch.

### Product

```
ESP32-S3 (on the body)               Edge hub (in the habitat)
MAX30102 (PPG + SpO2)                Linux, SQLite
IMU, temperature      ── BLE ──►     history and baseline per person
round display                        models and rules engine
(companion, alerts)                  web server ──WiFi──► tablet
```

---

## 13. Limitations

- It is a prototype: **it is not a medical device and has not been clinically validated.**
- The mission data in the demonstration are simulated. Individual astronaut data are restricted for
  privacy reasons.
- No sensor in the system measures bone density; bone loss is an estimate.
- The immune rules IN-01 and IN-02 are our own compound rules, not derived from a clinical guideline.
  Across 30 simulated missions they alert on every illness in the simulator with a 1-day delay
  (median) and on 0.05 % of days without illness (`ml/evaluar_inmune.mjs`). The illness is defined by
  the simulator itself: this verifies the logic, it does not validate infection detection.
- With real infections (COVID-19, Welltory open dataset), heart rate above the personal range alerted
  in 3 of 15 cases and on fewer than 0.5 % of healthy days (`ml/welltory_detector.mjs`). Heart rate
  alone is not enough to detect an infection: that is why IN-02 requires two signals. These are few
  people and non-standardized measurements; symptoms and temperature have not yet been tested against
  real data.
- There is no immune function sensor: its consequences (symptoms, fever, lesions) and its risk
  factors are monitored. In flight, viral reactivation is confirmed with saliva PCR, which the system
  does not measure.
- The in-flight temperature rise (Stahn et al. 2017) was measured as core temperature with a forehead
  and chest sensor; with an oral thermometer it may differ. The simulator does not include it: the
  moving baseline is verified with a synthetic series (`app/tests/inmune.test.js`), not with flight data.
- The stress model was trained on short-duration laboratory stress (Trier test); it does not
  distinguish stress from other causes of a rise in resting heart rate, such as illness.
- HRV (RMSSD) measured with the camera at 30 Hz has a high error and is not used for decisions.

---

## 14. Future work

- Heart rate during movement (PPG-DaLiA) and long-term wellbeing trajectories (LifeSnaps).
- SpO2 with a camera (Hoffman et al. 2022).
- More tests: PVT, Amsler grid, hearing, balance, GAD-7, WHO-5, loneliness.
- Cooperative crew panel; messages recorded by family before the mission.
- ESP32-S3 + MAX30102 hardware prototype with an edge hub.

---

## 15. Sources

- NASA-STD-3001 Vol. 1 Rev. C: https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf
- OCHMO TB-031 Exercise: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf
- OCHMO TB-030 Bone loss: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf
- EIMO: https://ntrs.nasa.gov/citations/20230016189
- Human Exploration of Mars Design Reference Architecture 5.0, NASA/SP-2009-566: https://www.nasa.gov/pdf/373665main_NASA-SP-2009-566.pdf
- OCHMO-TB-014 Behavioral Health Mishaps, Rev. B (2023): https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-014-behavioral-health-mishaps.pdf
- Institute of Medicine 2001, *Safe Passage: Astronaut Care for Exploration Missions*, ch. 5 (p. 140) and 6 (pp. 174 and 183), symptom underreporting: https://doi.org/10.17226/10218
- What's Mars Solar Conjunction, and Why Does It Matter? (NASA): https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/
- Cognitive and behavioral risk: https://www.nasa.gov/directorates/esdmd/hhp/risk-of-adverse-cognitive-or-behavioral-conditions-and-psychiatric-disorders
- Bio-Monitor (CSA): https://asc-csa.gc.ca/eng/sciences/astroskin.asp
- AASM/SRS consensus: https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf
- Kroenke et al. 2001, PHQ-9: https://pubmed.ncbi.nlm.nih.gov/11556941/
- Risk of altered immune response (HRP, evidence report): https://ntrs.nasa.gov/citations/20140002769
- Mehta et al. 2017, reactivation of latent viruses on the ISS: https://doi.org/10.1038/s41526-017-0015-y
- Cohen et al. 2009, sleep and susceptibility to the common cold: https://pubmed.ncbi.nlm.nih.gov/19139325/
- Welltory, COVID-19 and Wearables Open Data: https://github.com/Welltory/hrv-covid19
- Stahn et al. 2017, body temperature in long-duration flights: https://doi.org/10.1038/s41598-017-15560-w
- Basner et al. 2013, Mars-500: https://www.med.upenn.edu/uep/assets/user-content/documents/PNAS2013Basner1212646110withSupportingAppendix.pdf
- Stuster, Journals: https://ntrs.nasa.gov/api/citations/20100026549/downloads/20100026549.pdf
- Schmidt et al. 2018, WESAD: https://archive.ics.uci.edu/dataset/465/wesad+wearable+stress+and+affect+detection
- Thambawita et al. 2020, PMData: https://datasets.simula.no/pmdata
- Guo et al. 2015, variations in the dose measured by MSL RAD in transit to Mars: https://arxiv.org/abs/1503.06631
- Guo et al. 2015, radiation dose on the surface of Mars measured by MSL RAD (ApJ 810:24): https://arxiv.org/abs/1507.03473
- Hassler et al. 2014, radiation environment on the surface of Mars (Science): https://doi.org/10.1126/science.1244797
- MSL RAD raw data: NASA Planetary Data System, PPI node: https://pds-ppi.igpp.ucla.edu/
- Moore et al. 2014, maximal VO2 during and after long-duration flights: https://doi.org/10.1152/japplphysiol.01251.2013
- Barger et al. 2014, sleep and hypnotic use in astronauts: https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436
- OCHMO TB-020 Ionizing radiation protection: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
- Exercise on the Space Station (ARED, CEVIS, T2): https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/

### Official challenge resources

- 5 Hazards of Human Spaceflight (NASA HRP): https://www.nasa.gov/hrp/hazards/ (hazards shown in each explanation in the app)
- Risks of Human Spaceflight (NASA HRP): https://www.nasa.gov/hrp/risks/ (selection of the five traffic-light risks)
- Ongoing HRP Research in Space (NASA HRP): https://www.nasa.gov/hrp/ongoing-hrp-research/
- Monitoring Radiation for Astronaut Health (CSA): https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Why Do We Conduct Science Experiments in Space? (CSA): https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
