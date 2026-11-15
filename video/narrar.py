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


async def sintetizar(texto: str, voz: str, velocidad: str, destino: Path, intentos: int = 6) -> None:
    import edge_tts

    # El servicio de voz a veces no devuelve audio: se reintenta con una pausa creciente.
    for n in range(intentos):
        try:
            await edge_tts.Communicate(texto, voz, rate=velocidad).save(str(destino))
            return
        except edge_tts.exceptions.NoAudioReceived:
            if n == intentos - 1:
                raise
            await asyncio.sleep(2.5 * (n + 1))


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


def medir(entrada: list[str], filtro: str) -> dict:
    """Volumen integrado (LUFS) y pico verdadero (dBTP) de una señal, con loudnorm en modo medición."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *entrada, "-af", f"{filtro}loudnorm=print_format=json",
                        "-f", "null", "-"], capture_output=True, text=True, check=True)
    datos = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    return {"i": float(datos["input_i"]), "tp": float(datos["input_tp"])}


# Voz: compresión suave y la ganancia justa para acercarse a VOZ_LUFS, sin normalización dinámica
# (bombea entre frases y distorsiona). La ganancia nunca hace que el limitador final recorte más de
# MAX_LIMITACION dB: una voz con picos marcados queda algo más baja, pero limpia.
# Música: MUSICA_BAJO_VOZ dB bajo la voz, y baja sola cuando habla la voz. Limitador a -1,5 dBTP.
VOZ_LUFS = -17.0
TECHO_DBTP = -1.5
MAX_LIMITACION = 2.5
MUSICA_BAJO_VOZ = 11.0
COMPRESOR = "highpass=f=70,acompressor=threshold=-22dB:ratio=2.5:attack=15:release=200:knee=6,"


# Declaración de IA exigida por Space Apps: rótulo visible y metadatos en cada video.
FUENTE_ROTULO = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
ROTULO = {"es": "Narración: voz IA", "en": "Narration: AI voice"}
DECLARACION = {
    "es": ("Narración con voz sintética de IA (Microsoft neural TTS, es-CL-CatalinaNeural, vía edge-tts). "
           "Imágenes grabadas de la app real; ilustración del Astropudú generada con IA a partir de un diseño del equipo. "
           "Música original de Benjamín Catipillan-Ulloa. Sin logos de NASA."),
    "en": ("Narration with a synthetic AI voice (Microsoft neural TTS, en-US-AndrewNeural, via edge-tts). "
           "Images recorded from the real app; Astropudú illustration AI-generated from the team's own design. "
           "Original music by Benjamín Catipillan-Ulloa. No NASA logos."),
}


def filtro_rotulo(idioma: str, formato: str) -> str:
    texto = ROTULO[idioma].replace(":", r"\:")
    pos = "x=(w-tw)/2:y=22" if formato == "vertical" else "x=24:y=h-th-24"
    return (f"drawtext=fontfile={FUENTE_ROTULO}:text='{texto}':fontsize=26:fontcolor=white@0.92:"
            f"box=1:boxcolor=0x0a081e@0.72:boxborderw=10:{pos}")


def metadatos(idioma: str) -> list[str]:
    return ["-metadata", f"comment={DECLARACION[idioma]}", "-metadata", f"description={DECLARACION[idioma]}",
            "-metadata", "title=PuduHealth · NASA Space Apps Challenge 2026 · TecMedHub"]


def mezclar(idioma: str, formato: str, musica: Path | None, desfase: float, nivel_musica: float) -> None:
    video = SALIDA / f"cuadros-{idioma}-{formato}.mp4"
    destino = SALIDA / f"puduhealth-{idioma}-{formato}.mp4"
    rotular = video.exists()  # los cuadros recién grabados llevan el rótulo; un video terminado ya lo tiene
    if not rotular:  # sólo se rehace el audio: se usa la imagen del video ya terminado
        video = SALIDA / f"imagen-{idioma}-{formato}.mp4"
        ffmpeg("-i", str(destino), "-map", "0:v", "-c:v", "copy", str(video))
    voz_wav = str(carpeta(idioma) / "voz.wav")
    v = medir(["-i", voz_wav], COMPRESOR)
    ganancia_voz = min(VOZ_LUFS - v["i"], TECHO_DBTP + MAX_LIMITACION - v["tp"])
    voz_final = v["i"] + ganancia_voz
    entradas = ["-i", str(video), "-i", voz_wav]
    voz = f"[1:a]{COMPRESOR}volume={ganancia_voz:.2f}dB,aresample=48000"
    if musica:
        m = medir(["-ss", str(desfase), "-t", str(DURACION), "-i", str(musica)], "")
        objetivo_musica = nivel_musica if nivel_musica is not None else voz_final - MUSICA_BAJO_VOZ
        ganancia_musica = objetivo_musica - m["i"]
        entradas += ["-ss", str(desfase), "-t", str(DURACION), "-i", str(musica)]
        filtro = (f"{voz},asplit=2[voz][guia];"
                  f"[2:a]volume={ganancia_musica:.2f}dB,afade=t=in:st=0:d=0.3,"
                  f"afade=t=out:st={DURACION - 2.5}:d=2.5,aresample=48000[mus];"
                  "[mus][guia]sidechaincompress=threshold=0.03:ratio=3:attack=30:release=400[fondo];"
                  "[voz][fondo]amix=inputs=2:normalize=0:duration=first,"
                  "alimiter=limit=0.84:attack=5:release=80:level=false[a]")
    else:
        filtro = f"{voz},alimiter=limit=0.84:attack=5:release=80:level=false[a]"
    if rotular:
        filtro = f"[0:v]{filtro_rotulo(idioma, formato)}[v];{filtro}"
        video_args = ["-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p"]
    else:
        video_args = ["-map", "0:v", "-c:v", "copy"]
    ffmpeg(*entradas, "-filter_complex", filtro, *video_args, "-map", "[a]",
           "-c:a", "aac", "-b:a", "192k", "-t", str(DURACION), *metadatos(idioma), "-movflags", "+faststart", str(destino))
    if video.name.startswith("imagen-"):
        video.unlink()
    print(f"→ {destino}  (voz {voz_final:.1f} LUFS, ganancia {ganancia_voz:+.1f} dB)")


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
    m.add_argument("--nivel-musica", type=float, default=None, help="volumen de la música en LUFS (por omisión, 11 dB bajo la voz)")
    a = p.parse_args()
    if a.orden == "voz":
        generar_voz(a.idioma)
    else:
        mezclar(a.idioma, a.formato, None if a.sin_musica else a.musica, a.desde, a.nivel_musica)
