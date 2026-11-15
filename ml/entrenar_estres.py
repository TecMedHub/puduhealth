"""Modelo A: estrés agudo estimado contra la línea base personal.

- Entrenamiento con el ECG de pecho de WESAD (referencia limpia también durante el estrés).
- Aplicación en la app con indicadores de PPG (ppg.js) medidos en reposo.
- Validación dejando fuera a una persona completa, evaluando en su ECG y en su PPG.

Uso: ml/.venv/bin/python -I ml/entrenar_estres.py
"""

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import balanced_accuracy_score, roc_auc_score

RAIZ = Path(__file__).resolve().parent
SALIDA = RAIZ.parent / "app" / "modelos" / "estres.json"

CALIDAD_PPG_MIN = 40      # mismo umbral "Regular" del pulsómetro
FRAC_LIMPIOS_ECG_MIN = 0.8
DESCRIPCION_ENTRADAS = {
    "d_bpm": "FC − FC de la línea base (lpm)",
    "d_ln_rmssd": "ln(RMSSD) − ln(RMSSD) de la línea base",
    "d_ln_sdnn": "ln(SDNN) − ln(SDNN) de la línea base",
}
CANDIDATOS = [["d_bpm"], ["d_bpm", "d_ln_rmssd"], ["d_bpm", "d_ln_rmssd", "d_ln_sdnn"]]


