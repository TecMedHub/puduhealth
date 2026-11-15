"""Tabla diaria por persona desde PMData: FC en reposo, sueño y pasos (Fitbit) + reporte de bienestar.

Uso: ml/.venv/bin/python -I ml/pmdata_exportar.py
"""

import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent
ORIGEN = RAIZ / "datos" / "pmdata" / "osfstorage-archive" / "pmdata"
SALIDA = RAIZ / "cache" / "pmdata_diario.csv"


def leer_json(ruta):
    with open(ruta) as f:
        return json.load(f)


def persona(carpeta):
    fit = carpeta / "fitbit"

    fc = pd.DataFrame(
        {"fecha": pd.to_datetime(r["dateTime"]).normalize(), "fc_reposo": r["value"]["value"]}
        for r in leer_json(fit / "resting_heart_rate.json")
    )
    fc = fc[fc.fc_reposo > 0]

    sueno = pd.DataFrame(
        {"fecha": pd.to_datetime(r["dateOfSleep"]), "sueno": r["minutesAsleep"] / 60}
        for r in leer_json(fit / "sleep.json")
        if r.get("mainSleep", True)
    ).groupby("fecha", as_index=False).sum()

    pasos = pd.DataFrame(leer_json(fit / "steps.json"))
    pasos["fecha"] = pd.to_datetime(pasos.dateTime).dt.normalize()
    pasos["value"] = pd.to_numeric(pasos["value"])  # vienen como texto: sin esto, sum() los concatena
    pasos = pasos.groupby("fecha", as_index=False)["value"].sum().rename(columns={"value": "pasos"})

    bienestar = pd.read_csv(carpeta / "pmsys" / "wellness.csv")
    bienestar["fecha"] = pd.to_datetime(bienestar.effective_time_frame, utc=True).dt.tz_localize(None).dt.normalize()
    bienestar = bienestar.groupby("fecha", as_index=False)[["readiness", "mood", "fatigue", "stress", "sleep_quality"]].mean()

    dias = fc.merge(sueno, on="fecha", how="outer").merge(pasos, on="fecha", how="outer").merge(bienestar, on="fecha", how="left")
    dias.insert(0, "persona", carpeta.name)
    return dias.sort_values("fecha")


if __name__ == "__main__":
    tablas = []
    for carpeta in sorted(p for p in ORIGEN.iterdir() if p.is_dir() and p.name.startswith("p")):
        try:
            t = persona(carpeta)
        except (FileNotFoundError, KeyError, ValueError) as e:
            print(f"{carpeta.name}: omitido ({type(e).__name__}: {e})")
            continue
        tablas.append(t)
        print(f"{carpeta.name}: {len(t)} días, FC {t.fc_reposo.notna().sum()}, sueño {t.sueno.notna().sum()}, "
              f"bienestar {t.readiness.notna().sum()}")
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    pd.concat(tablas).to_csv(SALIDA, index=False, date_format="%Y-%m-%d")
    print(f"→ {SALIDA}")
