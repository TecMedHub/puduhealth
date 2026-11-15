"""¿Mejora un modelo con muchas variables? Prueba con PMData (resultado negativo).

Objetivo: un "día malo", disposición para rendir (readiness) 1,5 DE o más bajo el rango de la
persona, hoy o mañana. Entradas: desviaciones respecto de la línea base personal (primeros 21 días),
las mismas que usa el detector de la app. Validación: regresión logística dejando fuera a una persona.

Uso: ml/.venv/bin/python -I ml/pmdata_exportar.py && ml/.venv/bin/python -I ml/pmdata_multivariable.py
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

RAIZ = Path(__file__).resolve().parent
ENTRADA = RAIZ / "cache" / "pmdata_diario.csv"
DIAS_BASE = 21
DE_MINIMA = {"fc_reposo": 3, "sueno": 0.3, "pasos": 1000}
VARIABLES = ["fc_reposo", "sueno", "pasos", "readiness", "mood", "fatigue", "stress", "sleep_quality"]

SENSORES = ["z_fc_reposo", "z_sueno", "z_pasos", "z_fc_reposo_7d", "z_sueno_7d"]
REGISTRO = ["z_mood", "z_fatigue", "z_stress", "z_sleep_quality"]
CONJUNTOS = {
    "solo FC": ["z_fc_reposo"],
    "sensores (FC, sueño, pasos y tendencias de 7 días)": SENSORES,
    "registro diario (ánimo, fatiga, estrés, calidad del sueño)": REGISTRO,
    "sensores + registro": SENSORES + REGISTRO,
}


def preparar():
    d = pd.read_csv(ENTRADA, parse_dates=["fecha"]).sort_values(["persona", "fecha"])
    tablas = []
    for persona, g in d.groupby("persona"):
        g = g.set_index("fecha").asfreq("D")
        g["persona"] = persona
        base = g.iloc[:DIAS_BASE]
        for v in VARIABLES:
            de = max(base[v].std(), DE_MINIMA.get(v, 0.5))
            g[f"z_{v}"] = (g[v] - base[v].mean()) / de
        for v in ["fc_reposo", "sueno"]:
            g[f"z_{v}_7d"] = g[f"z_{v}"].rolling(7, min_periods=3).mean()
        malo = (g.z_readiness <= -1.5).astype(float).where(g.z_readiness.notna())
        g["malo_hoy"] = malo
        g["malo_manana"] = malo.shift(-1)
        tablas.append(g.iloc[DIAS_BASE:])
    return pd.concat(tablas).reset_index()


def auc_dejando_fuera(t, entradas, objetivo):
    u = t.dropna(subset=entradas + [objetivo])
    aucs = []
    for persona in u.persona.unique():
        prueba = u[u.persona == persona]
        if prueba[objetivo].nunique() < 2:
            continue
        entreno = u[u.persona != persona]
        m = LogisticRegression(class_weight="balanced", max_iter=1000).fit(entreno[entradas], entreno[objetivo])
        aucs.append(roc_auc_score(prueba[objetivo], m.predict_proba(prueba[entradas])[:, 1]))
    return np.mean(aucs), np.std(aucs), len(aucs)


if __name__ == "__main__":
    t = preparar()
    print(f"Días malos: {t.malo_hoy.mean():.1%} de {int(t.malo_hoy.notna().sum())} días con reporte\n")
    print(f"| {'Entradas':<58} | Mañana | Hoy |")
    print(f"|{'-' * 60}|--------|-----|")
    for nombre, entradas in CONJUNTOS.items():
        celdas = []
        for objetivo in ["malo_manana", "malo_hoy"]:
            media, de, n = auc_dejando_fuera(t, entradas, objetivo)
            celdas.append(f"{media:.2f} ± {de:.2f} ({n})")
        print(f"| {nombre:<58} | {celdas[0]} | {celdas[1]} |")