def relativizar(df):
    """Diferencias contra la línea base: mediana de la primera mitad del reposo (que no se evalúa)."""
    df = df.dropna(subset=["bpm", "rmssd", "sdnn"]).copy()
    df = df[(df.rmssd > 0) & (df.sdnn > 0)]
    df["ln_rmssd"] = np.log(df.rmssd)
    df["ln_sdnn"] = np.log(df.sdnn)
    partes = []
    for _, g in df.groupby("sujeto"):
        base = g[g.etiqueta == "base"].sort_values("inicio")
        calibracion = base.iloc[: len(base) // 2]
        if len(calibracion) < 3:
            continue
        resto = g.drop(calibracion.index).copy()
        for v in ["bpm", "ln_rmssd", "ln_sdnn"]:
            resto[f"d_{v}"] = resto[v] - calibracion[v].median()
        partes.append(resto)
    out = pd.concat(partes)
    out["y"] = (out.etiqueta == "estres").astype(int)
    return out


def cargar():
    ecg = pd.read_csv(RAIZ / "cache" / "wesad_ecg.csv")
    ecg = relativizar(ecg[ecg.frac_limpios >= FRAC_LIMPIOS_ECG_MIN])
    ppg = pd.read_csv(RAIZ / "cache" / "wesad_ppg.csv")
    ppg = relativizar(ppg[ppg.calidad >= CALIDAD_PPG_MIN])
    return ecg, ppg


def ajustar(X, y):
    media, escala = X.mean(axis=0), X.std(axis=0)
    modelo = LogisticRegression(C=1.0, class_weight="balanced", max_iter=1000)
    modelo.fit((X - media) / escala, y)
    return modelo, media, escala


def metricas(y, p):
    return {
        "auc": roc_auc_score(y, p) if len(set(y)) == 2 else np.nan,
        "exactitud_balanceada": balanced_accuracy_score(y, p >= 0.5) if len(set(y)) == 2 else np.nan,
        "falsos_positivos_reposo": float(np.mean(p[y == 0] >= 0.5)) if (y == 0).any() else np.nan,
    }


def validar(ecg, ppg, columnas):
    """Entrena con el ECG de las demás personas; evalúa en el ECG y en el PPG de la que queda fuera."""
    filas = []
    for sujeto in sorted(ecg.sujeto.unique()):
        ent = ecg[ecg.sujeto != sujeto]
        modelo, media, escala = ajustar(ent[columnas].to_numpy(), ent.y.to_numpy())
        for fuente, datos in (("ecg", ecg), ("ppg", ppg)):
            pru = datos[datos.sujeto == sujeto]
            if pru.empty:
                continue
            p = modelo.predict_proba((pru[columnas].to_numpy() - media) / escala)[:, 1]
            filas.append({"sujeto": sujeto, "fuente": fuente, "n": len(pru), **metricas(pru.y.to_numpy(), p)})
    return pd.DataFrame(filas)


def resumen(r):
    return {
        "auc_media": round(float(r.auc.mean()), 3),
        "auc_de": round(float(r.auc.std()), 3),
        "exactitud_balanceada_media": round(float(r.exactitud_balanceada.mean()), 3),
        "falsos_positivos_reposo_media": round(float(r.falsos_positivos_reposo.mean()), 3),
        "personas": int(r.sujeto.nunique()),
    }


def acuerdo_ppg_ecg():
    """Error del PPG (ppg.js) contra el ECG en las mismas ventanas, por condición."""
    ppg = pd.read_csv(RAIZ / "cache" / "wesad_ppg.csv")
    ecg = pd.read_csv(RAIZ / "cache" / "wesad_ecg.csv")
    m = ppg[ppg.calidad >= CALIDAD_PPG_MIN].merge(ecg, on=["sujeto", "etiqueta", "inicio"], suffixes=("_ppg", "_ecg"))
    out = {}
    for etiqueta, g in m.groupby("etiqueta"):
        out[etiqueta] = {
            "ventanas": int(len(g)),
            "error_fc_mediano_lpm": round(float((g.bpm_ppg - g.bpm_ecg).abs().median()), 2),
            "error_rmssd_mediano_ms": round(float((g.rmssd_ppg - g.rmssd_ecg).abs().median()), 1),
        }
    return out


if __name__ == "__main__":
    ecg, ppg = cargar()
    print(f"ECG: {len(ecg)} ventanas · PPG (calidad ≥ {CALIDAD_PPG_MIN}): {len(ppg)} ventanas\n")

    acuerdo = acuerdo_ppg_ecg()
    print("PPG contra ECG:", json.dumps(acuerdo, ensure_ascii=False), "\n")

    comparacion = {}
    for columnas in CANDIDATOS:
        r = validar(ecg, ppg, columnas)
        modelo, _, _ = ajustar(ecg[columnas].to_numpy(), ecg.y.to_numpy())
        nombre = " + ".join(columnas)
        comparacion[nombre] = {
            "coeficientes": dict(zip(columnas, np.round(modelo.coef_[0], 3).tolist())),
            "ecg": resumen(r[r.fuente == "ecg"]),
            "ppg": resumen(r[r.fuente == "ppg"]),
        }
        print(nombre)
        for k, v in comparacion[nombre].items():
            print(f"   {k}: {v}")

    import sys
    if len(sys.argv) < 2:
        raise SystemExit("\nElegir las entradas y volver a correr, p. ej.: entrenar_estres.py d_bpm,d_ln_rmssd")

    entradas = sys.argv[1].split(",")
    modelo, media, escala = ajustar(ecg[entradas].to_numpy(), ecg.y.to_numpy())
    final = validar(ecg, ppg, entradas)
    salida = {
        "nombre": "estres_fc",
        "fecha": date.today().isoformat(),
        "descripcion": "Probabilidad de estrés agudo a partir de una medición de 60 s en reposo, relativa a la línea base personal.",
        "entradas": [{"nombre": e, "descripcion": DESCRIPCION_ENTRADAS[e]} for e in entradas],
        "media": np.round(media, 6).tolist(),
        "escala": np.round(escala, 6).tolist(),
        "coeficientes": np.round(modelo.coef_[0], 6).tolist(),
        "intercepto": round(float(modelo.intercept_[0]), 6),
        "umbral": 0.5,
        "calidad_minima": CALIDAD_PPG_MIN,
        "validacion": {
            "metodo": "entrenado con ECG; dejando fuera a una persona completa; evaluado en su ECG y en su PPG de muñeca",
            "ecg": resumen(final[final.fuente == "ecg"]),
            "ppg": resumen(final[final.fuente == "ppg"]),
            "ppg_contra_ecg": acuerdo,
        },
        "datos": "WESAD (Schmidt et al. 2018): ECG de pecho (RespiBAN) y BVP de muñeca (Empatica E4). Indicadores de PPG extraídos con pulsometro/assets/ppg.js.",
        "licencia_datos": "WESAD se distribuye sólo para uso académico y no comercial.",
    }
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=2) + "\n")
    print(f"\n→ {SALIDA.relative_to(RAIZ.parent)}")
