"""FC y VFC de referencia desde el ECG de pecho de WESAD (RespiBAN, 700 Hz).

Usa las mismas ventanas de 60 s que wesad_exportar.py y la misma limpieza de intervalos
que ppg.js (42–210 lpm; intervalos a ±25 % de la mediana; RMSSD sólo entre consecutivos).

Uso: ml/.venv/bin/python -I ml/wesad_ecg.py
"""

import csv
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wesad_exportar import ETIQUETAS, FS_ETIQ, ORIGEN, PASO_S, VENTANA_S, LectorSeguro, segmentos  # noqa: E402

FS = 700
SALIDA = Path(__file__).resolve().parent / "cache" / "wesad_ecg.csv"
IBI_MIN, IBI_MAX = 60 / 210, 60 / 42


def picos_r(ecg):
    """Detector tipo Pan-Tompkins: pasabanda 5–20 Hz, derivada, cuadrado, integración de 150 ms."""
    b, a = butter(3, [5 / (FS / 2), 20 / (FS / 2)], btype="band")
    filtrado = filtfilt(b, a, ecg)
    energia = np.convolve(np.gradient(filtrado) ** 2, np.ones(int(0.15 * FS)) / (0.15 * FS), mode="same")
    candidatos, _ = find_peaks(energia, distance=int(IBI_MIN * FS), height=0.3 * np.percentile(energia, 99))
    # Ubicar el pico R exacto: máximo de |señal filtrada| a ±75 ms de cada candidato.
    r = int(0.075 * FS)
    return np.array([max(0, c - r) + np.argmax(np.abs(filtrado[max(0, c - r): c + r])) for c in candidatos])


def indicadores(picos):
    t = picos / FS
    ibis = np.diff(t)
    validos = (ibis >= IBI_MIN) & (ibis <= IBI_MAX)
    if validos.sum() < 3:
        return None
    mediana = np.median(ibis[validos])
    limpio = validos & (np.abs(ibis - mediana) <= 0.25 * mediana)
    consecutivos = limpio[1:] & limpio[:-1]
    difs = np.diff(ibis)[consecutivos] * 1000
    return {
        "bpm": 60 / mediana,
        "rmssd": float(np.sqrt(np.mean(difs ** 2))) if len(difs) >= 2 else None,
        "sdnn": float(np.std(ibis[limpio]) * 1000) if limpio.sum() >= 3 else None,
        "latidos": len(picos),
        "frac_limpios": float(limpio.mean()),
    }


def procesar(ruta, escritor):
    with open(ruta, "rb") as f:
        d = LectorSeguro(f, encoding="latin1").load()
    ecg = np.asarray(d["signal"]["chest"]["ECG"], dtype=float).ravel()
    etiquetas = np.asarray(d["label"]).ravel()
    sujeto = str(d.get("subject", ruta.stem))
    n = 0
    for etiqueta, a, b in segmentos(etiquetas):
        if etiqueta not in ETIQUETAS:
            continue
        s = a / FS_ETIQ
        while s + VENTANA_S <= b / FS_ETIQ:
            i0 = int(round(s * FS))
            ind = indicadores(picos_r(ecg[i0: i0 + VENTANA_S * FS]))
            if ind:
                escritor.writerow({"sujeto": sujeto, "etiqueta": ETIQUETAS[etiqueta], "inicio": round(s, 2), **ind})
                n += 1
            s += PASO_S
    print(f"{sujeto}: {n} ventanas")


if __name__ == "__main__":
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SALIDA, "w", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=["sujeto", "etiqueta", "inicio", "bpm", "rmssd", "sdnn", "latidos", "frac_limpios"])
        escritor.writeheader()
        for ruta in sorted(ORIGEN.rglob("S*.pkl")):
            procesar(ruta, escritor)
    print(f"→ {SALIDA}")
