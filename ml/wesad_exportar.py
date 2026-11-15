"""Exporta el BVP de muñeca de WESAD y sus ventanas etiquetadas.

Los indicadores (FC, RMSSD, SDNN) se extraen después con el mismo ppg.js que usa la app
(extraer_ppg.mjs), para que el modelo vea exactamente lo que verá el navegador.

Uso: ml/.venv/bin/python -I ml/wesad_exportar.py
"""

import json
import pickle
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent
ORIGEN = RAIZ / "datos" / "wesad"
DESTINO = RAIZ / "cache" / "wesad"

FS_BVP = 64      # Empatica E4, muñeca
FS_ETIQ = 700    # etiquetas a la frecuencia del RespiBAN (pecho)
VENTANA_S = 60
PASO_S = 30
ETIQUETAS = {1: "base", 2: "estres", 3: "diversion"}

# Los archivos .pkl vienen de terceros: sólo se permiten las clases de numpy necesarias
# para reconstruir arreglos (un pickle sin restricciones puede ejecutar código).
PERMITIDAS = {
    ("numpy.core.multiarray", "_reconstruct"),
    ("numpy._core.multiarray", "_reconstruct"),
    ("numpy.core.multiarray", "scalar"),
    ("numpy._core.multiarray", "scalar"),
    ("numpy", "ndarray"),
    ("numpy", "dtype"),
    ("collections", "OrderedDict"),
}


class LectorSeguro(pickle.Unpickler):
    def find_class(self, modulo, nombre):
        if (modulo, nombre) in PERMITIDAS:
            return super().find_class(modulo, nombre)
        raise pickle.UnpicklingError(f"Clase no permitida en el pickle: {modulo}.{nombre}")


def segmentos(etiquetas):
    """Tramos contiguos (etiqueta, inicio, fin) en índices de 700 Hz."""
    cambios = np.flatnonzero(np.diff(etiquetas)) + 1
    bordes = np.concatenate(([0], cambios, [len(etiquetas)]))
    return [(int(etiquetas[a]), int(a), int(b)) for a, b in zip(bordes[:-1], bordes[1:])]


def exportar(ruta):
    with open(ruta, "rb") as f:
        d = LectorSeguro(f, encoding="latin1").load()
    bvp = np.asarray(d["signal"]["wrist"]["BVP"], dtype=float).ravel()
    etiquetas = np.asarray(d["label"]).ravel()

    ventanas = []
    for etiqueta, a, b in segmentos(etiquetas):
        if etiqueta not in ETIQUETAS:
            continue
        inicio, fin = a / FS_ETIQ, b / FS_ETIQ
        s = inicio
        while s + VENTANA_S <= fin:
            i0 = int(round(s * FS_BVP))
            i1 = i0 + VENTANA_S * FS_BVP
            if i1 <= len(bvp):
                ventanas.append({"etiqueta": ETIQUETAS[etiqueta], "inicio": round(s, 2), "i0": i0, "i1": i1})
            s += PASO_S

    sujeto = str(d.get("subject", ruta.stem))
    DESTINO.mkdir(parents=True, exist_ok=True)
    with open(DESTINO / f"{sujeto}.json", "w") as f:
        json.dump({"sujeto": sujeto, "fs": FS_BVP, "bvp": np.round(bvp, 3).tolist(), "ventanas": ventanas}, f)
    conteo = {e: sum(v["etiqueta"] == e for v in ventanas) for e in ETIQUETAS.values()}
    print(f"{sujeto}: {len(bvp) / FS_BVP / 60:.0f} min de BVP, ventanas {conteo}")


if __name__ == "__main__":
    archivos = sorted(ORIGEN.rglob("S*.pkl"))
    if not archivos:
        raise SystemExit(f"No se encontraron archivos S*.pkl en {ORIGEN}")
    for ruta in archivos:
        exportar(ruta)
