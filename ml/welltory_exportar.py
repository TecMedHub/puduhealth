"""Tabla diaria por persona desde el conjunto abierto de Welltory (COVID-19 y wearables, CC0).

FC por día de dos fuentes: mediciones con la cámara del celular o banda (mediana de bpm del día) y
pulso en reposo del reloj. `rel` es el día respecto del inicio de los síntomas (0 = inicio).

Datos: git clone https://github.com/Welltory/hrv-covid19 ml/datos/welltory
Uso:   ml/.venv/bin/python -I ml/welltory_exportar.py
"""

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent
ORIGEN = RAIZ / "datos" / "welltory" / "data"
SALIDA = RAIZ / "cache" / "welltory_diario.csv"

personas = pd.read_csv(ORIGEN / "participants.csv")
personas["inicio"] = pd.to_datetime(personas.symptoms_onset, errors="coerce")
# Fechas de inicio fuera de 2020 son errores de digitación.
personas = personas[personas.inicio.dt.year == 2020][["user_code", "inicio"]]

camara = pd.read_csv(ORIGEN / "hrv_measurements.csv", usecols=["user_code", "measurement_datetime", "bpm"])
camara["fecha"] = pd.to_datetime(camara.measurement_datetime).dt.normalize()
camara = camara.groupby(["user_code", "fecha"], as_index=False).agg(fc=("bpm", "median"), n=("bpm", "size"))
camara["fuente"] = "camara"

reloj = pd.read_csv(ORIGEN / "wearables.csv", usecols=["user_code", "day", "resting_pulse"]).dropna()
reloj = reloj[reloj.resting_pulse > 0]
reloj["fecha"] = pd.to_datetime(reloj.day)
reloj = reloj.groupby(["user_code", "fecha"], as_index=False).agg(fc=("resting_pulse", "median"), n=("resting_pulse", "size"))
reloj["fuente"] = "reloj"

tabla = pd.concat([camara, reloj]).merge(personas, on="user_code")
tabla["rel"] = (tabla.fecha - tabla.inicio).dt.days
tabla = tabla[tabla.rel.between(-400, 200)].rename(columns={"user_code": "persona"})
tabla["fecha"] = tabla.fecha.dt.strftime("%Y-%m-%d")
tabla = tabla.sort_values(["fuente", "persona", "rel"])[["fuente", "persona", "fecha", "rel", "fc", "n"]]

SALIDA.parent.mkdir(exist_ok=True)
tabla.to_csv(SALIDA, index=False)
resumen = tabla.groupby("fuente").agg(personas=("persona", "nunique"), dias=("fc", "size"))
print(f"→ {SALIDA.relative_to(RAIZ.parent)}")
print(resumen.to_string())
