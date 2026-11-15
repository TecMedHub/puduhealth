"""Narración sintética del video: voz neuronal de Microsoft (edge-tts) y mezcla con la música.

    python video/narrar.py voz --idioma es                          # → salida/narracion-es/voz.wav + tiempos.json
    node video/grabar.mjs --idioma es --formato vertical            # video con subtítulos sincronizados
    python video/narrar.py mezclar --idioma es --formato vertical   # → salida/puduhealth-es-vertical.mp4

Cada frase de narracion.<idioma>.json empieza en su segundo `t` o, si la anterior aún suena, justo
después. La música por omisión es el tema original de Benjamín Catipillan-Ulloa (musica/).
Requiere `pip install edge-tts` y ffmpeg.
"""

import argparse
import asyncio
import json
import subprocess
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI / "salida"
MUSICA = AQUI / "musica" / "astropudu-tema.mp3"
DURACION = 30.0
PAUSA = 0.15  # segundos mínimos entre frases
TASA = 48000


def duracion(ruta: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout)


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], check=True)


async def sintetizar(texto: str, voz: str, velocidad: str, destino: Path, intentos: int = 4) -> None:
    import edge_tts

    # El servicio de voz a veces no devuelve audio: se reintenta con una pausa creciente.
    for n in range(intentos):
        try:
            await edge_tts.Communicate(texto, voz, rate=velocidad).save(str(destino))
            return
        except edge_tts.exceptions.NoAudioReceived:
            if n == intentos - 1:
                raise
            await asyncio.sleep(1.5 * (n + 1))


def carpeta(idioma: str) -> Path:
    return SALIDA / f"narracion-{idioma}"


def generar_voz(idioma: str) -> None:
    guion = json.loads((AQUI / f"narracion.{idioma}.json").read_text(encoding="utf-8"))
    voces = carpeta(idioma)
    voces.mkdir(parents=True, exist_ok=True)
    tiempos, entradas, filtros = [], [], []
    fin_anterior = 0.0
    for i, f in enumerate(guion["frases"]):
        crudo = voces / f"{i:02d}.mp3"
        limpio = voces / f"{i:02d}.wav"
        asyncio.run(sintetizar(f.get("voz", f["texto"]), guion["voz"], guion["velocidad"], crudo))
        # Recorta el silencio inicial y final para que el subtítulo coincida con la voz.
        recorte = "silenceremove=start_periods=1:start_threshold=-45dB"
        ffmpeg("-i", str(crudo), "-af", f"{recorte},areverse,{recorte},areverse", "-ar", str(TASA), "-ac", "1", str(limpio))
        inicio = max(f["t"], fin_anterior + PAUSA)
        fin = inicio + duracion(limpio)
        if fin > DURACION - 0.1:
            raise SystemExit(f"La frase {i} termina en {fin:.2f} s: acórtala o adelántala")
        fin_anterior = fin
        tiempos.append({"inicio": round(inicio, 3), "fin": round(fin, 3), "texto": f["texto"],
                        "subtitulo": f.get("subtitulo", True)})
        entradas += ["-i", str(limpio)]
        filtros.append(f"[{i}:a]adelay={round(inicio * 1000)}[v{i}]")
        print(f"{inicio:5.2f}–{fin:5.2f} s  {f['texto']}")

    mezcla = "".join(f"[v{i}]" for i in range(len(tiempos)))
    filtros.append(f"{mezcla}amix=inputs={len(tiempos)}:normalize=0,apad,atrim=0:{DURACION}[voz]")
    ffmpeg(*entradas, "-filter_complex", ";".join(filtros), "-map", "[voz]", str(voces / "voz.wav"))
    (voces / "tiempos.json").write_text(json.dumps(tiempos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"→ {voces / 'voz.wav'}")


def mezclar(idioma: str, formato: str, musica: Path | None, desfase: float, nivel_musica: float) -> None:
    video = SALIDA / f"cuadros-{idioma}-{formato}.mp4"
    destino = SALIDA / f"puduhealth-{idioma}-{formato}.mp4"
    entradas = ["-i", str(video), "-i", str(carpeta(idioma) / "voz.wav")]
    voz = "[1:a]loudnorm=I=-15:TP=-2:LRA=11,aresample=48000[voz]"
    if musica:
        entradas += ["-ss", str(desfase), "-t", str(DURACION), "-i", str(musica)]
        fondo = (f"[2:a]loudnorm=I={nivel_musica}:TP=-2:LRA=11,afade=t=in:st=0:d=0.3,"
                 f"afade=t=out:st={DURACION - 2.5}:d=2.5,aresample=48000[fondo]")
        filtro = f"{voz};{fondo};[voz][fondo]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.7:level=false[a]"
    else:
        filtro = voz.replace("[voz]", "[a]")
    ffmpeg(*entradas, "-filter_complex", filtro, "-map", "0:v", "-map", "[a]", "-c:v", "copy",
           "-c:a", "aac", "-b:a", "192k", "-t", str(DURACION), "-movflags", "+faststart", str(destino))
    print(f"→ {destino}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="orden", required=True)
    v = sub.add_parser("voz", help="sintetiza la narración")
    v.add_argument("--idioma", choices=["es", "en"], default="en")
    m = sub.add_parser("mezclar", help="une video, voz y música")
    m.add_argument("--idioma", choices=["es", "en"], default="en")
    m.add_argument("--formato", choices=["horizontal", "vertical"], default="horizontal")
    m.add_argument("--musica", type=Path, default=MUSICA if MUSICA.exists() else None, help="pista de fondo")
    m.add_argument("--sin-musica", action="store_true", help="sólo la voz")
    m.add_argument("--desde", type=float, default=0.35, help="segundo de la música donde empieza")
    m.add_argument("--nivel-musica", type=float, default=-25.0, help="volumen de la música en LUFS")
    a = p.parse_args()
    if a.orden == "voz":
        generar_voz(a.idioma)
    else:
        mezclar(a.idioma, a.formato, None if a.sin_musica else a.musica, a.desde, a.nivel_musica)
